import { describe, it, expect, vi } from 'vitest';
import { buildBurstPoints, burstAmounts, burstEnvelope, burstRadiusFactor, burstThreshold,
  createIntervalBursts, BURST_SOURCE, BURST_LAYERS, BURST_OPACITY } from './intervalBursts';

const geometry = { type: 'FeatureCollection', features: [{ type: 'Feature', id: '100',
  geometry: { type: 'Polygon', coordinates: [[[-80, 40], [-79.99, 40], [-79.99, 40.01], [-80, 40.01], [-80, 40]]] }
}] };
const timeline = Array.from({ length: 10 }, (_, i) => ({ startMs: i * 1000, endMs: (i + 1) * 1000 }));
const frame = (index, value, intervalValue = value) => ({ index, interval: timeline[index], values: [
  { source: 'pixel', id: '100', value, intervalValue }, { source: 'gauge', id: '100', value: 99, intervalValue: 99 }
] });
const playback = (overrides = {}) => ({ key: 'a', generation: 0, mode: 'combined', playing: false,
  timeline, scales: { cumulative: 'breaks_050' }, ...overrides });

function setup() {
  let time = 0, serial = 0;
  const callbacks = new Map(), sources = new Map(), states = new Map();
  let layers = [{ id: 'pixel-results' }, { id: 'HOVER-pixel' }, { id: 'gauge-results' }];
  const map = {
    getLayer: id => layers.find(layer => layer.id === id), getStyle: () => ({ layers }),
    addLayer: vi.fn((layer, before) => layers.splice(before ? layers.findIndex(l => l.id === before) : layers.length, 0, layer)),
    removeLayer: id => { layers = layers.filter(layer => layer.id !== id); },
    getSource: id => sources.get(id),
    addSource: vi.fn((id, data) => sources.set(id, { ...data, setData: vi.fn() })),
    removeSource: id => { sources.delete(id); states.clear(); },
    setFeatureState: vi.fn(({ id }, state) => states.set(id, state))
  };
  const settled = vi.fn();
  const bursts = createIntervalBursts(map, { now: () => time,
    requestFrame: cb => { callbacks.set(++serial, cb); return serial; }, cancelFrame: id => callbacks.delete(id),
    hidden: () => false, onSettled: settled });
  return { map, bursts, states, settled, callbacks,
    at(t) { time = t; },
    tick(t) { time = t; const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(cb => cb(t)); },
    replaceStyle() { sources.clear(); states.clear(); layers = [{ id: 'pixel-results' }, { id: 'HOVER-pixel' }, { id: 'gauge-results' }]; }
  };
}

describe('burst geometry and encoding', () => {
  it('uses cell centroids and equivalent Mercator widths, independent of winding', () => {
    const points = buildBurstPoints(geometry, new Set(['100']));
    expect(points.features).toHaveLength(1);
    expect(points.features[0].geometry.coordinates[0]).toBeCloseTo(-79.995, 6);
    expect(points.features[0].geometry.coordinates[1]).toBeCloseTo(40.005, 5);
    expect(points.features[0].properties.cellWidthAtZoom0).toBeGreaterThan(0);
    const reversed = structuredClone(geometry);
    reversed.features[0].geometry.coordinates[0].reverse();
    expect(buildBurstPoints(reversed, new Set(['100'])).features[0].properties.cellWidthAtZoom0)
      .toBeCloseTo(points.features[0].properties.cellWidthAtZoom0, 10);
    expect(buildBurstPoints(geometry, new Set(['999'])).features).toEqual([]);
  });
  it('scales area, caps at 1.5 cell diameters, and hides dry or missing values', () => {
    expect(burstThreshold(playback())).toBe(0.5);
    expect(burstRadiusFactor(0.5, 0.5)).toBe(0.75);
    expect(burstRadiusFactor(0.125, 0.5)).toBe(0.375);
    expect(burstRadiusFactor(3, 0.5)).toBe(0.75);
    for (const amount of [null, 0, -1, undefined]) expect(burstRadiusFactor(amount, 0.5)).toBe(0);
    expect(burstEnvelope(0)).toEqual({ growth: 0, opacity: 0 });
    expect(burstEnvelope(0.4)).toEqual({ growth: 1, opacity: BURST_OPACITY });
    expect(burstEnvelope(0.8).opacity).toBeLessThan(BURST_OPACITY / 2);
    expect(burstEnvelope(1).opacity).toBe(0);
  });
  it('includes skipped rainfall, excludes gauges, and resets to the selected interval', () => {
    expect(burstAmounts(frame(5, 0.8, 0.1), frame(1, 0.2)).get('100')).toBeCloseTo(0.6);
    expect(burstAmounts(frame(5, 0.8, 0.1), null).get('100')).toBe(0.1);
    expect(burstAmounts(frame(5, 0.2, null), frame(1, 0.2)).get('100')).toBe(0);
    expect(burstAmounts(frame(5, 0.2, 0.2), frame(1, null)).get('100')).toBe(0.2);
    expect(burstAmounts(frame(5, null), frame(1, null)).get('100')).toBe(0);
  });
});

