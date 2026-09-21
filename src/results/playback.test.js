import { describe, it, expect } from 'vitest';
import { createResultsEngine } from './engine';
import { playbackInterval } from './playback';
const finish = generator => { let step; do { step = generator.next(); } while (!step.done); return step.value; };
const ingest = (engine, sensor, data) => finish(engine.ingest({ sensor, handle: sensor, buffer: new TextEncoder().encode(JSON.stringify({ status: 'finished', data })).buffer }));
const point = (ts, val) => ({ ts, val });

describe('worker playback', () => {
  it('aligns sensors, preserves null and zero, and seeks cumulative sums across gaps', () => {
    const e = createResultsEngine();
    const t = ['2026-01-01T00:05:00Z', '2026-01-01T00:10:00Z', '2026-01-01T00:15:00Z'];
    const summary = ingest(e, 'pixel', [{ id: 100, data: [point(t[0], null), point(t[1], 0), point(t[2], 0.2)] }, { id: '101', data: [point(t[0], null)] }]);
    ingest(e, 'gauge', [{ id: 100, data: [point(t[0], 0.1), point(t[2], 0.3)] }]);
    const prepared = finish(e.preparePlayback({ handles: { pixel: 'pixel', gauge: 'gauge' }, rollup: '5-minute', session: 'a' }));
    expect(prepared.timeline).toHaveLength(3);
    const frame = (index, mode) => finish(e.playbackFrame({ session: 'a', index, mode })).values.map(v => v.value);
    expect(frame(1, 'interval')).toEqual([0, null, null]);
    expect(frame(1, 'cumulative')).toEqual([0, null, 0.1]);
    expect(frame(2, 'cumulative')).toEqual([0.2, null, 0.4]);
    expect(frame(0, 'cumulative')).toEqual([null, null, 0.1]);
    expect(frame(2, 'cumulative')[0]).toBe(summary.data[0].total);
    expect(prepared.sensors).toContainEqual({ source: 'gauge', id: '100' });
    e.dispose(['pixel']);
    expect(() => frame(0, 'interval')).toThrow(/unavailable/);
  });
  it('uses query-total validity rules and releases prepared indexes', () => {
    const e = createResultsEngine();
    ingest(e, 'gauge', [{ id: '1', data: [point('2026-01-01', -1), point('2026-01-02', '2'), point('2026-01-03', 3)] }]);
    finish(e.preparePlayback({ handles: { gauge: 'gauge' }, rollup: 'Daily', session: 'a' }));
    expect(finish(e.playbackFrame({ session: 'a', index: 1, mode: 'cumulative' })).values[0].value).toBeNull();
    expect(finish(e.playbackFrame({ session: 'a', index: 2, mode: 'cumulative' })).values[0].value).toBe(3);
    finish(e.releasePlayback({ session: 'a' }));
    expect(() => finish(e.playbackFrame({ session: 'a', index: 0 }))).toThrow();
  });
  it('retains hourly boundaries and distinguishes repeated DST hours', () => {
    const first = playbackInterval('2026-11-01T01:00:00-04:00/2026-11-01T01:00:00-05:00', 'hourly');
    const second = playbackInterval('2026-11-01T01:00:00-05:00/2026-11-01T02:00:00-05:00', 'hourly');
    expect(first.endMs - first.startMs).toBe(3600000);
    expect(first.key).not.toBe(second.key);
    expect(first.label).toContain('EDT'); expect(first.label).toContain('EST');
    const spring = playbackInterval('2026-03-08T03:00:00-04:00', '15-minute');
    expect(spring.endMs - spring.startMs).toBe(900000);
    expect(spring.label).toContain('01:45:00 EST');
    expect(playbackInterval('2026-03-08', 'daily').endMs - playbackInterval('2026-03-08', 'daily').startMs).toBe(23 * 3600000);
    expect(playbackInterval('2026-11-01', 'daily').endMs - playbackInterval('2026-11-01', 'daily').startMs).toBe(25 * 3600000);
  });
});
