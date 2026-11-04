import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { openResult, ready, state, selectMode, selectScale } from './helpers/playback';
import { largeRainfall } from './helpers/largeRainfall';

const source = 'rainfall-interval-bursts';
const layers = Array.from({ length: 4 }, (_, i) => `${source}-${i}`);
const ringState = page => page.evaluate(source => window.__RAINFALL_MAP__.getFeatureState({ source, id: '100' }), source);

test('combined rings share the cumulative legend, preserve gauges, restore and clean up', async ({ page }, info) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const data = [{ id: '100', data: [0.125, 0.375, null, 0, 0.2].map((val, i) => ({ ts: new Date(Date.UTC(2025, 8, 30, 12, i * 5)).toISOString(), val })) }];
  const api = await openResult(page, data, '15-minute', { mixed: true });
  await selectMode(page, 'cumulative'); await ready(page);
  await selectScale(page, '10 in.');
  await selectMode(page, 'combined'); await ready(page);
  await expect(page.locator('#legend-scale-dropdown-button')).toHaveText('10 in.');
  // await expect(page.locator('.burst-key')).toContainText('Full-size ring: 1 in.');
  expect((await ringState(page)).radius0).toBeCloseTo(0.75 * Math.sqrt(0.125));
  const mapInfo = await page.evaluate(({ source, layers }) => {
    const map = window.__RAINFALL_MAP__;
    map.jumpTo({ center: [-79.998, 40.422], zoom: 14 });
    const sourceObject = map.getSource(source);
    window.burstSourceWrites = 0;
    const original = sourceObject.setData;
    sourceObject.setData = function(...args) { window.burstSourceWrites++; return original.apply(this, args); };
    return { layers: map.getStyle().layers.map(l => l.id), paint: map.getLayer(layers[0]).paint,
      gauge: map.getFeatureState({ source: 'gauge', id: '8' }), points: window.__RAINFALL_BURSTS__.inspect().points };
  }, { source, layers });
  expect(mapInfo.points).toBe(1);
  expect(mapInfo.gauge.rainfall).toBe(0.125);
  expect(mapInfo.paint['circle-opacity']).toBe(0);
  expect(mapInfo.paint['circle-stroke-color']).toBe('#000000');
  expect(mapInfo.layers.indexOf(layers[0])).toBeGreaterThan(mapInfo.layers.indexOf('pixel-results'));
  expect(mapInfo.layers.indexOf(layers[3])).toBeLessThan(mapInfo.layers.indexOf('HOVER-pixel'));
  expect(mapInfo.layers.indexOf(layers[3])).toBeLessThan(mapInfo.layers.indexOf('gauge-results'));
  await page.waitForFunction(layer => window.__RAINFALL_MAP__.queryRenderedFeatures({ layers: [layer] }).length > 0, layers[0]);
  await page.screenshot({ path: info.outputPath('combined-static-rings.png') });
  await page.evaluate(() => window.__RAINFALL_MAP__.jumpTo({ center: [-79.998, 40.422], zoom: 13, bearing: 35, pitch: 25 }));
  await page.waitForFunction(layer => {
    const map = window.__RAINFALL_MAP__;
    return map.queryRenderedFeatures(map.project([-79.998, 40.422]), { layers: [layer] }).some(f => f.id === 100 || f.id === '100');
  }, layers[0]);
  await page.evaluate(() => window.__RAINFALL_MAP__.jumpTo({ zoom: 14, bearing: 0, pitch: 0 }));
  await selectScale(page, '5 in.');
  await expect.poll(async () => (await ringState(page)).radius0).toBe(0.375);
  expect(await page.evaluate(() => window.burstSourceWrites)).toBe(0);
  await selectMode(page, 'cumulative'); await ready(page);
  await expect(page.locator('#legend-scale-dropdown-button')).toHaveText('5 in.');
  expect(await page.evaluate(source => Boolean(window.__RAINFALL_MAP__.getSource(source)), source)).toBe(false);
  await selectMode(page, 'combined'); await ready(page);

  // A real style reload loses all feature state. It must restore both layers without emitting a burst.
  await page.evaluate(() => { const map = window.__RAINFALL_MAP__; map.setStyle(map.getStyle(), { diff: false }); });
  await page.waitForFunction(() => window.__RAINFALL_MAP__.isStyleLoaded());
  await expect.poll(async () => (await ringState(page)).radius0).toBe(0.375);
  expect(await page.evaluate(() => window.__RAINFALL_BURSTS__.inspect().emitted)).toBe(0);
  await page.evaluate(() => {
    const map = window.__RAINFALL_MAP__, lngLat = { lng: -79.998, lat: 40.422 };
    map.fire('mousemove', { point: map.project(lngLat), lngLat });
  });
  await expect(page.locator('.tooltip-body').filter({ hasText: 'Cumulative rainfall: 0.125' })).toBeVisible();
  await expect(page.locator('.tooltip-body').filter({ hasText: 'Interval rainfall: 0.125' })).toBeVisible();
  await page.evaluate(() => window.__APP_STORE__.dispatch({ type: 'playback/seekPlayback', payload: 2 })); await ready(page);
  expect((await state(page)).frame.values[0].value).toBe(0.5);
  expect((await ringState(page)).opacity0).toBe(0);
  await expect(page.locator('.tooltip-body').filter({ hasText: 'Interval rainfall: No observations available.' })).toBeVisible();
  await page.evaluate(() => window.__APP_STORE__.dispatch({ type: 'playback/seekPlayback', payload: 3 })); await ready(page);
  expect((await ringState(page)).opacity0).toBe(0);
  await page.getByRole('button', { name: 'Play playback' }).click();
  await expect.poll(async () => (await state(page)).frame.index).toBe(4);
  await expect.poll(() => page.evaluate(() => window.__RAINFALL_BURSTS__.inspect().animated)).toBe(false);
  expect((await ringState(page)).radius0).toBeCloseTo(0.75 * Math.sqrt(0.4));
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Playback speed', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('combined-mobile.png') });
  await page.evaluate(() => {
    const store = window.__APP_STORE__, item = store.getState().fetchKwargs.legacyRealtime.history[0];
    store.dispatch({ type: 'fetchKwargs/removeFetchHistoryItem', payload: { contextType: 'legacyRealtime', requestId: item.requestId } });
  });
  await expect.poll(() => page.evaluate(source => Boolean(window.__RAINFALL_MAP__.getSource(source)), source)).toBe(false);
  expect(await page.evaluate(() => window.__RAINFALL_BURSTS__.inspect())).toMatchObject({ animated: false, points: 0, activeBursts: 0 });
  expect(api.rainfallRequests).toHaveLength(2); expect(errors).toEqual([]);
});

