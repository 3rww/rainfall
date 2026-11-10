import { deflateSync, inflateSync } from 'node:zlib';
import { test, expect } from '@playwright/test';
import { registerMockApiRoutes } from './helpers/mockApi';
import { rainfallGeometry } from './helpers/largeRainfall';

const query = { v: 2, c: 'legacyGarr', rollup: '15-minute', g: [], p: ['100'],
  startDt: '2025-10-01T04:00:00.000Z', endDt: '2025-10-01T05:00:00.000Z' };
const urlFor = value => `/#s=${deflateSync(Buffer.from(JSON.stringify(value))).toString('base64url')}`;

async function openImport(page, value) {
  await page.goto(urlFor(value));
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();
  await expect(page.getByRole('status').filter({ hasText: 'Query loaded.' })).toBeVisible();
}

for (const [source, context, sensor] of [
  ['historicRadar', 'legacyGarr', 'pixel'], ['historicGauge', 'legacyGauge', 'gauge'],
  ['realtimeRadar', 'legacyRealtime', 'pixel'], ['realtimeGauge', 'legacyRealtime', 'gauge']
]) for (const resolution of source.startsWith('historic') ? ['5', '15'] : ['15']) {
  test(`${source}/${resolution} imports exact dates and waits for the query button`, async ({ page }) => {
    const { rainfallRequests } = await registerMockApiRoutes(page);
    const sensorIds = sensor === 'pixel' ? ['100'] : ['8', 'inactive'];
    const value = { ...query, c: context, rollup: `${resolution}-minute`, g: sensor === 'gauge' ? sensorIds : [], p: sensor === 'pixel' ? sensorIds : [] };
    await openImport(page, value);
    const active = await page.evaluate(context => {
      const state = window.__APP_STORE__.getState();
      return { tab: state.progress.tab, ...state.fetchKwargs[context].active };
    }, context);
    expect(active).toMatchObject({ tab: context, startDt: value.startDt, endDt: value.endDt, rollup: `${resolution}-minute` });
    expect(active.sensorLocations[sensor].map(o => o.value)).toEqual(sensorIds);
    expect(active.sensorLocations[sensor === 'pixel' ? 'gauge' : 'pixel']).toEqual([]);
    expect(rainfallRequests).toHaveLength(0);
    await expect(page.locator('.tab-pane.active').getByRole('textbox', { name: 'start and end dates' })).toHaveValue('10/01/2025 12:00 AM to 10/01/2025 01:00 AM');
    await page.locator('.tab-pane.active').getByRole('button', { name: 'Get Rainfall Data', exact: true }).click();
    await expect.poll(() => rainfallRequests.length).toBe(1);
    expect(rainfallRequests[0]).toMatchObject({ sensor,
      path: `/v2/${sensor}/${source.startsWith('historic') ? `historic${resolution}` : 'realtime'}/`,
      payload: { start_dt: value.startDt, end_dt: value.endDt, rollup: `${resolution}-minute`,
        [sensor === 'pixel' ? 'pixels' : 'gauges']: sensorIds.join(',') } });
    expect(new URL(page.url()).hash).toBe(new URL(urlFor(value), 'http://local').hash);
  });
}

test('large imports survive hydration, highlights and reload without truncation', async ({ page }) => {
  const { rainfallRequests } = await registerMockApiRoutes(page, { pixels: rainfallGeometry(1000) });
  const sensorIds = Array.from({ length: 1000 }, (_, i) => String(100 + i)).sort();
  await openImport(page, { ...query, p: sensorIds });
  await expect(page.getByText('1000 pixels selected', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__APP_STORE__.getState().mapStyle.sources.pixel.data.features.filter(f => f.properties.selected).length)).toBe(1000);
  await page.reload();
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();
  await expect(page.getByText('1000 pixels selected', { exact: true })).toBeVisible();
  expect(rainfallRequests).toHaveLength(0);
});

test('unavailable dates show an error and leave defaults instead of clamping the import', async ({ page }) => {
  const { rainfallRequests } = await registerMockApiRoutes(page);
  await page.goto(urlFor({ ...query, endDt: '2030-01-01T00:00:00Z' }));
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();
  await expect(page.getByRole('status').filter({ hasText: 'Could not import query:' })).toContainText('outside');
  expect(await page.evaluate(() => window.__APP_STORE__.getState().progress.tab)).toBe('legacyRealtime');
  expect(rainfallRequests).toHaveLength(0);
});

