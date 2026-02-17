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
