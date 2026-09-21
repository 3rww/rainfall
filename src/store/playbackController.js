import {
  activePlaybackResult, playbackAvailability, resetPlayback, playbackPrepared,
  playbackFrameReady, playbackError, advancePlayback
} from './features/playbackSlice';

// Main-thread frame cache is bounded to the displayed frame and two successors.
export function registerPlaybackController(store, results) {
  let disposed = false, queued = false, identity = '', operation = '', sequence = 0;
  let session = null, prepared = null, abort = null, timer = null, clockKey = '';
  let clock = null;
  let cacheMode = '', cacheGeneration = -1, maxCachedFrames = 0;
  const cache = new Map();
  const release = id => { if (id) results.run('releasePlayback', { session: id }).catch(() => {}); };
  function cleanup() {
    abort?.abort(); abort = null; clearTimeout(timer); timer = null;
    cache.clear(); release(session); session = null; prepared = null; clockKey = ''; clock = null;
  }
  function waitForApplication(frame, signal) {
    return new Promise(resolve => {
      const done = () => { unsubscribe(); signal.removeEventListener('abort', done); resolve(); };
      const unsubscribe = store.subscribe(() => {
        if (store.getState().playback.frame === frame) done();
      });
      signal.addEventListener('abort', done, { once: true });
      if (signal.aborted || store.getState().playback.frame === frame) done();
    });
  }
  function schedule() {
    if (queued || disposed) return;
    queued = true;
    queueMicrotask(() => { queued = false; if (!disposed) synchronize(); });
  }
  function synchronize() {
    const state = store.getState();
    const item = activePlaybackResult(state);
    const key = JSON.stringify([state.progress.tab, item?.requestId, item?.revision, item?.detailsAvailable, item?.isFetching > 0]);
    if (key !== identity) {
      cleanup(); identity = key; operation = '';
      const message = playbackAvailability(item);
      store.dispatch(resetPlayback({ key, available: !message, message }));
      return;
    }
    const p = state.playback;
    const runKey = JSON.stringify([p.key, p.mode, p.generation]);
    if (!p.playing) clock = null;
    else if (!clock || clock.key !== runKey) {
      clock = { key: runKey, started: performance.now(), index: p.target,
        interval: Math.min(100, 10000 / Math.max(1, p.timeline.length - 1)) };
    }
    const nextClockKey = JSON.stringify([runKey, p.playing, p.frame?.index, p.target]);
    if (clockKey !== nextClockKey) {
      clearTimeout(timer); timer = null; clockKey = nextClockKey;
      if (clock && p.frame?.index === p.target && !p.pending) {
        const due = clock.started + (p.target + 1 - clock.index) * clock.interval;
        // Account for rendering time and skip overdue frames instead of accumulating delay.
        // Keep at most one unapplied frame in flight, even when rendering is slow.
        timer = setTimeout(() => {
          const index = clock.index + Math.floor((performance.now() - clock.started) / clock.interval);
          store.dispatch(advancePlayback(index));
        }, Math.max(0, due - performance.now()));
      }
    }
    const nextOperation = JSON.stringify([p.key, p.mode, p.target, p.generation]);
    if (nextOperation === operation) return;
    operation = nextOperation;
    abort?.abort(); abort = new AbortController();
    const signal = abort.signal;
    if (p.mode === 'total' || !p.available) { cache.clear(); return; }
    if (cacheMode !== p.mode || cacheGeneration !== p.generation) cache.clear();
    cacheMode = p.mode; cacheGeneration = p.generation;
    // Drop the old displayed frame before adding its replacement.
    for (const index of cache.keys()) if (index < p.target || index > p.target + 2) cache.delete(index);
    const current = () => !disposed && !signal.aborted && operation === nextOperation;
    const run = async () => {
      let preparingSession = null;
      try {
        if (!prepared) {
          preparingSession = `playback:${++sequence}`;
          const response = await results.run('preparePlayback', { session: preparingSession, handles: item.resultHandles, rollup: item.fetchKwargs.rollup }, { signal });
          if (!current()) { release(preparingSession); return; }
          session = preparingSession; prepared = response;
          store.dispatch(playbackPrepared({ key, timeline: response.timeline }));
          if (!response.timeline.length) throw new Error('No observation intervals are available for playback.');
        }
        for (let index = p.target; index < Math.min(p.target + 3, prepared.timeline.length); index++) {
          if (!current()) return;
          let frame = cache.get(index);
          if (!frame) {
            frame = await results.run('playbackFrame', { session, index, mode: p.mode }, { signal });
            if (!current()) return;
            cache.set(index, frame);
            maxCachedFrames = Math.max(maxCachedFrames, cache.size);
          }
          if (index === p.target) {
            store.dispatch(playbackFrameReady({ key, mode: p.mode, generation: p.generation, frame, token: ++sequence }));
            // Release the previous displayed frame before prefetching two successors.
            await waitForApplication(frame, signal);
          }
        }
      } catch (error) {
        if (preparingSession && preparingSession !== session) release(preparingSession);
        if (current()) store.dispatch(playbackError(error.message));
      }
    };
    run();
  }
  const unsubscribe = store.subscribe(schedule);
  schedule();
  const teardown = () => { disposed = true; unsubscribe(); cleanup(); };
  teardown.inspect = () => ({ cachedFrames: cache.size, maxCachedFrames });
  return teardown;
}
