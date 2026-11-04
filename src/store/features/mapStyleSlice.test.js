import { describe, expect, it } from 'vitest';
import { MAP_LAYERS } from '../config';
import reducer, { addLayers } from './mapStyleSlice';

describe('rainfall layer ordering', () => {
  it.each([2, 100])('keeps radar and its interaction overlays below labels with %i base layers', (count) => {
    const baseLayers = Array.from({ length: count }, (_, index) => ({ id: `base-${index}`, type: 'fill' }));
    const label = { id: 'road-label', type: 'symbol' };
    const state = reducer({ layers: [...baseLayers, label] }, addLayers(MAP_LAYERS));
    const ids = state.layers.map(layer => layer.id);
    const radar = ['HIGHLIGHT-pixel-fill', 'pixel-results', 'HIGHLIGHT-pixel', 'HOVER-pixel'];

    for (const id of radar) expect(ids.indexOf(id)).toBeLessThan(ids.indexOf(label.id));
    expect(ids.filter(id => radar.includes(id))).toEqual(radar);
    expect(state.layers.every(layer => !('BEFORE_SYMBOLS' in layer) && !('INDEX' in layer))).toBe(true);
  });

  it('adds radar layers when the basemap has no symbols', () => {
    const state = reducer({ layers: [{ id: 'background', type: 'background' }] }, addLayers(MAP_LAYERS));
    expect(state.layers.map(layer => layer.id)).toEqual(['background', ...MAP_LAYERS.map(layer => layer.id)]);
  });
});