for (const clipboardFails of [false, true]) test(`result Share uses the saved query after form edits (clipboard fails: ${clipboardFails})`, async ({ page }) => {
  test.setTimeout(60000);
  const { rainfallRequests } = await registerMockApiRoutes(page);
  await page.addInitScript(fails => {
    window.copiedLinks = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: url => {
      window.copiedLinks.push(url);
      return fails ? Promise.reject(new Error('denied')) : Promise.resolve();
    } } });
  }, clipboardFails);
  await openImport(page, query);
  const notice = page.getByRole('status').filter({ hasText: 'Query loaded.' });
  await expect(notice).toHaveClass(/small/);
  await notice.getByRole('button', { name: 'Close alert' }).click();
  await expect(notice).toHaveCount(0);
  await page.getByRole('button', { name: 'Get Rainfall Data', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View and Download Results' })).toBeVisible({ timeout: 30000 });
  const share = page.getByRole('button', { name: 'Share', exact: true });
  await expect(share).toBeEnabled();
  // Editing the form must not change the result's saved query or its share URL.
  await page.evaluate(() => {
    const store = window.__APP_STORE__;
    store.dispatch({ type: 'fetchKwargs/pickSensor', payload: { contextType: 'legacyGarr', sensorLocationType: 'pixel', selectedOptions: [{ value: 'other', label: 'other' }] } });
    store.dispatch({ type: 'fetchKwargs/pickInterval', payload: { contextType: 'legacyGarr', rollup: 'Daily' } });
    store.dispatch({ type: 'fetchKwargs/pickRainfallDateTimeRange', payload: { contextType: 'legacyGarr', startDt: '2025-07-01T00:00:00Z', endDt: '2025-07-02T00:00:00Z' } });
    // Capture every subsequent action so an accidental card selection is visible.
    const dispatch = store.dispatch;
    window.shareActions = [];
    store.dispatch = action => { window.shareActions.push(typeof action === 'function' ? 'thunk' : action.type); return dispatch(action); };
  });
  const beforeUrl = page.url();
  const beforeMap = await page.evaluate(() => JSON.stringify(window.__APP_STORE__.getState().mapStyle));
  await share.focus();
  await page.keyboard.press('Enter');
  if (clipboardFails) {
    const input = page.getByRole('textbox', { name: 'Share query URL' });
    await expect(input).toBeVisible();
    await input.focus();
    expect(await input.evaluate(el => el.selectionEnd - el.selectionStart)).toBe((await input.inputValue()).length);
  } else await expect(page.getByRole('status').filter({ hasText: 'Link copied.' })).toBeVisible();
  const copied = await page.evaluate(() => window.copiedLinks[0]);
  expect(JSON.parse(inflateSync(Buffer.from(new URLSearchParams(new URL(copied).hash.slice(1)).get('s'), 'base64url')))).toEqual(query);
  expect(new URL(copied).origin + new URL(copied).pathname).toBe(new URL(beforeUrl).origin + '/');
  expect(page.url()).toBe(beforeUrl);
  expect(await page.evaluate(() => window.shareActions)).toEqual([]);
  expect(await page.evaluate(() => JSON.stringify(window.__APP_STORE__.getState().mapStyle))).toBe(beforeMap);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(rainfallRequests).toHaveLength(1);
  await page.goto('about:blank');
  await page.goto(copied);
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();
  await expect(page.getByRole('status').filter({ hasText: 'Query loaded.' })).toBeVisible();
  expect(rainfallRequests).toHaveLength(1);
});

test('mixed realtime selection and aggregated interval hydrate without fetching', async ({ page }) => {
  const { rainfallRequests } = await registerMockApiRoutes(page);
  await openImport(page, { ...query, c: 'legacyRealtime', g: ['8', 'unmapped'], rollup: 'Hourly' });
  const active = await page.evaluate(() => window.__APP_STORE__.getState().fetchKwargs.legacyRealtime.active);
  expect(active.sensorLocations.gauge.map(o => o.value)).toEqual(['8', 'unmapped']);
  expect(active.sensorLocations.pixel.map(o => o.value)).toEqual(['100']);
  expect(active.rollup).toBe('Hourly');
  expect(rainfallRequests).toHaveLength(0);
});
