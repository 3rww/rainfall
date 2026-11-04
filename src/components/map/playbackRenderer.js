import { createIntervalBursts } from './intervalBursts';
import { applyPlaybackFrame, clearPlaybackFrame, applyPlaybackStyle } from './playbackMap';
import { createCustomRenderer, CUSTOM_LAYERS } from './webgl/renderer';
import { pausePlayback, seekPlayback, playbackScale } from '../../store/features/playbackSlice';

// Production CPU, timing, and visual gates: docs/map-playback.md (2026-11-03).
export const DEFAULT_PLAYBACK_RENDERER = 'custom';
export function rendererOverride(search = globalThis.location?.search || '') {
  const value = new URLSearchParams(search).get('playbackRenderer');
  return value === 'native' || value === 'custom' ? value : DEFAULT_PLAYBACK_RENDERER;
}
export function unsupportedReason(map) {
  if (map.getProjection()?.name !== 'mercator') return 'Custom playback requires the Mercator projection.';
  if (map.getTerrain()) return 'Custom playback does not support terrain.';
  return null;
}

/** Imperative Mapbox adapter shared by both backends, independent of React rendering. */
export function createPlaybackRenderer(map, store, { requested = rendererOverride(), onSettled = () => {} } = {}) {
  let settings = store.getState().playback, geometry = null, frame = null, payload = null, pending = null;
  let custom = null, effective = 'native', fallbackReason = null, failed = false, lost = false, disposed = false;
  let applying = false, dirty = true;
  let compatibilityReason = requested === 'custom' ? unsupportedReason(map) : null;
  let styleKey = '', nativeFrame = null, nativeUploads = 0;
  const native = createIntervalBursts(map, { onSettled });
  const sources = () => ({ pixel: store.getState().refData.pixel?.data, gauge: store.getState().refData.gauge?.data });
  function removeCustom() {
    for (const id of CUSTOM_LAYERS) if (map.getLayer(id)) map.removeLayer(id);
    custom?.dispose(); custom = null;
  }
  function hideNative(hidden) {
    for (const id of ['pixel-results', 'gauge-results']) if (map.getLayer(id)) {
      const visibility = hidden ? 'none' : 'visible';
      if ((map.getLayoutProperty(id, 'visibility') || 'visible') !== visibility) map.setLayoutProperty(id, 'visibility', visibility);
    }
  }
  function fallback(error) {
    if (disposed || failed || lost) return;
    failed = true; fallbackReason = error.message; effective = 'native'; removeCustom(); styleKey = '';
    refresh();
  }
  function ensure() {
    if (disposed || lost) return false;
    if (!dirty && (map.getLayer('pixel-results') || map.getLayer('gauge-results'))) return settings.mode !== 'total' && Boolean(geometry?.sensors.length);
    if (!map.isStyleLoaded() && !map.getLayer('pixel-results') && !map.getLayer('gauge-results')) { dirty = true; return false; }
    dirty = false;
    const active = settings.mode !== 'total';
    const reason = requested === 'custom' ? unsupportedReason(map) : null;
    const selected = active && requested === 'custom' && !reason && !failed ? 'custom' : 'native';
    if (reason) fallbackReason = reason;
    else if (!failed) fallbackReason = null;
    if (effective !== selected) {
      effective = selected; styleKey = '';
      if (effective === 'native') removeCustom();
      else { clearPlaybackFrame(map, nativeFrame); nativeFrame = null; native.dispose(); }
    }
    if (!active) {
      removeCustom(); native.dispose(); clearPlaybackFrame(map, nativeFrame); nativeFrame = null; frame = null; payload = null;
    }
    const nextStyle = `${settings.mode}:${playbackScale(settings)}:${effective}`;
    if (styleKey !== nextStyle) { applyPlaybackStyle(map, settings); styleKey = nextStyle; }
    hideNative(active && effective === 'custom');
    if (!active) return false;
    if (!geometry?.sensors.length) { dirty = true; return false; }
    if (effective === 'custom') {
      try {
        if (!custom) { custom = createCustomRenderer(map, { onFailure: fallback, onSettled }); custom.updateSettings(settings); }
        custom.updateGeometry({ ...geometry, ...sources() });
        custom.updateSettings(settings);
        if (!map.getLayer('pixel-results') && !map.getLayer('gauge-results')) { dirty = true; return false; }
        // Each overlay occupies the native visual position; hover/selection remain native.
        const nativeLayers = map.getStyle().layers;
        for (const [index, anchor] of [[0, 'pixel-results'], [1, 'pixel-results'], [2, 'gauge-results']]) {
          const layer = custom.layers[index];
          if (map.getLayer(layer.id)) continue;
          if (index === 1) {
            const position = nativeLayers.findIndex(l => l.id === anchor);
            map.addLayer(layer, position >= 0 ? nativeLayers[position + 1]?.id : undefined);
          } else map.addLayer(layer, map.getLayer(anchor) ? anchor : undefined);
          if (layer.initializationError) throw layer.initializationError;
        }
      } catch (error) { fallback(error); return effective === 'native'; }
    }
    return true;
  }
  function apply() {
    if (applying) return;
    applying = true;
    try {
    if (!ensure()) return;
    if (effective === 'custom') {
      if (frame && payload) custom.present(frame, { ...payload, settings });
    } else {
      native.sync(settings, sources().pixel);
      if (frame) { applyPlaybackFrame(map, frame); nativeUploads++; nativeFrame = frame; native.applyFrame(frame, settings, sources().pixel); }
    }
    if (pending) pending.submitted = true;
    map.triggerRepaint();
    } finally { applying = false; }
  }
  function refresh() { styleKey = ''; dirty = true; apply(); }
  function onRender() {
    if (requested === 'custom' && settings.mode !== 'total') {
      const reason = unsupportedReason(map);
      if (reason !== compatibilityReason) { compatibilityReason = reason; queueMicrotask(() => { if (!disposed) refresh(); }); return; }
    }
    if (pending?.submitted && !lost && (effective !== 'custom' || custom?.didDraw(frame))) { const done = pending; pending = null; done.finish(true); }
  }
  function onStyleLoad() { custom?.restore(); native.restore(settings, sources().pixel); refresh(); }
  function onStyleData() {
    if (!applying && pending && !pending.submitted) apply();
    // Public style events also cover projection/terrain changes.
    if (effective === 'custom' && unsupportedReason(map)) refresh();
  }
  function onContextLost() {
    lost = true; custom?.contextLost();
    const index = store.playbackRuntime.getCurrentFrame()?.index;
    store.dispatch(index === undefined ? pausePlayback() : seekPlayback(index));
  }
  function onContextRestored() { lost = false; custom?.restore(); refresh(); }
  map.on('render', onRender); map.on('style.load', onStyleLoad); map.on('styledata', onStyleData);
  map.on('webglcontextlost', onContextLost); map.on('webglcontextrestored', onContextRestored);
  return {
    updateGeometry(next) { if (!geometry || geometry.key !== next.key || geometry.indexes !== next.indexes) dirty = true; geometry = next; },
    updateSettings(next) {
      const reset = settings.key !== next.key || settings.generation !== next.generation || settings.mode !== next.mode;
      settings = next; dirty = true;
      if (reset) { frame = null; payload = null; }
      if (ensure()) {
        if (effective === 'native') native.sync(settings, sources().pixel);
      }
    },
    present(next, data) {
      frame = next; payload = data;
      return new Promise(resolve => {
        const finish = value => { data.signal.removeEventListener('abort', abort); resolve(value); };
        const abort = () => { if (pending?.finish === finish) pending = null; finish(false); };
        if (data.signal.aborted) { resolve(false); return; }
        pending = { finish, submitted: false }; data.signal.addEventListener('abort', abort, { once: true });
        apply();
      });
    },
    refresh,
    restore(next, data) {
      if (next && data) { frame = next; payload = data; }
      refresh();
    },
    summary: () => effective === 'custom' ? custom?.summary() : native.summary(),
    inspect: () => ({ requestedBackend: requested, backend: effective, fallbackReason, contextLost: lost,
      ...(effective === 'custom' ? custom?.inspect() : { ...native.inspect(), valueUploads: nativeUploads, buffers: 0, textures: 0, programs: 0 }) }),
    dispose() {
      if (disposed) return; disposed = true;
      if (pending) { pending.finish(false); pending = null; }
      map.off('render', onRender); map.off('style.load', onStyleLoad); map.off('styledata', onStyleData);
      map.off('webglcontextlost', onContextLost); map.off('webglcontextrestored', onContextRestored);
      removeCustom(); native.dispose(); clearPlaybackFrame(map, nativeFrame); hideNative(false);
    }
  };
}
