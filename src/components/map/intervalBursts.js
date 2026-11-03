import { LEGEND_BREAKS } from '../../store/config';
import { playbackScale } from '../../store/features/playbackSlice';

// Visual tuning: diameter is relative to a radar cell, amounts to the cumulative legend.
export const BURST_CELL_DIAMETER_FACTOR = 1.5;
export const BURST_LEGEND_FRACTION = 0.10;
export const BURST_OPACITY = 0.25;
export const BURST_STROKE_WIDTH = 0.75;
export const BURST_GROWTH_FRACTION = 0.40;
export const BURST_DURATION_FACTOR = 2.5;
export const BURST_INITIAL_DURATION_MS = 250;
export const BURST_MAX_DURATION_MS = 400;
export const BURST_SLOTS = 4;
export const BURST_SOURCE = 'rainfall-interval-bursts';
export const BURST_LAYERS = Array.from({ length: BURST_SLOTS }, (_, i) => `${BURST_SOURCE}-${i}`);

export const burstThreshold = playback => BURST_LEGEND_FRACTION * Math.max(...LEGEND_BREAKS[playbackScale(playback)]);
export const burstRadiusFactor = (amount, threshold) => amount > 0 && threshold > 0
  ? BURST_CELL_DIAMETER_FACTOR / 2 * Math.sqrt(Math.min(amount / threshold, 1)) : 0;

export function burstEnvelope(progress) {
  if (progress <= 0 || progress >= 1) return { growth: 0, opacity: 0 };
  const growth = 1 - (1 - Math.min(1, progress / BURST_GROWTH_FRACTION)) ** 3;
  const fade = Math.max(0, (progress - BURST_GROWTH_FRACTION) / (1 - BURST_GROWTH_FRACTION));
  return { growth, opacity: BURST_OPACITY * (1 - fade) ** 2 };
}

const mercator = ([lng, lat]) => {
  const radians = Math.max(-85.051129, Math.min(85.051129, lat)) * Math.PI / 180;
  return [(lng + 180) / 360, (1 - Math.log(Math.tan(Math.PI / 4 + radians / 2)) / Math.PI) / 2];
};
const lngLat = ([x, y]) => [x * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI];

// Work relative to a local origin to avoid cancellation for small polygons.
function ringMetrics(coordinates) {
  if (coordinates.length < 4) return null;
  const points = coordinates.map(mercator), [ox, oy] = points[0];
  let twiceArea = 0, cx = 0, cy = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const x = points[i][0] - ox, y = points[i][1] - oy;
    const nx = points[i + 1][0] - ox, ny = points[i + 1][1] - oy;
    const cross = x * ny - nx * y;
    twiceArea += cross; cx += (x + nx) * cross; cy += (y + ny) * cross;
  }
  if (!Number.isFinite(twiceArea) || twiceArea === 0) return null;
  return { area: Math.abs(twiceArea / 2), x: ox + cx / (3 * twiceArea), y: oy + cy / (3 * twiceArea) };
}

export function buildBurstPoints(geojson, ids) {
  const features = [];
  for (const feature of geojson?.features || []) {
    const id = String(feature.id);
    if (!ids.has(id)) continue;
    const geometry = feature.geometry;
    const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates]
      : geometry?.type === 'MultiPolygon' ? geometry.coordinates : [];
    let area = 0, cx = 0, cy = 0;
    for (const polygon of polygons) {
      polygon.forEach((ring, index) => {
        const metrics = ringMetrics(ring);
        if (!metrics) return;
        const weight = metrics.area * (index === 0 ? 1 : -1);
        area += weight; cx += metrics.x * weight; cy += metrics.y * weight;
      });
    }
    if (!(area > 0)) continue;
    features.push({ type: 'Feature', id, properties: { cellWidthAtZoom0: 512 * Math.sqrt(area) },
      geometry: { type: 'Point', coordinates: lngLat([cx / area, cy / area]) } });
  }
  return { type: 'FeatureCollection', features };
}

