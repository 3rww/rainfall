import { test, expect } from "@playwright/test";

import { MOCK_EVENT, registerMockApiRoutes } from "./helpers/mockApi";

const waitForUiIdle = async (page) => {
  await page.waitForSelector(".modal.show[role='dialog']", { state: "detached", timeout: 2000 }).catch(() => {});
};

const closeAboutModalIfVisible = async (page) => {
  const dialog = page.locator(".modal.show[role='dialog']");
  if (await dialog.count()) {
    await dialog.first().getByRole("button", { name: "Close", exact: true }).last().click({ force: true });
    await page.waitForSelector(".modal.show[role='dialog']", { state: "detached", timeout: 10000 }).catch(() => {});
  }
  await waitForUiIdle(page);
};

const selectGauge = async (page, contextType = "legacyRealtime") => {
  await page.waitForFunction(() => Boolean(window.__APP_STORE__), null, { timeout: 10000 });
  await page.evaluate(({ selectedContext }) => {
    window.__APP_STORE__.dispatch({
      type: "fetchKwargs/pickSensor",
      payload: {
        contextType: selectedContext,
        sensorLocationType: "gauge",
        selectedOptions: [
          { value: "8", label: "8: Mock Gauge" }
        ]
      }
    });
  }, { selectedContext: contextType });
};

const clickContextTab = async (page, label) => {
  await waitForUiIdle(page);
  await page.locator(".nav-link", { hasText: label }).first().click({ force: true });
};

const setContext = async (page, contextType) => {
  await page.waitForFunction(() => Boolean(window.__APP_STORE__), null, { timeout: 10000 });
  await page.evaluate(({ nextContext }) => {
    window.__APP_STORE__.dispatch({
      type: "progress/switchTab",
      payload: nextContext
    });
  }, { nextContext: contextType });
};

test("app load renders map and controls", async ({ page }) => {
  await registerMockApiRoutes(page, { mode: "success" });

  await page.goto("/");
  await closeAboutModalIfVisible(page);

  await expect(page.locator("#map")).toBeVisible();
  await expect(page.locator("#map .mapboxgl-canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Get Rainfall Data" })).toBeVisible();
});

test("app stays interactive while paginated events load in the background", async ({ page }) => {
  await registerMockApiRoutes(page, {
    mode: "success",
    eventsDelayMs: 1200,
    eventsPageSize: 1
  });

  await page.goto("/");
  await closeAboutModalIfVisible(page);
  await page.waitForFunction(() => Boolean(window.__APP_STORE__), null, { timeout: 10000 });

  await expect(page.locator("#map")).toBeVisible();
  await expect(page.getByRole("button", { name: "Get Rainfall Data" })).toBeVisible();

  await expect.poll(async () => page.evaluate(() => {
    return window.__APP_STORE__.getState().rainfallEvents.loadStatus;
  }), { timeout: 10000 }).toBe("loading");

  await expect.poll(async () => page.evaluate(() => {
    return window.__APP_STORE__.getState().rainfallEvents.list.length;
  }), { timeout: 10000 }).toBeGreaterThan(1);
});

test("context switch preserves selected sensors in dropdown", async ({ page }) => {
  await registerMockApiRoutes(page, { mode: "success" });

  await page.goto("/");
  await closeAboutModalIfVisible(page);
  await selectGauge(page, "legacyRealtime");

  await expect(page.getByText("8: Mock Gauge", { exact: true })).toBeVisible();

  await clickContextTab(page, "Historical Rain Gauge");
  await clickContextTab(page, "Real-Time Rainfall");

  await expect(page.getByText("8: Mock Gauge", { exact: true })).toBeVisible();
});

