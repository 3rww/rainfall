import { configureStore } from '@reduxjs/toolkit';
import { describe, it, expect, vi, afterEach } from 'vitest';
import playback, { changePlaybackMode, seekPlayback, stepPlayback, togglePlayback, pausePlayback, selectPlaybackScale, selectPlaybackSpeed, togglePlaybackRepeat, PLAYBACK_FRAMES_PER_SECOND, PLAYBACK_SPEEDS } from './features/playbackSlice';
import { registerPlaybackController } from './playbackController';
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const cleanups = [];
afterEach(() => { cleanups.splice(0).forEach(stop => stop()); vi.useRealTimers(); });
function setup(count = 4) {
  const item = { requestId: 'a', isActive: true, revision: 1, detailsAvailable: true, isFetching: 0, fetchKwargs: { rollup: '5-minute' }, resultHandles: { pixel: 'x' } };
  const actions = [];
  const store = configureStore({ reducer: { playback, progress: (s = { tab: 'test' }) => s,
    fetchKwargs: (s = { test: { history: [item] } }, a) => a.type === 'replace' ? { test: { history: a.payload } } : s
  }, middleware: getDefault => getDefault().concat(() => next => action => { actions.push({ action, time: performance.now() }); return next(action); }) });
  const timeline = Array.from({ length: count }, (_, i) => ({ label: String(i), startMs: i * 1000, endMs: (i + 1) * 1000 }));
  const results = { run: vi.fn(async (type, args) => type === 'preparePlayback' ? { session: args.session, timeline, sensors: [{ source: 'pixel', id: '1' }], summary: { interval: [], cumulative: [] } }
    : type === 'playbackFrame' ? { index: args.index, values: [{ source: 'pixel', id: '1', value: args.index ? 0 : null }], interval: timeline[args.index] } : null) };
  const stop = registerPlaybackController(store, results), runtime = stop.runtime, waiting = [];
  const renderer = { updateGeometry: vi.fn(), updateSettings: vi.fn(), dispose: vi.fn(), inspect: () => ({}),
    present: vi.fn((frame, data) => new Promise(resolve => waiting.push({ frame, data, resolve }))) };
  runtime.attachRenderer(renderer); cleanups.push(stop);
  const apply = async () => { waiting.shift()?.resolve(true); await flush(); };
  const start = async () => { await flush(); store.dispatch(changePlaybackMode('interval')); await flush(); await apply(); };
  return { store, results, runtime, renderer, waiting, apply, start, item, actions };
}
describe('imperative playback runtime', () => {
  it('prepares once, caches three frames, indexes missing/zero and never puts values in Redux', async () => {
    const { store, runtime, results, start, apply, actions } = setup(); await start();
    expect(runtime.getReadout('pixel', '1').value).toBeNull();
    expect(runtime.inspect().cachedFrames).toBe(3);
    store.dispatch(seekPlayback(2)); await flush(); await apply();
    expect(runtime.getReadout('pixel', 1).value).toBe(0);
    store.dispatch(changePlaybackMode('cumulative')); await flush(); await apply();
    expect(runtime.getCurrentFrame().index).toBe(2);
    expect(results.run.mock.calls.filter(c => c[0] === 'preparePlayback')).toHaveLength(1);
    expect(store.getState().playback).not.toHaveProperty('frame');
    expect(store.getState().playback).not.toHaveProperty('pending');
    expect(JSON.stringify(actions)).not.toContain('"values"');
  });
  it('ignores stale worker replies, stale draw acknowledgements and result replacements', async () => {
    const { store, runtime, results, waiting, apply, item } = setup(); await flush();
    const original = results.run.getMockImplementation(), replies = [];
    results.run.mockImplementation((type, args, options) => type === 'playbackFrame' ? new Promise(resolve => replies.push(() => original(type, args, options).then(resolve))) : original(type, args, options));
    store.dispatch(changePlaybackMode('interval')); await flush();
    store.dispatch(seekPlayback(2)); await flush();
    replies[0](); await flush(); expect(waiting).toHaveLength(0);
    replies[1](); await flush(); expect(waiting).toHaveLength(1);
    store.dispatch({ type: 'replace', payload: [{ ...item, revision: 2 }] }); await flush(); await apply();
    expect(runtime.getCurrentFrame()).toBeNull(); expect(store.getState().playback.mode).toBe('total');
    expect(results.run.mock.calls.some(c => c[0] === 'releasePlayback')).toBe(true);
  });
  it('keeps one presentation in flight and skips overdue intervals after a delayed draw', async () => {
    vi.useFakeTimers(); const { store, runtime, start, apply, waiting } = setup(); await start();
    store.dispatch(togglePlayback()); await flush(); await vi.advanceTimersByTimeAsync(167);
    expect(waiting[0].frame.index).toBe(1);
    await vi.advanceTimersByTimeAsync(2000); expect(waiting).toHaveLength(1);
    await apply(); await vi.advanceTimersByTimeAsync(1); expect(waiting[0].frame.index).toBe(3);
    await apply(); expect(store.getState().playback.playing).toBe(false);
    store.dispatch(togglePlayback()); await flush(); expect(waiting[0].frame.index).toBe(0);
    expect(runtime.inspect().maxCachedFrames).toBeLessThanOrEqual(3);
  });
  it('publishes automatic progress at most 10 Hz and commands immediately without scheduling feedback', async () => {
    vi.useFakeTimers(); const { store, runtime, start, apply, actions } = setup(1201); await start();
    store.dispatch(selectPlaybackSpeed(10));
    store.dispatch(togglePlayback()); await flush(); const started = performance.now(); actions.length = 0;
    for (let i = 0; i < 50; i++) { await vi.advanceTimersByTimeAsync(10); await apply(); }
    const notifications = actions.filter(({ action }) => action.type === 'playback/playbackProgress');
    expect(notifications.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < notifications.length; i++) expect(notifications[i].time - notifications[i-1].time).toBeGreaterThanOrEqual(100);
    const count = runtime.inspect().appliedFrames;
    store.dispatch(pausePlayback()); await flush(); expect(store.getState().playback.appliedIndex).toBe(runtime.getCurrentFrame().index);
    store.dispatch(selectPlaybackScale('breaks_100')); await flush();
    await vi.advanceTimersByTimeAsync(300); expect(runtime.inspect().appliedFrames).toBe(count);
    expect(performance.now() - started).toBe(800);
  });
  it('supports partial results, unavailable details and worker failures', async () => {
    const { store, results, item } = setup(); await flush();
    store.dispatch({ type: 'replace', payload: [{ ...item, isFetching: 1 }] }); await flush(); expect(store.getState().playback.available).toBe(false);
    store.dispatch({ type: 'replace', payload: [{ ...item, failedSensors: ['gauge'] }] }); await flush(); expect(store.getState().playback.available).toBe(true);
    results.run.mockRejectedValue(new Error('Worker failed. Please rerun.'));
    store.dispatch(changePlaybackMode('interval')); await flush(); expect(store.getState().playback.message).toMatch(/rerun/);
    expect(store.getState().playback.mode).toBe('total');
  });
  it.each([4, 101, 1201, 8929])('finishes %i timesteps at the selected interval rate with a slow renderer', async count => {
    vi.useFakeTimers(); const { store, runtime, start, apply } = setup(count); await start();
    store.dispatch(selectPlaybackSpeed(10));
    const duration = (count - 1) * 1000 / (PLAYBACK_FRAMES_PER_SECOND * 10);
    const started = performance.now(); store.dispatch(togglePlayback()); await flush();
    while (store.getState().playback.playing && performance.now() - started < duration + 100) { await vi.advanceTimersByTimeAsync(20); await apply(); }
    expect(runtime.getCurrentFrame().index).toBe(count - 1);
    expect(performance.now() - started).toBeGreaterThanOrEqual(duration - 1);
    // One delayed draw can occupy the final deadline; allow its replacement draw too.
    expect(performance.now() - started).toBeLessThanOrEqual(duration + 40);
    expect(runtime.inspect().maxCachedFrames).toBeLessThanOrEqual(3);
  });
});

