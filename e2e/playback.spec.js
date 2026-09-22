import { test, expect } from '@playwright/test';
import { registerMockApiRoutes, toColumnarFixtureIfRequested } from './helpers/mockApi';
import { largeRainfall, rainfallGeometry } from './helpers/largeRainfall';
const benchmark = process.env.RAINFALL_BENCHMARK === '1';
const contextType = 'legacyGarr';
async function openResult(page, data, rollup = '5-minute') {
  const api = await registerMockApiRoutes(page, { rainfallData: (_sensor, requestPayload) => toColumnarFixtureIfRequested(data, requestPayload), pixels: rainfallGeometry(data.length) });
  await page.goto(benchmark ? '/rainfall/' : '/');
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();
  await page.waitForFunction(() => window.__APP_STORE__?.getState().stats.latest?.['latest-15min-calibrated-radar']);
  await page.evaluate(({ contextType, count, rollup }) => {
    const store = window.__APP_STORE__;
    store.dispatch({ type: 'progress/switchTab', payload: contextType });
    store.dispatch({ type: 'fetchKwargs/pickSensor', payload: { contextType, sensorLocationType: 'pixel', selectedOptions: Array.from({ length: count }, (_, i) => ({ value: String(100 + i), label: String(100 + i) })) } });
    store.dispatch({ type: 'fetchKwargs/pickInterval', payload: { contextType, rollup } });
  }, { contextType, count: data.length, rollup });
  await expect(page.getByRole('combobox', { name: 'Rainfall map view' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Get Rainfall Data' }).click();
  await expect(page.getByRole('button', { name: 'View and Download Results' }).first()).toBeVisible({ timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.__RAINFALL_MAP__.getLayer('pixel-results')));
  return api;
}
const state = page => page.evaluate(() => window.__APP_STORE__.getState().playback);
const ready = page => expect.poll(async () => (await state(page)).status).toBe('ready');

test('interval and cumulative playback controls, legends, state rendering, and cleanup', async ({ page }, info) => {
  const data = [{ id: '100', data: [null, 0.1, null, 0.2].map((val, i) => ({ ts: new Date(Date.UTC(2025, 8, 30, 12, i * 5)).toISOString(), val })) }];
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const api = await openResult(page, data);
  const mode = page.getByRole('combobox', { name: 'Rainfall map view' });
  await expect(mode).toHaveValue('total');
  await expect(page.getByRole('group', { name: 'Playback controls' })).toHaveCount(0);
  await expect(page.getByRole('slider', { name: 'Rainfall timestep' })).toHaveCount(0);
  await mode.selectOption('interval'); await ready(page);
  await expect(page.getByRole('button', { name: 'Previous timestep' })).toBeDisabled();
  await page.getByRole('button', { name: 'Play playback' }).hover();
  await expect(page.getByRole('tooltip')).toHaveText('Play playback');
  await expect(page.getByRole('button', { name: 'Play playback' }).locator('svg')).toBeVisible();
  await expect(page.getByLabel('0.5 in.', { exact: true })).toBeChecked();
  const layout = await page.locator('.playback-toolbar').evaluate(toolbar => {
    const bounds = selector => {
      const r = toolbar.querySelector(selector).getBoundingClientRect();
      return { left: r.left, right: r.right, centerY: r.top + r.height / 2 };
    };
    return { mode: bounds('.playback-mode'), controls: bounds('.btn-group'), slider: bounds('.playback-slider'), timestamp: bounds('.playback-label') };
  });
  expect(layout.controls.left).toBeGreaterThan(layout.mode.right);
  expect(layout.slider.right - layout.slider.left).toBeGreaterThan(170);
  if (Math.abs(layout.slider.centerY - layout.controls.centerY) < 2) {
    expect(layout.slider.left).toBeGreaterThan(layout.controls.right);
    expect(layout.timestamp.left).toBeGreaterThan(layout.slider.right);
  } else {
    expect(layout.slider.centerY).toBeGreaterThan(layout.controls.centerY);
  }
  expect(Math.abs(layout.mode.centerY - layout.timestamp.centerY)).toBeLessThan(2);
  await page.screenshot({ path: info.outputPath('playback-desktop.png') });
  await page.getByRole('button', { name: 'Next timestep' }).click(); await ready(page);
  expect((await state(page)).frame.values[0].value).toBe(0.1);
  const mapValue = await page.evaluate(() => window.__RAINFALL_MAP__.getFeatureState({ source: 'pixel', id: '100' }));
  expect(mapValue.rainfall).toBe(0.1);
  // Rebuilding the style replaces sources and loses feature state; restore the frame.
  await page.evaluate(() => {
    const map = window.__RAINFALL_MAP__;
    map.setStyle(map.getStyle(), { diff: false });
  });
  await page.waitForFunction(() => window.__RAINFALL_MAP__.isStyleLoaded());
  await expect.poll(() => page.evaluate(() => window.__RAINFALL_MAP__.getFeatureState({ source: 'pixel', id: '100' }).rainfall)).toBe(0.1);
  await page.evaluate(() => {
    const source = window.__RAINFALL_MAP__.getSource('pixel');
    window.playbackSourceWrites = 0;
    const original = source.setData;
    source.setData = function(...args) { window.playbackSourceWrites++; return original.apply(this, args); };
  });
  await page.getByLabel('10 in.', { exact: true }).check();
  await mode.selectOption('cumulative'); await ready(page);
  expect((await state(page)).frame.index).toBe(1);
  await expect(page.getByLabel('5 in.', { exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Next timestep' }).click(); await ready(page);
  expect((await state(page)).frame.values[0].value).toBe(0.1);
  await mode.selectOption('interval'); await ready(page);
  await expect(page.getByLabel('10 in.', { exact: true })).toBeChecked();
  expect((await state(page)).frame.values[0].value).toBeNull();
  expect(await page.evaluate(() => window.__RAINFALL_MAP__.getFeatureState({ source: 'pixel', id: '100' }).rainfallAvailable)).toBe(false);
  const slider = page.getByRole('slider', { name: 'Rainfall timestep' });
  await slider.focus(); await page.keyboard.press('Home'); await ready(page);
  expect((await state(page)).frame.index).toBe(0);
  await page.getByRole('button', { name: 'Play playback' }).click();
  await expect.poll(async () => (await state(page)).frame.index).toBe(3);
  await expect(page.getByRole('button', { name: 'Play playback' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next timestep' })).toBeDisabled();
  await page.getByRole('button', { name: 'Play playback' }).click();
  await expect(page.getByRole('button', { name: 'Pause playback' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause playback' }).click();
  await mode.selectOption('total');
  await expect.poll(() => page.evaluate(() => window.__RAINFALL_MAP__.getFeatureState({ source: 'pixel', id: '100' }).rainfall)).toBeUndefined();
  await mode.selectOption('interval'); await ready(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(slider).toBeVisible();
  await expect(mode).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('playback-mobile.png') });
  expect(await page.evaluate(() => window.playbackSourceWrites)).toBe(0);
  expect(api.rainfallRequests).toHaveLength(1); expect(errors).toEqual([]);
});

test('single frame and total-only results disable transport', async ({ page }) => {
  await openResult(page, [{ id: '100', data: [{ ts: '2025-09-30T12:05:00Z', val: 0 }] }]);
  await page.getByRole('combobox', { name: 'Rainfall map view' }).selectOption('interval'); await ready(page);
  await expect(page.getByRole('button', { name: 'Play playback' })).toBeDisabled();
  await expect(page.getByRole('slider', { name: 'Rainfall timestep' })).toBeDisabled();
  await page.evaluate(() => {
    const store = window.__APP_STORE__;
    const item = store.getState().fetchKwargs.legacyGarr.history[0];
    store.dispatch({ type: 'fetchKwargs/removeFetchHistoryItem', payload: { contextType: 'legacyGarr', requestId: item.requestId } });
    store.dispatch({ type: 'fetchKwargs/pickInterval', payload: { contextType: 'legacyGarr', rollup: 'Total' } });
  });
  await page.getByRole('button', { name: 'Get Rainfall Data' }).click();
  await expect(page.getByText('Choose a timestep interval to enable playback.')).toBeVisible();
  expect(await page.getByRole('combobox', { name: 'Rainfall map view' }).locator('option[value=interval]').isDisabled()).toBe(true);
});

test('large playback keeps native frames, maintains cadence, seeks and releases resources', async ({ page }, info) => {
  test.setTimeout(180000);
  const data = largeRainfall(benchmark ? 165 : 12, benchmark ? 8929 : 1201);
  const api = await openResult(page, data);
  await page.evaluate(() => window.__RAINFALL_MAP__.jumpTo({ center: [-79.9625, 40.4475], zoom: 11 }));
  await page.waitForFunction(count => new Set(window.__RAINFALL_MAP__.queryRenderedFeatures({ layers: ['pixel-results'] }).map(f => f.id)).size === count, data.length);
  await page.evaluate(() => {
    window.playbackMetrics = { started: performance.now(), frames: [] };
    let last = null;
    window.stopPlaybackMetrics = window.__APP_STORE__.subscribe(() => {
      const p = window.__APP_STORE__.getState().playback;
      if (p.frame && p.frame !== last) { last = p.frame; window.playbackMetrics.frames.push({ index: p.frame.index, at: performance.now() }); }
    });
  });
  await page.getByRole('combobox', { name: 'Rainfall map view' }).selectOption('cumulative'); await ready(page);
  expect((await state(page)).timeline).toHaveLength(data[0].data.length);
  await page.getByRole('button', { name: 'Play playback' }).click();
  await expect.poll(async () => (await state(page)).frame.index, { timeout: 15000 }).toBeGreaterThanOrEqual(5);
  await page.getByRole('button', { name: 'Pause playback' }).click();
  await page.evaluate(() => {
    window.playbackMetrics.seekStarted = performance.now();
    window.__APP_STORE__.dispatch({ type: 'playback/seekPlayback', payload: window.__APP_STORE__.getState().playback.timeline.length - 1 });
  });
  await ready(page);
  const beforeCleanup = await page.evaluate(() => window.__APP_STORE__.inspectPlayback());
  expect(beforeCleanup.maxCachedFrames).toBeLessThanOrEqual(3);
  expect(beforeCleanup.sessions).toBe(1);
  const p = await state(page);
  expect(p.frame.index).toBe(data[0].data.length - 1);
  expect(p.frame.values).toHaveLength(data.length);
  const playbackStarted = await page.evaluate(() => {
    window.playbackMetrics.seekMs = window.playbackMetrics.frames.at(-1).at - window.playbackMetrics.seekStarted;
    window.__APP_STORE__.dispatch({ type: 'playback/togglePlayback' });
    return performance.now();
  });
  await page.waitForFunction(() => !window.__APP_STORE__.getState().playback.playing, null, { timeout: 12000 });
  expect((await state(page)).frame.index).toBe(data[0].data.length - 1);
  const playbackDuration = await page.evaluate(started => window.playbackMetrics.frames.at(-1).at - started, playbackStarted);
  expect(playbackDuration).toBeLessThan(10500);
  const metrics = await page.evaluate(() => {
    const metrics = window.playbackMetrics;
    metrics.prepareMs = metrics.frames[0].at - metrics.started;
    metrics.cadenceMs = metrics.frames.slice(1, 6).map((frame, i) => frame.at - metrics.frames[i].at);
    const store = window.__APP_STORE__;
    const item = store.getState().fetchKwargs.legacyGarr.history[0];
    store.dispatch({ type: 'fetchKwargs/removeFetchHistoryItem', payload: { contextType: 'legacyGarr', requestId: item.requestId } });
    window.stopPlaybackMetrics();
    return metrics;
  });
  await expect.poll(async () => (await state(page)).frame).toBeNull();
  await expect(page.getByRole('combobox', { name: 'Rainfall map view' })).toHaveCount(0);
  metrics.playbackDurationMs = playbackDuration;
  metrics.cleanup = await page.evaluate(() => window.__APP_STORE__.inspectResults());
  metrics.playback = { beforeCleanup, afterCleanup: await page.evaluate(() => window.__APP_STORE__.inspectPlayback()) };
  expect(metrics.playback.afterCleanup.sessions).toBe(0);
  expect(metrics.playback.afterCleanup.cachedFrames).toBe(0);
  expect(metrics.cleanup.datasets).toBe(0);
  expect(metrics.cleanup.operations).toBe(0);
  if (benchmark) {
    expect(metrics.prepareMs).toBeLessThan(10000);
    expect(metrics.seekMs).toBeLessThan(1000);
    expect(Math.max(...metrics.cadenceMs.slice(1))).toBeLessThan(300);
  }
  expect(api.rainfallRequests).toHaveLength(1);
  await info.attach('playback-performance.json', { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' });
});

test('open tooltips update with frames and hiding the tab pauses playback', async ({ page }) => {
  await openResult(page, [{ id: '100', data: [0.1, 0.2, 0.3].map((val, i) => ({ ts: new Date(Date.UTC(2025, 8, 30, 12, i * 5)).toISOString(), val })) }]);
  await page.getByRole('combobox', { name: 'Rainfall map view' }).selectOption('interval'); await ready(page);
  await page.evaluate(() => window.__RAINFALL_MAP__.jumpTo({ center: [-79.998, 40.422], zoom: 14 }));
  await page.waitForFunction(() => window.__RAINFALL_MAP__.isStyleLoaded());
  await page.waitForFunction(() => {
    const map = window.__RAINFALL_MAP__;
    return map.getLayer('HOVER-pixel') && map.queryRenderedFeatures(map.project([-79.998, 40.422]), { layers: ['HOVER-pixel'] }).length > 0;
  });
  await page.evaluate(() => {
    const map = window.__RAINFALL_MAP__;
    const lngLat = { lng: -79.998, lat: 40.422 };
    map.fire('mousemove', { point: map.project(lngLat), lngLat });
  });
  await expect(page.locator('.tooltip-body').filter({ hasText: 'Interval rainfall: 0.100' })).toBeVisible();
  // Dispatch a seek without moving the mouse, proving the open tooltip refreshes.
  await page.evaluate(() => window.__APP_STORE__.dispatch({ type: 'playback/seekPlayback', payload: 1 })); await ready(page);
  await expect(page.locator('.tooltip-body').filter({ hasText: 'Interval rainfall: 0.200' })).toBeVisible();
  await page.evaluate(() => {
    window.__APP_STORE__.dispatch({ type: 'playback/togglePlayback' });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect((await state(page)).playing).toBe(false);
});

test('scrubbing follows the pointer in both directions without shifting the slider', async ({ page }) => {
  await openResult(page, largeRainfall(12, 1201));
  await page.getByRole('combobox', { name: 'Rainfall map view' }).selectOption('interval'); await ready(page);
  const slider = page.getByRole('slider', { name: 'Rainfall timestep' });
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await slider.scrollIntoViewIfNeeded();
    const box = await slider.boundingBox();
    expect(box.width).toBeGreaterThan(width === 390 ? 250 : 170);
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + 8, y); await page.mouse.down();
    for (const fraction of [0.2, 0.8, 0.4, 0.9, 0.1]) {
      await page.mouse.move(box.x + 8 + (box.width - 16) * fraction, y, { steps: 3 });
      const selected = Number(await slider.inputValue());
      expect(Math.abs(selected - fraction * 1200)).toBeLessThan(35);
      expect((await state(page)).target).toBe(selected);
      const current = await slider.boundingBox();
      expect(current.x).toBe(box.x); expect(current.width).toBe(box.width); expect(current.y).toBe(box.y);
    }
    await page.mouse.up(); await ready(page);
    expect((await state(page)).frame.index).toBe(Number(await slider.inputValue()));
  }
});