test("event selection updates rainfall request kwargs", async ({ page }) => {
  const api = await registerMockApiRoutes(page, { mode: "success" });

  await page.goto("/");
  await closeAboutModalIfVisible(page);
  await setContext(page, "legacyGauge");
  await selectGauge(page, "legacyGauge");
  await page.waitForFunction(() => {
    const state = window.__APP_STORE__?.getState?.();
    return Boolean(state?.rainfallEvents?.list?.length);
  }, null, { timeout: 10000 });
  await page.evaluate(() => {
    const state = window.__APP_STORE__.getState();
    const event = state.rainfallEvents.list[0];

    window.__APP_STORE__.dispatch({
      type: "rainfallEvents/pickRainfallEvent",
      payload: { eventid: event.eventid }
    });
    window.__APP_STORE__.dispatch({
      type: "fetchKwargs/pickRainfallDateTimeRange",
      payload: {
        contextType: "legacyGauge",
        startDt: event.startDt,
        endDt: event.endDt
      }
    });
  });

  await page.getByRole("button", { name: "Get Rainfall Data" }).click();

  await expect.poll(() => api.rainfallRequests.length).toBeGreaterThan(0);
  const gaugeRequest = api.rainfallRequests.find((request) => request.sensor === "gauge");

  expect(gaugeRequest).toBeTruthy();
  expect(gaugeRequest.payload.start_dt).toBe(MOCK_EVENT.start_dt);
  expect(gaugeRequest.payload.end_dt).toBe(MOCK_EVENT.end_dt);
});

test("successful rainfall request opens download modal", async ({ page }) => {
  await registerMockApiRoutes(page, { mode: "success" });

  await page.goto("/");
  await closeAboutModalIfVisible(page);
  await selectGauge(page, "legacyRealtime");
  await page.getByRole("button", { name: "Get Rainfall Data" }).click();

  const viewResultsButton = page.getByRole("button", { name: "View and Download Results" }).first();
  await expect(viewResultsButton).toBeVisible();
  await viewResultsButton.click();

  await expect(page.getByText("Download as:")).toBeVisible();
});

test("failed rainfall polling shows an error message in downloads list", async ({ page }) => {
  await registerMockApiRoutes(page, { mode: "failed" });

  await page.goto("/");
  await closeAboutModalIfVisible(page);
  await selectGauge(page, "legacyRealtime");
  await page.getByRole("button", { name: "Get Rainfall Data" }).click();

  await expect(page.getByText(/Rainfall request failed|polling failure/i)).toBeVisible();
});

for (const [context, sensor] of [['legacyGauge', 'gauge'], ['legacyGarr', 'pixel']]) {
  for (const [endpoint, rollup] of [['historic5', '5-minute'], ['historic15', '15-minute']]) {
    test(`${context} ${endpoint} polling preserves nulls in results and CSV`, async ({ page }) => {
      const api = await registerMockApiRoutes(page);
      await page.goto('/');
      await closeAboutModalIfVisible(page);
      await setContext(page, context);
      await page.evaluate(({ context, sensor }) => {
        window.__APP_STORE__.dispatch({ type: 'fetchKwargs/pickSensor', payload: {
          contextType: context, sensorLocationType: sensor,
          selectedOptions: [{ value: sensor === 'gauge' ? '8' : '100', label: 'Mock sensor' }]
        } });
      }, { context, sensor });
      await page.getByRole('radio', { name: rollup, exact: true }).check();
      await page.getByRole('button', { name: 'Get Rainfall Data' }).click();
      await expect.poll(() => api.rainfallRequests.length).toBe(1);
      expect(api.rainfallRequests[0].path).toBe(`/v2/${sensor}/${endpoint}/`);
      expect(api.rainfallRequests[0].payload.rollup).toBe(rollup);
      const view = page.getByRole('button', { name: 'View and Download Results' }).first();
      await expect(view).toBeVisible();
      await expect.poll(() => page.evaluate(({context, sensor}) => {
        const row = window.__APP_STORE__.getState().fetchKwargs[context].history[0].results[sensor][0];
        return { total: row.total, missing: row.missingCount, details: row.data };
      }, {context, sensor})).toEqual({total: .25, missing: 1, details: undefined});
      await view.click();
      await expect(page.getByRole('img', { name: 'Rainfall results line chart' })).toBeVisible();
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: /CSV/i }).click();
      const download = await downloadPromise;
      const stream = await download.createReadStream();
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const csv = Buffer.concat(chunks).toString();
      expect(csv).toContain('N/D');
      expect(csv).toContain('0.25');
      expect(csv).not.toContain(',0,N/D');
    });
  }
}

