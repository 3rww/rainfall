import { expect } from '@playwright/test';
import { registerMockApiRoutes, toColumnarFixtureIfRequested } from './mockApi';
import { rainfallGeometry } from './largeRainfall';
const benchmark = process.env.RAINFALL_BENCHMARK === '1';
export async function openResult(page, data, rollup = '5-minute', { mixed = false, geometry, style, backend = process.env.PLAYBACK_RENDERER || 'native' } = {}) {
  const contextType = mixed ? 'legacyRealtime' : 'legacyGarr';
  const api = await registerMockApiRoutes(page, { rainfallData: (sensor, requestPayload) => toColumnarFixtureIfRequested(sensor === 'gauge' ? [{ id: '8', data: data[0].data }] : data, requestPayload), pixels: geometry || rainfallGeometry(data.length), style });
  const query = backend ? `?playbackRenderer=${backend}` : '';
  await page.goto(`${benchmark ? '/rainfall/' : '/'}${query}`);
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();
  await page.waitForFunction(() => window.__APP_STORE__?.getState().stats.latest?.['latest-15min-calibrated-radar']);
  await page.evaluate(({ contextType, count, rollup, mixed }) => {
    const store = window.__APP_STORE__;
    store.dispatch({ type: 'progress/switchTab', payload: contextType });
    store.dispatch({ type: 'fetchKwargs/pickSensor', payload: { contextType, sensorLocationType: 'pixel', selectedOptions: Array.from({ length: count }, (_, i) => ({ value: String(100 + i), label: String(100 + i) })) } });
    if (mixed) store.dispatch({ type: 'fetchKwargs/pickSensor', payload: { contextType, sensorLocationType: 'gauge', selectedOptions: [{ value: '8', label: 'Mock Gauge' }] } });
    store.dispatch({ type: 'fetchKwargs/pickInterval', payload: { contextType, rollup } });
  }, { contextType, count: data.length, rollup, mixed });
  await expect(page.getByRole('button', { name: 'Rainfall map view' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Get Rainfall Data' }).click();
  await expect(page.getByRole('button', { name: 'View and Download Results' }).first()).toBeVisible({ timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.__RAINFALL_MAP__.getLayer('pixel-results')));
  return api;
}
export const state = page => page.evaluate(() => ({ ...window.__APP_STORE__.getState().playback, frame: window.__APP_STORE__.playbackRuntime.getCurrentFrame() }));
export const ready = page => expect.poll(async () => (await state(page)).status).toBe('ready');
const modeLabels = { total: 'Total Rainfall', interval: 'Rainfall by Interval', cumulative: 'Cumulative Rainfall', combined: 'Cumulative + Rain Drops' };
export async function selectMode(page, mode) {
  await page.getByRole('button', { name: 'Rainfall map view' }).click();
  await page.locator('.playback-mode .dropdown-item').getByText(modeLabels[mode], { exact: true }).click();
}
export async function selectScale(page, label) {
  await page.locator('#legend-scale-dropdown-button').click();
  await page.locator('.dropdown-menu.show .dropdown-item').getByText(label, { exact: true }).click();
}


