import { expect, it } from 'vitest';
import { rendererOverride, unsupportedReason, DEFAULT_PLAYBACK_RENDERER } from './playbackRenderer';
it('uses a diagnostic URL override without persisting settings',()=>{
  expect(DEFAULT_PLAYBACK_RENDERER).toBe('custom');
  expect(rendererOverride('')).toBe('custom');
  expect(rendererOverride('?playbackRenderer=custom')).toBe('custom');
  expect(rendererOverride('?playbackRenderer=native')).toBe('native');
  expect(rendererOverride('?playbackRenderer=invalid')).toBe(DEFAULT_PLAYBACK_RENDERER);
});
it('requires a Mercator map without terrain',()=>{
  expect(unsupportedReason({getProjection:()=>({name:'mercator'}),getTerrain:()=>null})).toBeNull();
  expect(unsupportedReason({getProjection:()=>({name:'globe'}),getTerrain:()=>null})).toMatch(/Mercator/);
  expect(unsupportedReason({getProjection:()=>({name:'mercator'}),getTerrain:()=>({source:'dem'})})).toMatch(/terrain/);
});