test('missing parquet availability blocks historic requests but not realtime', async ({ page }) => {
  const api = await registerMockApiRoutes(page, { timestamps: {} });
  await page.goto('/');
  await closeAboutModalIfVisible(page);
  await setContext(page, 'legacyGauge');
  await selectGauge(page, 'legacyGauge');
  await expect(page.getByRole('alert')).toContainText('Rainfall availability is unavailable');
  await expect(page.getByRole('button', { name: 'Get Rainfall Data' })).toBeDisabled();
  expect(api.rainfallRequests).toHaveLength(0);
  await setContext(page, 'legacyRealtime');
  await selectGauge(page, 'legacyRealtime');
  await expect(page.getByRole('button', { name: 'Get Rainfall Data' })).toBeEnabled();
});

test('interval changes clamp to parquet coverage and keep five-minute routing', async ({ page }) => {
  const timestamps = {
    'earliest-15min-calibrated-gauge': '2025-09-01T00:00:00Z',
    'latest-15min-calibrated-gauge': '2025-10-01T00:00:00Z',
    'earliest-5min-calibrated-gauge': '2025-01-01T00:00:00Z',
    'latest-5min-calibrated-gauge': '2026-02-01T00:00:00Z'
  };
  const api = await registerMockApiRoutes(page, { timestamps });
  await page.goto('/');
  await closeAboutModalIfVisible(page);
  await setContext(page, 'legacyGauge');
  await selectGauge(page, 'legacyGauge');
  await page.getByRole('radio', {name: '5-minute', exact: true}).check();
  await page.evaluate(() => window.__APP_STORE__.dispatch({ type: 'fetchKwargs/pickRainfallDateTimeRange', payload: {
    contextType: 'legacyGauge', startDt: '2025-01-01T00:00:00Z', endDt: '2026-02-01T00:00:00Z'
  }}));
  await page.getByRole('button', { name: 'Get Rainfall Data' }).click();
  await expect.poll(() => api.rainfallRequests.length).toBe(1);
  expect(api.rainfallRequests[0].path).toBe('/v2/gauge/historic5/');
  expect(api.rainfallRequests[0].payload.rollup).toBe('5-minute');
  await page.getByRole('radio', {name: 'Total', exact: true}).check();
  await expect.poll(() => page.evaluate(() => {
    const {startDt, endDt} = window.__APP_STORE__.getState().fetchKwargs.legacyGauge.active;
    return {startDt, endDt};
  })).toEqual({startDt: '2025-09-01T00:00:00.000Z', endDt: '2025-10-01T00:00:00.000Z'});
  await page.getByRole('button', { name: 'Get Rainfall Data' }).click();
  await expect.poll(() => api.rainfallRequests.length).toBe(2);
  expect(api.rainfallRequests[1].path).toBe('/v2/gauge/historic15/');
  expect(api.rainfallRequests[1].payload.rollup).toBe('Total');
});

test('historic15 polling failures reach the download error state', async ({ page }) => {
  await registerMockApiRoutes(page, {mode: 'failed'});
  await page.goto('/');
  await closeAboutModalIfVisible(page);
  await setContext(page, 'legacyGauge');
  await selectGauge(page, 'legacyGauge');
  await page.getByRole('button', { name: 'Get Rainfall Data' }).click();
  await expect(page.getByText(/Rainfall request failed|polling failure/i)).toBeVisible();
});