test('combined playback animates, pauses on hidden tabs and credits its inspiration', async ({ page }) => {
  const api = await openResult(page, largeRainfall(12, 101));
  await selectMode(page, 'combined'); await ready(page);
  await page.evaluate(source => {
    const map = window.__RAINFALL_MAP__;
    window.animatedSourceWrites = 0;
    for (const id of ['pixel', source]) {
      const data = map.getSource(id), original = data.setData;
      data.setData = function(...args) { window.animatedSourceWrites++; return original.apply(this, args); };
    }
  }, source);
  await page.getByRole('button', { name: 'Play playback' }).click();
  await expect.poll(() => page.evaluate(() => window.__RAINFALL_BURSTS__.inspect().emitted)).toBeGreaterThan(2);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(async () => (await state(page)).playing).toBe(false);
  expect(await page.evaluate(() => window.__RAINFALL_BURSTS__.inspect())).toMatchObject({ animated: false, staticRings: true, activeBursts: 0 });
  expect(await page.evaluate(() => window.animatedSourceWrites)).toBe(0);
  expect(api.rainfallRequests).toHaveLength(1);
  await page.evaluate(() => { delete document.hidden; });
  await page.locator('#AboutButton').click();
  await page.getByRole('tab', { name: 'Under the Hood' }).click();
  await expect(page.getByRole('link', { name: 'Adam Pearce', exact: true })).toHaveAttribute('href', 'https://roadtolarissa.com/');
  await expect(page.getByRole('link', { name: 'The New York Times’ Hurricane Harvey visualization' })).toHaveAttribute('href', 'https://www.nytimes.com/interactive/2017/08/24/us/hurricane-harvey-texas.html');
});

test('full radar grid combined playback remains bounded at six intervals per second', async ({ page }, info) => {
  test.skip(process.env.RAINFALL_BENCHMARK !== '1', 'Production benchmark only');
  test.setTimeout(180000);
  const geometry = JSON.parse(fs.readFileSync('public/static/data/pixels.geojson', 'utf8'));
  geometry.features.forEach((feature, i) => { feature.id = String(100 + i); feature.properties.pixel_id = feature.id; });
  const data = largeRainfall(geometry.features.length, 101);
  for (const series of data) series.data[0].val = 0.125;
  const api = await openResult(page, data, '5-minute', { geometry });
  await page.evaluate(() => window.__RAINFALL_MAP__.fitBounds([[-80.4, 40.1], [-79.65, 40.75]], { duration: 0, padding: 5 }));
  await selectMode(page, 'combined'); await ready(page);
  expect(await page.evaluate(() => window.__RAINFALL_BURSTS__.inspect().points)).toBe(2313);
  await page.waitForFunction(layer => new Set(window.__RAINFALL_MAP__.queryRenderedFeatures({ layers: [layer] }).map(f => f.id)).size === 2313, layers[0]);
  await page.evaluate(() => {
    const store = window.__APP_STORE__;
    window.gridMetrics = { start: performance.now(), frames: [], maxBursts: 0 };
    let previous;
    window.stopGridMetrics = store.playbackRuntime.subscribePresentation(() => {
      const p = { frame: store.playbackRuntime.getCurrentFrame() };
      if (p.frame && previous !== p.frame) {
        previous = p.frame;
        window.gridMetrics.frames.push({ at: performance.now(), index: p.frame.index });
        window.gridMetrics.maxBursts = Math.max(window.gridMetrics.maxBursts, window.__RAINFALL_BURSTS__.inspect().activeBursts);
      }
    });
    store.dispatch({ type: 'playback/togglePlayback' });
  });
  await page.waitForFunction(() => !window.__APP_STORE__.getState().playback.playing, null, { timeout: 22000 });
  const metrics = await page.evaluate(() => { window.stopGridMetrics(); return window.gridMetrics; });
  expect(metrics.frames.at(-1).index).toBe(100);
  expect(metrics.frames.at(-1).at - metrics.start).toBeLessThan(100 * 1000 / 6 + 500);
  expect(metrics.maxBursts).toBeLessThanOrEqual(4);
  expect((await page.evaluate(() => window.__APP_STORE__.inspectPlayback())).maxCachedFrames).toBeLessThanOrEqual(3);
  expect(api.rainfallRequests).toHaveLength(1);
  await info.attach('full-grid-performance.json', { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' });
});
