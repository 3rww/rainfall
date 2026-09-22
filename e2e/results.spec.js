import { test, expect } from '@playwright/test';
import { registerMockApiRoutes, toColumnarFixtureIfRequested } from './helpers/mockApi';
import { largeRainfall } from './helpers/largeRainfall';
const benchmark = process.env.RAINFALL_BENCHMARK === '1';
const contextType = 'legacyGarr';

test('worker results: immediate shell, bounded previews, deferred background exports and cleanup', async ({ page }, info) => {
  test.setTimeout(180000);
  const fixture = largeRainfall(benchmark ? 165 : 12, benchmark ? 8929 : 1201);
  const api = await registerMockApiRoutes(page, { rainfallData: (_sensor, requestPayload) => toColumnarFixtureIfRequested(fixture, requestPayload) });
  const failures = [];
  page.on('pageerror', e => failures.push(e.message));
  await page.goto(benchmark ? '/rainfall/' : '/');
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();
  await page.waitForFunction(() => window.__APP_STORE__?.getState().stats.latest?.['latest-15min-calibrated-radar']);
  await page.evaluate(({ contextType, sensorCount }) => {
    const store = window.__APP_STORE__;
    store.dispatch({ type: 'progress/switchTab', payload: contextType });
    store.dispatch({ type: 'fetchKwargs/pickSensor', payload: { contextType, sensorLocationType: 'pixel', selectedOptions: Array.from({ length: sensorCount }, (_, i) => ({ value: String(100 + i), label: String(100 + i) })) } });
    store.dispatch({ type: 'fetchKwargs/pickInterval', payload: { contextType, rollup: '5-minute' } });
    window.resultMetrics = { longTasks: [] };
    new PerformanceObserver(list => window.resultMetrics.longTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: false });
    let recorded = false;
    store.subscribe(() => {
      const item = store.getState().fetchKwargs[contextType].history[0];
      if (item?.detailsAvailable && !recorded) { window.resultMetrics.ingested = performance.now(); recorded = true; }
    });
  }, { contextType, sensorCount: fixture.length });
  await page.getByRole('button', { name: 'Get Rainfall Data' }).click();
  const view = page.getByRole('button', { name: 'View and Download Results' }).first();
  await expect(view).toBeVisible({ timeout: 60000 });
  // Measure from the actual DOM click to a painted shell, not Playwright scheduling.
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(b => b.textContent === 'View and Download Results');
    button.addEventListener('click', () => {
      window.resultMetrics.opened = performance.now();
      const observer = new MutationObserver(() => {
        if (document.querySelector('.download-modal-chart-meta')) {
          observer.disconnect();
          requestAnimationFrame(() => { window.resultMetrics.shellMs = performance.now() - window.resultMetrics.opened; });
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }, { once: true });
  });
  await view.click();
  await expect(page.getByText('Download as:')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Rainfall results line chart' })).toBeVisible({ timeout: 30000 });
  const initial = await page.evaluate(() => {
    const state = window.__APP_STORE__.getState();
    const item = Object.values(state.resultsPresentation.items).find(i => i.open);
    const preview = state.resultsPresentation.cache[item.previewKey].data;
    window.resultMetrics.previewMs = performance.now() - window.resultMetrics.opened;
    window.resultMetrics.previewAfterIngestionMs = performance.now() - window.resultMetrics.ingested;
    window.resultMetrics.mainHeapBytes = performance.memory?.usedJSHeapSize;
    return { ...window.resultMetrics, rows: preview.rows.length, interval: preview.interval, exports: [item.operations.csv, item.operations.swmm], historyBytes: JSON.stringify(state.fetchKwargs).length };
  });
  expect(initial.rows).toBeLessThanOrEqual(1000);
  expect(initial.exports).toEqual([undefined, undefined]);
  if (benchmark) { expect(initial.shellMs).toBeLessThan(250); expect(initial.previewAfterIngestionMs).toBeLessThan(2000); }
  await page.getByLabel('Average by Type').uncheck();
  await expect(page.getByText(`Individual sensors (10/${fixture.length})`)).toBeVisible();
  await expect(page.getByLabel('pixel 110', { exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await expect(page.getByText(`Individual sensors (${fixture.length}/${fixture.length})`)).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const state = window.__APP_STORE__.getState();
    const item = Object.values(state.resultsPresentation.items).find(i => i.open);
    return state.resultsPresentation.cache[item.previewKey]?.data.series.length;
  }), { timeout: 30000 }).toBe(fixture.length);
  await expect(page.locator('.download-chart-wrapper .u-legend .u-series')).toHaveCount(fixture.length + 1);
  await page.getByRole('button', { name: 'Deselect all', exact: true }).click();
  await expect(page.getByText(`Individual sensors (0/${fixture.length})`)).toBeVisible();
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await page.getByLabel('Search sensors').fill('111');
  await expect(page.getByLabel('pixel 111', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Chart start date', { exact: true })).toHaveCount(0);
  await expect(page.locator('.download-chart-wrapper .u-over')).toBeVisible();
  await expect.poll(() => page.evaluate(() => Object.values(window.__APP_STORE__.getState().resultsPresentation.items).find(i => i.open)?.operations.preview?.status)).toBe('succeeded');
  const over = page.locator('.download-chart-wrapper .u-over');
  await over.scrollIntoViewIfNeeded();
  const rect = await over.boundingBox();
  await page.mouse.move(rect.x + rect.width * 0.2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width * 0.25, rect.y + rect.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => Object.values(window.__APP_STORE__.getState().resultsPresentation.items).find(i => i.open)?.range.startMs)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => {
    const state = window.__APP_STORE__.getState();
    return Object.values(state.resultsPresentation.items).find(i => i.open)?.operations.preview?.status;
  })).toBe('succeeded');
  await page.locator('.download-chart-wrapper .u-over').dblclick();
  await expect.poll(() => page.evaluate(() => Object.values(window.__APP_STORE__.getState().resultsPresentation.items).find(i => i.open)?.range)).toEqual({});
  await page.getByLabel('Average by Type').check();
  const exportStart = Date.now();
  const download = page.waitForEvent('download', { timeout: 90000 });
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const csv = await download;
  expect(csv.suggestedFilename()).toBe('rainfall.csv');
  const csvMs = Date.now() - exportStart;
  await view.click();
  await expect(page.getByRole('img', { name: 'Rainfall results line chart' })).toBeVisible();
  const swmmStart = Date.now();
  const swmmPromise = page.waitForEvent('download', { timeout: 90000 });
  await page.getByRole('button', { name: 'SWMM (.inp)' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();
  const swmm = await swmmPromise;
  expect(swmm.suggestedFilename()).toBe('rainfall_swmm.inp');
  const swmmMs = Date.now() - swmmStart;
  const cleanup = await page.evaluate(contextType => {
    const store = window.__APP_STORE__;
    const requestId = store.getState().fetchKwargs[contextType].history[0].requestId;
    store.dispatch({ type: 'fetchKwargs/removeFetchHistoryItem', payload: { contextType, requestId } });
    return { presentationEntries: Object.keys(store.getState().resultsPresentation.items).length, cacheEntries: store.getState().resultsPresentation.lru.length, longTasks: window.resultMetrics.longTasks, heapAfterDelete: performance.memory?.usedJSHeapSize };
  }, contextType);
  cleanup.worker = await page.evaluate(() => window.__APP_STORE__.inspectResults());
  expect(cleanup.worker).toEqual({ datasets: 0, timestamps: 0, operations: 0, artifacts: 0 });
  expect(cleanup.presentationEntries).toBe(0); expect(cleanup.cacheEntries).toBe(0);
  expect(api.rainfallRequests).toHaveLength(1); expect(failures).toEqual([]);
  const report = { observations: fixture.length * fixture[0].data.length, ...initial, csvMs, swmmMs, cleanup };
  await info.attach('result-performance.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
  if (benchmark) console.log('RESULT_BENCHMARK', JSON.stringify(report));
});

test('opening another result never shows the first result’s export progress', async ({ page }) => {
  test.skip(benchmark, 'Covered by the regular real-worker suite; benchmark measures one query.');
  await registerMockApiRoutes(page, { rainfallData: (_sensor, requestPayload) => toColumnarFixtureIfRequested(largeRainfall(12, 1201), requestPayload) });
  await page.goto('/');
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();
  await page.evaluate(() => {
    const store = window.__APP_STORE__;
    store.dispatch({ type: 'fetchKwargs/pickSensor', payload: { contextType: 'legacyRealtime', sensorLocationType: 'pixel', selectedOptions: [{ value: '100', label: '100' }] } });
  });
  await page.getByRole('button', { name: 'Get Rainfall Data' }).click();
  await expect(page.getByRole('button', { name: 'View and Download Results' })).toHaveCount(1);
  await page.evaluate(() => window.__APP_STORE__.dispatch({ type: 'fetchKwargs/pickInterval', payload: { contextType: 'legacyRealtime', rollup: 'Hourly' } }));
  await page.getByRole('button', { name: 'Get Rainfall Data' }).click();
  await expect(page.getByRole('button', { name: 'View and Download Results' })).toHaveCount(2);
  await page.getByRole('button', { name: 'View and Download Results' }).first().click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();
  await page.getByRole('button', { name: 'View and Download Results' }).last().click();
  await expect(page.getByRole('button', { name: 'Cancel CSV', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => Object.values(window.__APP_STORE__.getState().resultsPresentation.items).find(i => i.open)?.operations.csv)).toBeUndefined();
  expect((await download).suggestedFilename()).toBe('rainfall.csv');
});

test('download progress spans the row and chart controls sit below the canvas', async ({ page }, info) => {
  test.skip(benchmark, 'UI layout covered in the normal browser suite.');
  await registerMockApiRoutes(page, { rainfallData: (_sensor, requestPayload) => toColumnarFixtureIfRequested(largeRainfall(12, 50), requestPayload) });
  await page.goto('/');
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();
  await page.evaluate(() => {
    window.__APP_STORE__.dispatch({ type: 'fetchKwargs/pickSensor', payload: {
      contextType: 'legacyRealtime', sensorLocationType: 'pixel', selectedOptions: [{ value: '100', label: '100' }]
    } });
  });
  await page.getByRole('button', { name: 'Get Rainfall Data' }).click();
  await page.getByRole('button', { name: 'View and Download Results' }).click();
  await expect(page.locator('.download-chart-wrapper canvas')).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await page.evaluate(() => {
    const store = window.__APP_STORE__;
    const item = store.getState().fetchKwargs.legacyRealtime.history[0];
    for (const format of ['csv', 'swmm']) {
      const arg = { contextType: 'legacyRealtime', requestId: item.requestId, revision: item.revision, format };
      store.dispatch({ type: 'results/export/pending', meta: { arg, requestId: format } });
      store.dispatch({ type: 'results/operationProgress', payload: { ...arg, operationId: format, progress: { processed: 25, total: 100 } } });
    }
  });
  for (const format of ['CSV', 'SWMM']) {
    const bar = page.getByRole('progressbar', { name: `${format} export progress` });
    await expect(bar).toHaveAttribute('aria-valuenow', '25');
    const width = (await page.locator('.download-modal-download-row').boundingBox()).width;
    expect((await bar.locator('..').boundingBox()).width).toBeCloseTo(width, 0);
  }
  await page.getByRole('button', { name: 'Cancel CSV', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: 'CSV export progress' })).toHaveCount(0);
  await expect(page.getByRole('progressbar', { name: 'SWMM export progress' })).toBeVisible();
  await page.getByLabel('Average by Type').uncheck();
  const plot = await page.locator('.download-chart-wrapper').boundingBox();
  const controls = await page.locator('.download-modal-chart-controls').boundingBox();
  expect(controls.y).toBeGreaterThanOrEqual(plot.y + plot.height);
  const choices = page.locator('.download-modal-sensor-grid .col');
  const first = await choices.nth(0).boundingBox();
  const second = await choices.nth(1).boundingBox();
  expect(second.x).toBeGreaterThan(first.x);
  expect(second.y).toBe(first.y);
  await page.locator('.download-modal-sensor-grid').scrollIntoViewIfNeeded();
  const screenshot = info.outputPath('modal-layout.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await info.attach('modal-layout.png', { path: screenshot, contentType: 'image/png' });
});