describe('runtime control races', () => {
  it.each(PLAYBACK_SPEEDS)('schedules six intervals per second multiplied by %sx', async speed => {
    vi.useFakeTimers(); const { store, start, waiting, apply, runtime } = setup(101); await start();
    store.dispatch(selectPlaybackSpeed(speed)); store.dispatch(togglePlayback()); await flush();
    const interval = 1000 / (6 * speed);
    await vi.advanceTimersByTimeAsync(Math.floor(interval) - 1); expect(waiting).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(2); expect(waiting[0].frame.index).toBe(1);
    await apply(); expect(runtime.getCurrentFrame().index).toBe(1);
  });
  it('changes speed while playing without jumping back or accepting an obsolete draw', async () => {
    vi.useFakeTimers(); const { store, start, waiting, apply, runtime, renderer } = setup(101); await start();
    renderer.restore = vi.fn();
    store.dispatch(togglePlayback()); await flush();
    await vi.advanceTimersByTimeAsync(167); await apply();
    await vi.advanceTimersByTimeAsync(167); const stale = waiting.shift();
    expect(stale.frame.index).toBe(2);
    store.dispatch(selectPlaybackSpeed(0.5)); await flush();
    expect(renderer.restore.mock.calls.at(-1)[0].index).toBe(1);
    stale.resolve(true); await flush(); expect(runtime.getCurrentFrame().index).toBe(1);
    await vi.advanceTimersByTimeAsync(332); expect(waiting).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(2); expect(waiting[0].frame.index).toBe(2);
    await apply(); expect(store.getState().playback.playing).toBe(true);
  });
  it('repeats from frame zero until disabled, keeping the cache and session bounded', async () => {
    vi.useFakeTimers(); const { store, start, waiting, apply, runtime, results } = setup(3); await start();
    store.dispatch(togglePlaybackRepeat()); store.dispatch(togglePlayback()); await flush();
    for (const index of [1, 2, 0, 1, 2, 0]) {
      await vi.advanceTimersByTimeAsync(167);
      expect(waiting[0].frame.index).toBe(index); await apply();
      expect(store.getState().playback.playing).toBe(true);
    }
    store.dispatch(togglePlaybackRepeat()); await flush();
    for (let i = 0; i < 2; i++) { await vi.advanceTimersByTimeAsync(167); await apply(); }
    expect(store.getState().playback).toMatchObject({ playing: false, appliedIndex: 2, repeat: false });
    await vi.advanceTimersByTimeAsync(1000); expect(waiting).toHaveLength(0);
    expect(runtime.inspect().maxCachedFrames).toBeLessThanOrEqual(3);
    expect(results.run.mock.calls.filter(c => c[0] === 'preparePlayback')).toHaveLength(1);
  });
  it('cancels a scheduled repeat when paused or seeking', async () => {
    vi.useFakeTimers(); const { store, start, waiting, apply } = setup(2); await start();
    store.dispatch(togglePlaybackRepeat()); store.dispatch(togglePlayback()); await flush();
    await vi.advanceTimersByTimeAsync(167); await apply();
    store.dispatch(pausePlayback()); await flush();
    await vi.advanceTimersByTimeAsync(500); expect(waiting).toHaveLength(0);
    expect(store.getState().playback).toMatchObject({ playing: false, appliedIndex: 1 });
    store.dispatch(togglePlayback()); await flush(); await apply();
    store.dispatch(seekPlayback(1)); await flush(); await apply();
    await vi.advanceTimersByTimeAsync(500); expect(waiting).toHaveLength(0);
    expect(store.getState().playback).toMatchObject({ playing: false, appliedIndex: 1 });
  });
  it.each([-1, 1])('pauses and steps %i from the displayed frame between progress snapshots', async direction => {
    vi.useFakeTimers(); const { store, start, waiting, apply, runtime } = setup(101); await start();
    store.dispatch(selectPlaybackSpeed(10)); store.dispatch(togglePlaybackRepeat()); store.dispatch(togglePlayback()); await flush();
    await vi.advanceTimersByTimeAsync(20); await apply();
    const displayed = runtime.getCurrentFrame().index;
    expect(displayed).toBeGreaterThan(store.getState().playback.appliedIndex);
    store.dispatch(stepPlayback(direction)); await flush();
    expect(waiting[0].frame.index).toBe(displayed + direction);
    expect(waiting[0].data.settings).toMatchObject({ playing: false, step: { delta: direction } });
    await apply(); await vi.advanceTimersByTimeAsync(1000);
    expect(waiting).toHaveLength(0);
    expect(store.getState().playback).toMatchObject({ playing: false, appliedIndex: displayed + direction });
  });
  it('handles rapid paused steps and clamps at both ends without looping', async () => {
    const { store, start, waiting, apply } = setup(); await start();
    store.dispatch(togglePlaybackRepeat());
    store.dispatch(stepPlayback(1)); store.dispatch(stepPlayback(1)); await flush();
    expect(waiting[0].frame.index).toBe(2); await apply();
    store.dispatch(stepPlayback(1)); await flush(); await apply();
    store.dispatch(stepPlayback(1)); await flush(); await apply();
    expect(store.getState().playback).toMatchObject({ target: 3, playing: false });
    store.dispatch(seekPlayback(0)); await flush(); await apply();
    store.dispatch(stepPlayback(-1)); await flush(); await apply();
    expect(store.getState().playback).toMatchObject({ target: 0, playing: false });
  });
  it('preserves speed and repeat preferences across results without starting playback', async () => {
    const { store, start, item } = setup(); await start();
    store.dispatch(selectPlaybackSpeed(5)); store.dispatch(togglePlaybackRepeat());
    store.dispatch(selectPlaybackSpeed(0));
    store.dispatch({ type: 'replace', payload: [{ ...item, revision: 2 }] }); await flush();
    expect(store.getState().playback).toMatchObject({ speed: 5, repeat: true, playing: false, step: null, mode: 'total' });
  });
  it('does not duplicate preparation when the legend changes while the worker is preparing', async () => {
    const { store, results, start, runtime } = setup(); await flush();
    const original = results.run.getMockImplementation(); let resolve;
    results.run.mockImplementation((type,args,options)=>type==='preparePlayback'?new Promise(done=>{resolve=()=>original(type,args,options).then(done);}):original(type,args,options));
    store.dispatch(changePlaybackMode('interval')); await flush();
    store.dispatch(selectPlaybackScale('breaks_100')); await flush();
    expect(results.run.mock.calls.filter(c=>c[0]==='preparePlayback')).toHaveLength(1);
    resolve(); await flush(); expect(runtime.inspect().pendingIndex).toBe(0);
  });
  it('mode changes preserve the actual displayed index between progress notifications', async () => {
    vi.useFakeTimers(); const {store,runtime,start,apply,waiting}=setup(1201); await start();
    store.dispatch(selectPlaybackSpeed(10));
    store.dispatch(togglePlayback()); await flush(); await vi.advanceTimersByTimeAsync(20); await apply();
    const displayed=runtime.getCurrentFrame().index;
    expect(displayed).toBeGreaterThan(store.getState().playback.appliedIndex);
    store.dispatch(changePlaybackMode('combined')); await flush(); expect(waiting[0].frame.index).toBe(displayed);
  });
  it('restores the acknowledged frame when pausing with another draw pending',async()=>{
    vi.useFakeTimers();const {store,runtime,renderer,start,waiting}=setup();renderer.restore=vi.fn();await start();
    store.dispatch(togglePlayback());await flush();await vi.advanceTimersByTimeAsync(167);
    expect(waiting[0].frame.index).toBe(1);
    store.dispatch(pausePlayback());await flush();
    expect(renderer.restore.mock.calls[0][0].index).toBe(0);
    waiting[0].resolve(true);await flush();expect(runtime.getCurrentFrame().index).toBe(0);
  });
});
it('keeps the displayed timestamp/readout while a seek is awaiting its draw',async()=>{
  const {store,runtime,start,apply}=setup();await start();
  store.dispatch(seekPlayback(2));await flush();
  expect(store.getState().playback).toMatchObject({target:2,appliedIndex:0,status:'loading'});
  expect(runtime.getCurrentFrame().index).toBe(0);
  await apply();expect(store.getState().playback).toMatchObject({target:2,appliedIndex:2,status:'ready'});
});
