import { describe, it, expect, vi } from 'vitest';
import { applyPlaybackFrame, clearPlaybackFrame, applyPlaybackStyle } from './playbackMap';
const frame = { values: [{ source: 'pixel', id: '1', value: 0 }, { source: 'gauge', id: '2', value: null }] };
describe('playback map bridge', () => {
  it('updates values without source writes and clears only owned state', () => {
    const source = { setData: vi.fn() };
    const map = { getSource: () => source, setFeatureState: vi.fn(), removeFeatureState: vi.fn() };
    applyPlaybackFrame(map, frame);
    expect(map.setFeatureState).toHaveBeenCalledWith({ source: 'pixel', id: '1' }, { rainfall: 0, rainfallAvailable: true });
    expect(map.setFeatureState).toHaveBeenCalledWith({ source: 'gauge', id: '2' }, { rainfall: null, rainfallAvailable: false });
    clearPlaybackFrame(map, frame);
    expect(map.removeFeatureState.mock.calls.map(c => c[1])).toEqual(['rainfall', 'rainfallAvailable', 'rainfall', 'rainfallAvailable']);
    expect(source.setData).not.toHaveBeenCalled();
  });
  it('uses state expressions only for playback and retains manual scale', () => {
    const map = { getLayer: () => ({ type: 'fill' }), setPaintProperty: vi.fn() };
    const scales = { total: 'breaks_050', interval: 'breaks_005' };
    applyPlaybackStyle(map, { mode: 'interval', scales });
    expect(JSON.stringify(map.setPaintProperty.mock.calls)).toContain('feature-state');
    expect(JSON.stringify(map.setPaintProperty.mock.calls)).toContain('rainfallAvailable');
    map.setPaintProperty.mockClear();
    applyPlaybackStyle(map, { mode: 'total', scales });
    expect(JSON.stringify(map.setPaintProperty.mock.calls)).not.toContain('feature-state');
    expect(JSON.stringify(map.setPaintProperty.mock.calls)).toContain('total');
  });
});
