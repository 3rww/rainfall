import { activePlaybackResult, playbackAvailability, resetPlayback, playbackPrepared, playbackProgress, playbackError, pausePlayback, playbackScale, restartPlayback, PLAYBACK_FRAMES_PER_SECOND } from './features/playbackSlice';

export const sensorKey = (source, id) => JSON.stringify([source, String(id)]);

// One runtime per store. Neither worker replies nor renderer acknowledgements enter Redux.
export function registerPlaybackController(store, results) {
  let disposed = false, queued = false, identity = '', controlKey = '', sequence = 0;
  let preparation = null;
  let session = null, prepared = null, abort = null, timer = null, progressTimer = null;
  let renderer = null, current = null, pending = null, clock = null, settings = null;
  let generation = 0, maxCachedFrames = 0, appliedFrames = 0, lastProgress = -Infinity;
  let sensors = [], indexes = new Map(), gpuValues = new Float32Array(0);
  const fetching = new Map();
  const cache = new Map(), subscribers = new Set(), presentations = new Set();
  const release = id => { if (id) results.run('releasePlayback', { session: id }).catch(() => {}); };
  const valid = token => !disposed && token === generation;
  const configuration = () => ({ ...store.getState().playback, playing: Boolean(clock) });
  function cancel() {
    generation++; abort?.abort(); abort = new AbortController();
    clearTimeout(timer); timer = null; pending = null; fetching.clear(); preparation = null;
  }
  function cleanup() {
    cancel(); clearTimeout(progressTimer); progressTimer = null;
    cache.clear(); release(session); session = null; prepared = null; current = null; clock = null;
    sensors = []; indexes = new Map(); gpuValues = new Float32Array(0);
  }
  function publish(immediate = false) {
    clearTimeout(progressTimer);
    const notify = () => {
      progressTimer = null; if (disposed) return;
      lastProgress = performance.now();
      const p = store.getState().playback;
      store.dispatch(playbackProgress({ key: p.key, generation: p.generation, index: current?.index ?? null,
        interval: current?.interval ?? null, status: p.mode === 'total' ? p.status : pending && !clock ? 'loading' : current ? 'ready' : 'loading', playing: Boolean(clock) }));
      for (const listener of subscribers) listener();
    };
    // Automatic notifications always leave the Mapbox rendering callback.
    if (immediate) notify();
    else progressTimer = setTimeout(notify, Math.max(0, 100 - (performance.now() - lastProgress)));
  }
  function schedule() {
    if (queued || disposed) return;
    queued = true;
    queueMicrotask(() => { queued = false; if (!disposed) synchronize(); });
  }
  function updateRenderer() { renderer?.updateSettings(configuration()); }
  function trim(target) {
    // Include the displayed frame in the three-frame bound while awaiting its replacement.
    const keep = new Set([current?.index, target]);
    for (let i = target + 1; keep.size < 3; i++) keep.add(i);
    for (const index of cache.keys()) if (!keep.has(index)) cache.delete(index);
  }
  async function fetchFrame(index, token) {
    if (cache.has(index)) return cache.get(index);
    let request = fetching.get(index);
    if (!request) {
      request = results.run('playbackFrame', { session, index, mode: settings.mode }, { signal: abort.signal });
      fetching.set(index, request);
    }
    const frame = await request;
    if (!valid(token)) return null;
    fetching.delete(index);
    cache.set(index, frame); trim(pending?.index ?? current?.index ?? index);
    maxCachedFrames = Math.max(maxCachedFrames, cache.size);
    return frame;
  }
  function arm() {
    clearTimeout(timer); timer = null;
    if (!clock || !current || pending || !renderer) return;
    const atEnd = current.index === prepared.timeline.length - 1;
    const due = atEnd ? performance.now() + clock.interval : clock.started + (current.index + 1 - clock.index) * clock.interval;
    timer = setTimeout(() => {
      if (!clock) return;
      if (atEnd) {
        if (store.getState().playback.repeat) store.dispatch(restartPlayback());
        else { clock = null; updateRenderer(); publish(true); }
        return;
      }
      const target = Math.min(prepared.timeline.length - 1, Math.max(current.index + 1, clock.index + Math.floor((performance.now() - clock.started) / clock.interval)));
      deliver(target);
    }, Math.max(0, due - performance.now()));
  }
  function pack(frame) {
    gpuValues.fill(0);
    // The worker preserves preparePlayback.sensors order in every frame response.
    for (let index = 0; index < frame.values.length; index++) {
      const value = frame.values[index];
      const offset = index * 4;
      gpuValues[offset] = value.value ?? 0; gpuValues[offset + 1] = value.value == null ? 0 : 1;
      gpuValues[offset + 2] = value.intervalValue ?? 0; gpuValues[offset + 3] = value.intervalValue == null ? 0 : 1;
    }
  }
  async function deliver(target) {
    if (!renderer || pending || !prepared || disposed) return;
    const token = generation, signal = abort.signal;
    pending = { index: target };
    trim(target);
    try {
      const frame = await fetchFrame(target, token);
      if (!valid(token) || !frame) return;
      if (current !== frame) {
        pack(frame);
        const acknowledged = await renderer.present(frame, { values: gpuValues, sensors, indexes, settings: configuration(), signal });
        if (!valid(token) || acknowledged === false) return;
        current = frame; appliedFrames++;
        for (const listener of presentations) listener(frame);
      }
      pending = null;
      if (clock && frame.index === prepared.timeline.length - 1) {
        if (!store.getState().playback.repeat) { clock = null; updateRenderer(); }
        // Completion is immediate, but still outside the rendering callback (Promise continuation).
        publish(true);
      } else publish(!clock);
      trim(target);
      arm();
      // Prefetch sequentially; foreground requests share an in-flight worker response.
      for (let index = target + 1; index < Math.min(target + 3, prepared.timeline.length); index++) {
        if (!valid(token) || pending || current !== frame) return;
        await fetchFrame(index, token);
      }
    } catch (error) {
      if (valid(token)) fail(error);
    }
  }
  function fail(error) {
    cleanup(); renderer?.updateSettings({ ...store.getState().playback, mode: 'total', playing: false });
    store.dispatch(playbackError(error.message)); publish(true);
  }
  async function prepare(item, token) {
    if (preparation === token) return;
    preparation = token;
    const id = `playback:${++sequence}`;
    try {
      const response = await results.run('preparePlayback', { session: id, handles: item.resultHandles, rollup: item.fetchKwargs.rollup }, { signal: abort.signal });
      if (!valid(token)) { release(id); return; }
      if (!response.timeline.length) throw new Error('No observation intervals are available for playback.');
      session = id; prepared = response; preparation = null; sensors = response.sensors || [];
      indexes = new Map(sensors.map((sensor, index) => [sensorKey(sensor.source, sensor.id), index]));
      gpuValues = new Float32Array(sensors.length * 4);
      renderer?.updateGeometry({ sensors, indexes, key: identity });
      store.dispatch(playbackPrepared({ key: identity, timeline: response.timeline, summary: response.summary }));
      updateRenderer(); deliver(store.getState().playback.target);
    } catch (error) { release(id); if (valid(token)) fail(error); }
  }
  function synchronize() {
    const state = store.getState(), item = activePlaybackResult(state);
    const key = JSON.stringify([state.progress.tab, item?.requestId, item?.revision, item?.detailsAvailable, item?.isFetching > 0]);
    if (key !== identity) {
      cleanup(); identity = key; controlKey = '';
      const message = playbackAvailability(item);
      store.dispatch(resetPlayback({ key, available: !message, message })); return;
    }
    const p = state.playback;
    // Progress and target snapshots are output only; they cannot reschedule playback.
    const next = JSON.stringify([p.key, p.mode, p.generation, p.playing, p.speed, p.repeat, p.step, playbackScale(p)]);
    if (next === controlKey) return;
    const previous = settings;
    controlKey = next; settings = p;
    const reset = !previous || previous.key !== p.key || previous.mode !== p.mode || previous.generation !== p.generation;
    const transport = reset || previous.playing !== p.playing || (p.playing && previous.speed !== p.speed);
    const canceledPresentation = transport && pending && current;
    const target = p.step && reset
      ? Math.max(0, Math.min((p.step.from ?? current?.index ?? p.appliedIndex ?? 0) + p.step.delta, p.timeline.length - 1))
      : previous && previous.mode !== p.mode && previous.mode !== 'total' ? current?.index ?? p.target : p.target;
    if (transport) { cancel(); clock = null; }
    if (reset) {
      cache.clear();
      if (!previous || previous.key !== p.key || previous.mode !== p.mode || p.playing) current = null;
    }
    if (p.mode === 'total' || !p.available) {
      cleanup(); updateRenderer(); publish(true); return;
    }
    if (p.playing && !clock) clock = { started: performance.now(), index: current?.index ?? p.target,
      interval: 1000 / (PLAYBACK_FRAMES_PER_SECOND * p.speed) };
    updateRenderer();
    if (canceledPresentation && !reset) {
      pack(current);
      renderer?.restore(current, { values: gpuValues, sensors, indexes, settings: configuration() });
    }
    if (!prepared) prepare(item, generation);
    else {
      renderer?.updateGeometry({ sensors, indexes, key: identity });
      if (reset || (!current && !pending)) deliver(target);
      else if (transport) arm();
    }
    publish(true);
  }
  const unsubscribe = store.subscribe(schedule);
  const visibility = () => { if (document.hidden) { store.dispatch(pausePlayback()); if (!clock) { updateRenderer(); publish(true); } } };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibility);
  const runtime = {
    attachRenderer(next) {
      if (renderer === next) return () => {};
      cancel(); renderer?.dispose(); renderer = next;
      if (!prepared) { controlKey = ''; schedule(); }
      renderer?.updateGeometry({ sensors, indexes, key: identity }); updateRenderer();
      if (prepared && settings?.mode !== 'total') { const index = current?.index ?? store.getState().playback.target; current = null; deliver(index); }
      return () => { if (renderer === next) { cancel(); renderer.dispose(); renderer = null; } };
    },
    restore() { renderer?.restore(); },
    refreshReadout: () => publish(),
    getCurrentFrame: () => current,
    getReadout: (source, id) => current?.values[indexes.get(sensorKey(source, id))],
    subscribe(listener) { subscribers.add(listener); return () => subscribers.delete(listener); },
    subscribePresentation(listener) { presentations.add(listener); return () => presentations.delete(listener); },
    inspect: () => ({ cachedFrames: cache.size, maxCachedFrames, appliedFrames, pendingIndex: pending?.index ?? null,
      appliedIndex: current?.index ?? null, ...renderer?.inspect() }),
    dispose() {
      disposed = true; unsubscribe(); cleanup(); renderer?.dispose(); renderer = null; subscribers.clear(); presentations.clear();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility);
    }
  };
  schedule();
  const teardown = () => runtime.dispose(); teardown.inspect = runtime.inspect; teardown.runtime = runtime;
  return teardown;
}
