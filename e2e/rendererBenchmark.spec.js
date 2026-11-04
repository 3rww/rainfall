import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { registerMockApiRoutes, toColumnarFixtureIfRequested } from './helpers/mockApi';
import { largeRainfall } from './helpers/largeRainfall';
import { selectMode } from './helpers/playback';

for (const mode of ['interval', 'cumulative', 'combined']) test(`renderer benchmark ${mode}`, async ({ page, browserName }, info) => {
  test.skip(process.env.RAINFALL_BENCHMARK !== '1', 'Production benchmark only');
  const radar = JSON.parse(fs.readFileSync('public/static/data/pixels.geojson'));
  const gauges = JSON.parse(fs.readFileSync('public/static/data/gauges.geojson'));
  radar.features.forEach((f, i) => { f.id = String(i + 100); f.properties.pixel_id = f.id; });
  gauges.features.forEach((f, i) => { f.id = String(i + 8); Object.assign(f.properties, { active: true, web_id: f.id, ext_id: f.id }); });
  const data = largeRainfall(2313, 101), gaugeData = largeRainfall(33, 101).map((f, i) => ({ ...f, id: String(i + 8) }));
  for (const row of [...data, ...gaugeData]) row.data[0].val = 0.125;
  await registerMockApiRoutes(page, { pixels: radar, gauges, rainfallData: (sensor, request) => toColumnarFixtureIfRequested(sensor === 'gauge' ? gaugeData : data, request) });
  const backend = process.env.PLAYBACK_RENDERER || 'native';
  await page.goto(`/rainfall/?playbackRenderer=${backend}`);
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();
  await page.waitForFunction(() => window.__APP_STORE__?.getState().stats.latest?.['latest-15min-calibrated-radar']);
  await page.evaluate(() => {
    const s = window.__APP_STORE__;
    s.dispatch({ type: 'progress/switchTab', payload: 'legacyRealtime' });
    for (const [sensor, count, start] of [['pixel', 2313, 100], ['gauge', 33, 8]]) s.dispatch({ type: 'fetchKwargs/pickSensor', payload: { contextType: 'legacyRealtime', sensorLocationType: sensor, selectedOptions: Array.from({ length: count }, (_, i) => ({ value: String(start + i), label: String(start + i) })) } });
    s.dispatch({ type: 'fetchKwargs/pickInterval', payload: { contextType: 'legacyRealtime', rollup: '5-minute' } });
  });
  await page.getByRole('button', { name: 'Get Rainfall Data' }).click();
  await expect(page.getByRole('button', { name: 'View and Download Results' }).first()).toBeVisible({ timeout: 60000 });
  await page.waitForFunction(() => window.__RAINFALL_MAP__.getLayer('pixel-results'));
  await page.evaluate(() => window.__RAINFALL_MAP__.fitBounds([[-80.4, 40.1], [-79.65, 40.75]], { duration: 0, padding: 5 }));
  await page.waitForFunction(() => {
    const map = window.__RAINFALL_MAP__;
    return new Set(map.queryRenderedFeatures({ layers: ['pixel-results'] }).map(f => f.id)).size === 2313
      && new Set(map.queryRenderedFeatures({ layers: ['gauge-results'] }).map(f => f.id)).size === 33;
  });
  const environment = await page.evaluate(() => {
    const map = window.__RAINFALL_MAP__, gl = map.getCanvas().getContext('webgl2'), debug = gl.getExtension('WEBGL_debug_renderer_info');
    return { userAgent: navigator.userAgent, dpr: devicePixelRatio, camera: { center: map.getCenter().toArray(), zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() },
      gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
  });
  await selectMode(page, mode);
  await page.waitForFunction(() => window.__APP_STORE__.getState().playback.status === 'ready');
  if (backend === 'custom') expect(await page.evaluate(() => window.__APP_STORE__.playbackRuntime.inspect().backend)).toBe('custom');
  const runs = [];
  // One warmup, then five measured runs. Data/camera/viewport remain identical.
  for (let run = 0; run < 6; run++) {
    await page.evaluate(() => window.__APP_STORE__.dispatch({ type: 'playback/seekPlayback', payload: 0 }));
    await page.waitForFunction(() => window.__APP_STORE__.getState().playback.status === 'ready');
    await page.evaluate(({ mode, run }) => {
      const store = window.__APP_STORE__, runtime = store.playbackRuntime;
      const m = window.playbackMeasurement = { label: `rainfall:${mode}:${run}`, timeOrigin: performance.timeOrigin, started: performance.now(), frames: [], longTasks: [], gaps: [], burstGaps: [], longTasksSupported: PerformanceObserver.supportedEntryTypes.includes('longtask') };
      let previous = runtime?.getCurrentFrame() || store.getState().playback.frame, last;
      const frame = () => {
        const f = runtime?.getCurrentFrame() || store.getState().playback.frame;
        if (!f || f === previous) return;
        previous = f;
        const record = () => { if ((runtime?.getCurrentFrame() || store.getState().playback.frame) === f) m.frames.push({ index: f.index, at: performance.now() - m.started }); };
        if (runtime) record(); else window.__RAINFALL_MAP__.once('render', record);
      };
      m.stop = runtime ? runtime.subscribePresentation(frame) : store.subscribe(frame);
      if (PerformanceObserver.supportedEntryTypes.includes('longtask')) { m.observer = new PerformanceObserver(list => m.longTasks.push(...list.getEntries().map(e => ({ at: e.startTime - m.started, duration: e.duration })))); m.observer.observe({ type: 'longtask' }); }
      const tick = time => { if (last) { m.gaps.push(time - last); if (window.__RAINFALL_BURSTS__?.inspect().animated) m.burstGaps.push(time - last); } last = time; m.raf = requestAnimationFrame(tick); }; m.raf = requestAnimationFrame(tick);
      performance.mark(`${m.label}:start`);
      store.dispatch({ type: 'playback/togglePlayback' });
    }, { mode, run });
    await page.waitForFunction(() => !window.__APP_STORE__.getState().playback.playing, null, { timeout: 20000 });
    await page.waitForFunction(() => window.playbackMeasurement.frames.at(-1)?.index === 100);
    const measurement = await page.evaluate(async () => {
      performance.mark(`${window.playbackMeasurement.label}:end`);
      const m = window.playbackMeasurement; m.stop(); m.observer?.disconnect(); cancelAnimationFrame(m.raf);
      const { frames, longTasks, gaps } = m;
      const store = window.__APP_STORE__, started = performance.now();
      // The old Redux acknowledgement precedes the map draw; measure both at draw submission.
      store.dispatch({ type: 'playback/seekPlayback', payload: 50 });
      await new Promise(resolve => { const check = () => { if (store.getState().playback.status === 'ready') { stop(); if (store.playbackRuntime) resolve(); else window.__RAINFALL_MAP__.once('render', resolve); } }; const stop = store.subscribe(check); check(); });
      return { started: m.started, timeOrigin: m.timeOrigin, frames, longTasks, longTasksSupported: m.longTasksSupported, gaps, burstGaps: m.burstGaps, seekMs: performance.now() - started, diagnostics: await store.inspectPlayback() };
    });
    if (run) runs.push(measurement);
  }
  const report = { revision: process.env.PLAYBACK_REVISION || 'working', backend, browserName, mode, environment, viewport: page.viewportSize(), runs };
  await info.attach(`${mode}.json`, { body: JSON.stringify(report), contentType: 'application/json' });
  if (process.env.PLAYBACK_REPORT_DIR) { fs.mkdirSync(process.env.PLAYBACK_REPORT_DIR, { recursive: true }); fs.writeFileSync(`${process.env.PLAYBACK_REPORT_DIR}/${browserName}-${backend}-${mode}.json`, JSON.stringify(report, null, 2)); }
  for (const run of runs) { if (backend === 'custom') expect(run.diagnostics.backend).toBe('custom'); expect(run.frames.at(-1).index).toBe(100); expect(run.frames.at(-1).at).toBeLessThan(10500); expect(run.diagnostics.maxCachedFrames).toBeLessThanOrEqual(3); }
});
