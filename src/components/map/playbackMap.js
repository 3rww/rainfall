import { buildRainfallColorStyleExp } from '../../store/utils/mb';
import { LEGEND_BREAKS, LAYERS_W_RESULTS } from '../../store/config';

export function applyPlaybackFrame(map, frame) {
  for (const { source, id, value } of frame.values) {
    if (map.getSource(source)) map.setFeatureState({ source, id }, { rainfall: value, rainfallAvailable: value !== null });
  }
}
export function clearPlaybackFrame(map, frame) {
  for (const { source, id } of frame?.values || []) {
    if (!map.getSource(source)) continue;
    map.removeFeatureState({ source, id }, 'rainfall');
    map.removeFeatureState({ source, id }, 'rainfallAvailable');
  }
}
export function applyPlaybackStyle(map, playback) {
  const active = playback.mode !== 'total';
  const value = active ? ['feature-state', 'rainfall'] : ['get', 'total'];
  const available = active ? ['boolean', ['feature-state', 'rainfallAvailable'], false] : ['!=', ['coalesce', ['get', 'total'], ''], ''];
  const { colorExp } = buildRainfallColorStyleExp(value, LEGEND_BREAKS[playback.scales[playback.mode]]);
  for (const id of LAYERS_W_RESULTS) {
    const layer = map.getLayer(id);
    if (!layer) continue;
    map.setPaintProperty(id, `${layer.type}-color`, colorExp);
    map.setPaintProperty(id, `${layer.type}-opacity`, ['case', available, layer.type === 'circle' ? 1 : 0.8, 0]);
    if (layer.type === 'circle') map.setPaintProperty(id, 'circle-stroke-opacity', ['case', available, 1, 0]);
  }
}