describe('burst map lifecycle', () => {
  it.each([1, -1])('animates a paused step in direction %i through growth and fade before settling', direction => {
    const s = setup();
    s.bursts.applyFrame(frame(3, 0.5), playback({ playing: true }), geometry);
    const p = playback({ generation: 1, step: { from: 3, delta: direction } });
    const selected = frame(3 + direction, 0.6, 0.125);
    s.bursts.applyFrame(selected, p, geometry);
    expect(s.bursts.inspect()).toMatchObject({ animated: true, staticRings: false });
    s.tick(100); expect(s.states.get('100').radius0).toBeCloseTo(0.375);
    s.tick(200); expect(s.states.get('100').opacity0).toBeLessThan(BURST_OPACITY / 2);
    s.replaceStyle(); s.bursts.restore(p, geometry); s.bursts.applyFrame(selected, p, geometry);
    expect(s.bursts.inspect().emitted).toBe(2);
    s.tick(251); expect(s.bursts.inspect()).toMatchObject({ animated: false, staticRings: true });
    expect(s.states.get('100').radius0).toBeCloseTo(0.375);
    expect(s.settled).toHaveBeenCalledOnce();
  });
  it('rescales and restores a running burst without resetting its age or emitting again', () => {
    const s = setup(), f = frame(0, 0.125), p = playback({ playing: true });
    s.bursts.applyFrame(f, p, geometry);
    s.tick(100);
    expect(s.states.get('100').radius0).toBe(0.375);
    const changed = { ...p, scales: { cumulative: 'breaks_005' } };
    s.bursts.sync(changed, geometry);
    expect(s.states.get('100').radius0).toBe(0.75);
    s.tick(200);
    const opacity = s.states.get('100').opacity0;
    expect(opacity).toBeLessThan(BURST_OPACITY / 2);
    s.replaceStyle(); s.bursts.restore(changed, geometry); s.bursts.applyFrame(f, changed, geometry);
    expect(s.states.get('100').opacity0).toBe(opacity);
    expect(s.bursts.inspect().emitted).toBe(1);
    s.tick(260);
    expect(s.bursts.inspect()).toMatchObject({ activeBursts: 0, animated: false });
  });
  it('shows static selected intervals, rescales without source writes and restores resources', () => {
    const s = setup(), f = frame(2, 0.7, 0.125), p = playback();
    s.bursts.applyFrame(f, p, geometry);
    expect(s.states.get('100').radius0).toBe(0.375);
    expect(s.states.get('100').opacity0).toBe(BURST_OPACITY);
    expect(s.map.getStyle().layers.map(l => l.id)).toEqual(['pixel-results', ...BURST_LAYERS, 'HOVER-pixel', 'gauge-results']);
    expect(s.map.getLayer(BURST_LAYERS[0]).paint['circle-opacity']).toBe(0);
    s.bursts.sync(playback({ scales: { cumulative: 'breaks_005' } }), geometry);
    expect(s.states.get('100').radius0).toBe(0.75);
    expect(s.map.getSource(BURST_SOURCE).setData).not.toHaveBeenCalled();
    s.replaceStyle(); s.bursts.restore(p, geometry); s.bursts.applyFrame(f, p, geometry);
    expect(s.states.get('100').radius0).toBe(0.375);
    expect(s.bursts.inspect()).toMatchObject({ emitted: 0, animated: false, points: 1 });
    s.bursts.dispose();
    expect(s.map.getSource(BURST_SOURCE)).toBeUndefined(); expect(s.callbacks.size).toBe(0);
    s.map.addSource(BURST_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    s.bursts.restore({ mode: 'total' }, geometry);
    expect(s.map.getSource(BURST_SOURCE)).toBeUndefined();
  });
  it('starts on applied frames, aggregates gaps, overlaps and finishes before settling', () => {
    const s = setup(), p = playback({ playing: true });
    s.bursts.applyFrame(frame(0, 0.1), playback(), geometry);
    s.bursts.sync(p, geometry);
    expect(s.states.get('100').opacity0).toBe(0);
    s.at(100); const applied = frame(3, 0.4, 0.1); s.bursts.applyFrame(applied, p, geometry);
    expect(s.bursts.summary()).toMatchObject({ count: 3, startMs: 1000, endMs: 4000 });
    expect(s.bursts.summary().amounts.get('100')).toBeCloseTo(0.3);
    s.tick(200);
    expect(s.states.get('100').radius0).toBeCloseTo(0.75 * Math.sqrt(0.6));
    s.bursts.applyFrame(applied, p, geometry);
    expect(s.bursts.inspect().emitted).toBe(1);
    s.at(201); s.bursts.applyFrame(frame(9, 0.8, 0.2), p, geometry);
    expect(s.bursts.inspect().activeBursts).toBe(2);
    s.bursts.sync(playback(), geometry);
    expect(s.bursts.inspect().animated).toBe(true);
    s.tick(500);
    expect(s.bursts.inspect()).toMatchObject({ staticRings: true, animated: false, activeBursts: 0 });
    expect(s.states.get('100').radius0).toBeCloseTo(0.75 * Math.sqrt(0.4));
    expect(s.settled).toHaveBeenCalledOnce();
  });
  it('bounds overlap and resets seeks, replay, pauses and result identity', () => {
    const s = setup(), p = playback({ playing: true });
    for (let i = 0; i < 7; i++) { s.at(i * 10); s.bursts.applyFrame(frame(i, i / 10, 0.1), p, geometry); }
    expect(s.bursts.inspect().activeBursts).toBeLessThanOrEqual(4);
    s.bursts.sync(playback(), geometry);
    expect(s.bursts.inspect()).toMatchObject({ animated: false, staticRings: true });
    const seek = playback({ generation: 1 });
    s.bursts.applyFrame(frame(1, 0.9, 0.05), seek, geometry);
    expect(s.states.get('100').radius0).toBeCloseTo(0.75 * Math.sqrt(0.1));
    s.at(1000); s.bursts.applyFrame(frame(0, 0.1), playback({ playing: true, generation: 2 }), geometry);
    s.tick(1100); expect(s.states.get('100').radius0).toBeCloseTo(0.75 * Math.sqrt(0.2));
    expect(s.map.addSource).toHaveBeenCalledTimes(1);
    expect(s.map.getSource(BURST_SOURCE).setData).not.toHaveBeenCalled();
    s.bursts.sync(playback({ key: 'replacement' }), geometry);
    expect(s.bursts.inspect()).toMatchObject({ animated: false, points: 0 });
    s.bursts.sync({ mode: 'total' }, geometry);
    expect(s.map.getSource(BURST_SOURCE)).toBeUndefined(); expect(s.callbacks.size).toBe(0);
  });
});