export function burstLayer(slot) {
  const radius = ['coalesce', ['feature-state', `radius${slot}`], 0];
  const width = ['get', 'cellWidthAtZoom0'];
  return { id: BURST_LAYERS[slot], type: 'circle', source: BURST_SOURCE, paint: {
    'circle-color': '#000000', 'circle-opacity': 0,
    'circle-stroke-color': '#000000', 'circle-stroke-width': BURST_STROKE_WIDTH,
    'circle-stroke-opacity': ['coalesce', ['feature-state', `opacity${slot}`], 0],
    'circle-radius': ['interpolate', ['exponential', 2], ['zoom'],
      0, ['*', width, radius], 24, ['*', 2 ** 24, width, radius]],
    'circle-pitch-alignment': 'map', 'circle-pitch-scale': 'map',
    'circle-radius-transition': { duration: 0 }, 'circle-stroke-opacity-transition': { duration: 0 }
  } };
}

// Only consecutive *applied* frames may contribute a cumulative difference.
export function burstAmounts(frame, previous) {
  const before = new Map((previous?.values || []).filter(v => v.source === 'pixel').map(v => [v.id, v.value]));
  return new Map(frame.values.filter(v => v.source === 'pixel').map(v => [v.id,
    previous ? (v.value === null ? 0 : Math.max(0, v.value - (before.get(v.id) ?? 0))) : v.intervalValue ?? 0
  ]));
}

