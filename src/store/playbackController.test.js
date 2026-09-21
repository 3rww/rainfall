import { configureStore } from '@reduxjs/toolkit';
import { describe, it, expect, vi } from 'vitest';
import playback, { changePlaybackMode, seekPlayback, playbackFrameApplied, togglePlayback } from './features/playbackSlice';
import { registerPlaybackController } from './playbackController';

const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
function setup() {
  const item = { requestId: 'a', isActive: true, revision: 1, detailsAvailable: true, isFetching: 0, fetchKwargs: { rollup: '5-minute' }, resultHandles: { pixel: 'x' } };
  const store = configureStore({ reducer: {
    playback,
    progress: (s = { tab: 'test' }) => s,
    fetchKwargs: (s = { test: { history: [item] } }, a) => a.type === 'replace' ? { test: { history: a.payload } } : s
  } });
  const timeline = [0, 1, 2, 3].map(i => ({ label: String(i) }));
  const results = { run: vi.fn(async (type, args) => type === 'preparePlayback' ? { session: args.session, timeline } : type === 'playbackFrame' ? { index: args.index, values: [], interval: timeline[args.index] } : null) };
  const stop = registerPlaybackController(store, results);
  const apply = () => store.dispatch(playbackFrameApplied(store.getState().playback.pending.token));
  return { store, results, stop, apply, item };
}
describe('playback lifecycle', () => {
  it('prepares once, bounds prefetch, pauses seeks, resets on replacement and cleans up', async () => {
    const { store, results, stop, apply, item } = setup();
    await flush();
    store.dispatch(changePlaybackMode('interval')); await flush(); apply(); await flush();
    expect(results.run.mock.calls.filter(c => c[0] === 'playbackFrame').map(c => c[1].index)).toEqual([0, 1, 2]);
    store.dispatch(togglePlayback()); store.dispatch(seekPlayback(2)); await flush(); apply(); await flush();
    expect(store.getState().playback.playing).toBe(false);
    store.dispatch(changePlaybackMode('cumulative')); await flush(); apply();
    expect(store.getState().playback.frame.index).toBe(2);
    expect(results.run.mock.calls.filter(c => c[0] === 'preparePlayback')).toHaveLength(1);
    store.dispatch({ type: 'replace', payload: [{ ...item, revision: 2 }] }); await flush();
    expect(store.getState().playback.mode).toBe('total');
    expect(results.run.mock.calls.some(c => c[0] === 'releasePlayback')).toBe(true);
    stop();
  });
  it('ignores late frames after scrubbing or deleting the result', async () => {
    const { store, results, stop } = setup(); await flush();
    const waiting = [];
    results.run.mockImplementation(async (type, args) => {
      if (type === 'preparePlayback') return { timeline: [{}, {}, {}], session: args.session };
      if (type === 'playbackFrame') return new Promise(resolve => waiting.push(() => resolve({ index: args.index, values: [] })));
    });
    store.dispatch(changePlaybackMode('interval')); await flush();
    store.dispatch(seekPlayback(2)); await flush();
    waiting[0](); await flush(); expect(store.getState().playback.pending).toBeNull();
    store.dispatch({ type: 'replace', payload: [] }); await flush();
    waiting[1](); await flush(); expect(store.getState().playback.pending).toBeNull();
    expect(store.getState().playback.available).toBe(false); stop();
  });
});

describe('playback availability and failures', () => {
  it('waits for settled queries and supports terminal partial results', async () => {
    const { store, item, stop } = setup(); await flush();
    store.dispatch({ type: 'replace', payload: [{ ...item, isFetching: 1 }] }); await flush();
    expect(store.getState().playback.available).toBe(false);
    store.dispatch({ type: 'replace', payload: [{ ...item, failedSensors: ['gauge'], lifecycle: 'partial' }] }); await flush();
    expect(store.getState().playback.available).toBe(true);
    store.dispatch(changePlaybackMode('interval')); await flush();
    store.dispatch({ type: 'replace', payload: [{ ...item, detailsAvailable: false, resultHandles: {} }] }); await flush();
    expect(store.getState().playback.mode).toBe('total');
    expect(store.getState().playback.message).toMatch(/rerun/i); stop();
  });
  it('returns to totals when worker preparation fails', async () => {
    const { store, results, stop } = setup(); await flush();
    results.run.mockRejectedValue(new Error('Results worker failed. Please rerun the query.'));
    store.dispatch(changePlaybackMode('interval')); await flush();
    expect(store.getState().playback.mode).toBe('total');
    expect(store.getState().playback.available).toBe(false);
    expect(store.getState().playback.message).toMatch(/rerun/); stop();
  });
  it('advances only after a frame is applied and stops at the end', async () => {
    vi.useFakeTimers();
    const { store, stop, apply } = setup();
    try {
      await flush(); store.dispatch(changePlaybackMode('interval')); await flush(); apply(); await flush();
      store.dispatch(togglePlayback()); await flush();
      await vi.advanceTimersByTimeAsync(100); await flush();
      expect(store.getState().playback.target).toBe(1);
      await vi.advanceTimersByTimeAsync(2000); await flush();
      expect(store.getState().playback.target).toBe(1);
      apply(); await flush(); await vi.advanceTimersByTimeAsync(100); await flush();
      expect(store.getState().playback.target).toBe(2);
      store.dispatch(seekPlayback(3)); await flush(); apply(); await flush();
      expect(store.getState().playback.playing).toBe(false);
      store.dispatch(togglePlayback()); await flush();
      expect(store.getState().playback.target).toBe(0);
    } finally { stop(); vi.useRealTimers(); }
  });
});