/** Owns map resources and animation; Redux only supplies applied frames and controls. */
export function createIntervalBursts(map, {
  now = () => performance.now(), requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame,
  hidden = () => document.hidden, onSettled = () => {}
} = {}) {
  let identity = '', generation = null, geometry = null, points = null, source = null, frame = null, playback = null;
  let animation = null, lastAppliedAt = null, playing = false, finishing = false, staticRings = false;
  let nextSlot = 0, summary = null, emitted = 0;
  let cohorts = Array(BURST_SLOTS).fill(null);
  const written = new Map();

  function stopAnimation() { if (animation !== null) cancelFrame(animation); animation = null; }
  function removeResources() {
    for (const id of BURST_LAYERS) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(BURST_SOURCE)) map.removeSource(BURST_SOURCE);
    source = null; written.clear();
  }
  function reset() {
    stopAnimation(); removeResources();
    identity = ''; generation = null; geometry = null; points = null; frame = null; lastAppliedAt = null;
    playing = false; finishing = false; staticRings = false; nextSlot = 0; summary = null;
    cohorts = Array(BURST_SLOTS).fill(null);
  }
  function ensureResources() {
    if (!points || !map.getLayer('pixel-results')) return false;
    if (!map.getSource(BURST_SOURCE)) map.addSource(BURST_SOURCE, { type: 'geojson', data: points });
    const currentSource = map.getSource(BURST_SOURCE);
    if (source !== currentSource) { written.clear(); source = currentSource; }
    const layers = map.getStyle().layers;
    const afterFill = layers.findIndex(layer => layer.id === 'pixel-results') + 1;
    const before = layers.slice(afterFill).find(layer => !BURST_LAYERS.includes(layer.id))?.id;
    for (let slot = 0; slot < BURST_SLOTS; slot++) {
      if (!map.getLayer(BURST_LAYERS[slot])) { map.addLayer(burstLayer(slot), before); written.clear(); }
    }
    return true;
  }
  function render(time) {
    if (!ensureResources()) return;
    const threshold = burstThreshold(playback);
    const intervals = staticRings ? burstAmounts(frame, null) : null;
    const envelopes = cohorts.map(cohort => cohort ? burstEnvelope((time - cohort.born) / cohort.duration) : null);
    for (const point of points.features) {
      const state = {};
      for (let slot = 0; slot < BURST_SLOTS; slot++) {
        const amount = staticRings ? (slot === 0 ? intervals.get(point.id) : 0) : cohorts[slot]?.amounts.get(point.id);
        const radius = burstRadiusFactor(amount, threshold);
        state[`radius${slot}`] = radius * (staticRings ? 1 : envelopes[slot]?.growth ?? 0);
        state[`opacity${slot}`] = radius > 0 ? (staticRings ? BURST_OPACITY : envelopes[slot]?.opacity ?? 0) : 0;
      }
      const previous = written.get(point.id);
      if (!previous || Object.keys(state).some(key => previous[key] !== state[key])) {
        map.setFeatureState({ source: BURST_SOURCE, id: point.id }, state);
        written.set(point.id, state);
      }
    }
  }
  function settle() {
    stopAnimation(); cohorts.fill(null); finishing = false; staticRings = Boolean(frame);
    lastAppliedAt = null; summary = null;
    if (frame) render(now());
  }
  function tick(time) {
    animation = null;
    cohorts = cohorts.map(cohort => cohort && time - cohort.born < cohort.duration ? cohort : null);
    if (finishing && !cohorts.some(Boolean)) { settle(); onSettled(); return; }
    render(time);
    if (cohorts.some(Boolean)) animation = requestFrame(tick);
  }

  function sync(next, geojson) {
    if (next.mode !== 'combined') {
      // An in-flight style replacement can reintroduce a previously captured overlay.
      if (identity || map.getSource(BURST_SOURCE)) reset();
      return;
    }
    const key = JSON.stringify([next.key]);
    if (identity !== key) { reset(); identity = key; }
    playback = next;
    if (generation !== next.generation) {
      // Seeking/replaying resets the comparison, but the result's geometry stays put.
      stopAnimation(); cohorts.fill(null); frame = null; lastAppliedAt = null;
      playing = false; finishing = false; staticRings = false; nextSlot = 0; summary = null;
      generation = next.generation;
      if (points) render(now());
    }
    if (geometry !== geojson) {
      removeResources(); geometry = geojson; points = null;
      if (frame) points = buildBurstPoints(geometry, new Set(frame.values.filter(v => v.source === 'pixel').map(v => v.id)));
    }
    if (playing !== next.playing) {
      playing = next.playing;
      if (playing) {
        stopAnimation(); cohorts.fill(null); finishing = false; staticRings = false; summary = null; lastAppliedAt = null;
      } else if (!finishing || hidden()) settle();
    } else if (hidden() && finishing) settle();
    if (frame) render(now());
  }

  function applyFrame(nextFrame, next, geojson) {
    sync(next, geojson);
    if (next.mode !== 'combined') return;
    // A style restore or React reapplication must never create a duplicate burst.
    if (frame === nextFrame) { render(now()); return; }
    const previous = frame && nextFrame.index > frame.index ? frame : null;
    frame = nextFrame;
    if (!points) points = buildBurstPoints(geometry, new Set(frame.values.filter(v => v.source === 'pixel').map(v => v.id)));
    if (!playing) { settle(); return; }
    const time = now();
    const amounts = burstAmounts(frame, previous);
    const duration = lastAppliedAt === null ? BURST_INITIAL_DURATION_MS
      : Math.min(BURST_MAX_DURATION_MS, Math.max(1, time - lastAppliedAt) * BURST_DURATION_FACTOR);
    lastAppliedAt = time; staticRings = false;
    cohorts[nextSlot] = [...amounts.values()].some(value => value > 0) ? { amounts, born: time, duration } : null;
    nextSlot = (nextSlot + 1) % BURST_SLOTS; emitted++;
    summary = previous && frame.index - previous.index > 1 ? {
      index: frame.index, count: frame.index - previous.index, amounts,
      startMs: next.timeline[previous.index + 1].startMs, endMs: frame.interval.endMs
    } : null;
    finishing = frame.index === next.timeline.length - 1;
    render(time);
    if (animation === null && (cohorts.some(Boolean) || finishing)) animation = requestFrame(tick);
  }

  return {
    sync, applyFrame, dispose: reset,
    restore(next, geojson) { written.clear(); sync(next, geojson); },
    summary: () => summary,
    inspect: () => ({ activeBursts: cohorts.filter(Boolean).length, animated: animation !== null,
      points: points?.features.length || 0, emitted, staticRings })
  };
}
