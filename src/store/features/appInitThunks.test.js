import { beforeEach, describe, expect, it, vi } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import axios from "axios";

import { rootReducer } from "../rootReducer";
import { initialState } from "../initialState";
import {
  fetchRainfallEventsPaginated,
  initDataFetch
} from "./appInitThunks";

vi.mock("axios");

const clone = (value) => JSON.parse(JSON.stringify(value));

const MOCK_GLOBAL_CONFIG = {
  globalNotice: {
    show: false,
    title: "",
    content: "",
    level: "info"
  }
};

const MOCK_TIMESTAMPS = {
  "realtime-gauge": "2026-01-01T02:00:00Z",
  "realtime-radar": "2026-01-01T02:00:00Z",
  "calibrated-gauge": "2026-01-31T00:00:00Z",
  "calibrated-radar": "2026-01-31T00:00:00Z",
  "earliest-5min-calibrated-gauge": "2025-01-01T00:00:00Z",
  "latest-5min-calibrated-gauge": "2026-01-31T00:00:00Z",
  "earliest-5min-calibrated-radar": "2025-01-01T00:00:00Z",
  "latest-5min-calibrated-radar": "2026-01-31T00:00:00Z"
};

const MOCK_GAUGES = {
  type: "FeatureCollection",
  features: [
    {
      id: "8",
      properties: {
        active: true,
        web_id: "8",
        name: "Mock Gauge",
        ext_id: "DW-8"
      },
      geometry: {
        type: "Point",
        coordinates: [-79.986, 40.448]
      }
    }
  ]
};

const MOCK_PIXELS = {
  type: "FeatureCollection",
  features: [
    {
      id: "100",
      properties: {
        pixel_id: "100"
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-79.99, 40.45],
          [-79.98, 40.45],
          [-79.98, 40.44],
          [-79.99, 40.44],
          [-79.99, 40.45]
        ]]
      }
    }
  ]
};

const MOCK_EVENT = {
  event_label: "event-a",
  start_dt: "2026-01-01T00:00:00Z",
  end_dt: "2026-01-01T03:00:00Z",
  duration: 3
};

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

const buildStore = ({ actionSink = null } = {}) => {
  const actionCaptureMiddleware = () => (next) => (action) => {
    if (Array.isArray(actionSink)) {
      actionSink.push(action);
    }
    return next(action);
  };

  return configureStore({
    reducer: rootReducer,
    preloadedState: clone(initialState),
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(actionCaptureMiddleware),
    devTools: false
  });
};

const buildAxiosReferenceMock = ({ onEventsRequest }) => {
  const axiosMock = vi.mocked(axios);
  axiosMock.mockImplementation(async ({ url }) => {
    if (url.includes("v2/rainfall-events/")) {
      return onEventsRequest(url);
    }
    if (url.endsWith("static/config.json")) {
      return { data: MOCK_GLOBAL_CONFIG };
    }
    if (url.includes("v2/latest-observations/")) {
      return { data: MOCK_TIMESTAMPS };
    }
    if (url.includes("static/data/geography-lookup.json")) {
      return { data: {} };
    }
    if (url.endsWith("/gauges/")) {
      return { data: MOCK_GAUGES };
    }
    if (url.endsWith("/pixels/")) {
      return { data: MOCK_PIXELS };
    }

    throw new Error(`Unexpected url in test: ${url}`);
  });
};

describe("appInitThunks", () => {
  beforeEach(() => {
    vi.mocked(axios).mockReset();
  });

  it("initDataFetch resolves startup without waiting for all rainfall event pages", async () => {
    const deferredPage = createDeferred();
    buildAxiosReferenceMock({
      onEventsRequest: () => deferredPage.promise
    });

    const store = buildStore();
    await store.dispatch(initDataFetch());

    const stateAfterInit = store.getState();
    expect(stateAfterInit.progress.isFetching).toBe(false);
    expect(stateAfterInit.rainfallEvents.loadStatus).toBe("loading");
    expect(stateAfterInit.rainfallEvents.list).toEqual([]);

    deferredPage.resolve({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [MOCK_EVENT]
      }
    });
    await nextTick();
    await nextTick();

    const finalState = store.getState();
    expect(finalState.rainfallEvents.loadStatus).toBe("succeeded");
    expect(finalState.rainfallEvents.list).toHaveLength(1);
  });

  it("fetchRainfallEventsPaginated dispatches start, append per page, and complete", async () => {
    const axiosMock = vi.mocked(axios);
    axiosMock
      .mockResolvedValueOnce({
        data: {
          count: 2,
          next: "https://mock.local/rainfall/v2/rainfall-events/?format=json&page=2",
          previous: null,
          results: [MOCK_EVENT]
        }
      })
      .mockResolvedValueOnce({
        data: {
          count: 2,
          next: null,
          previous: "https://mock.local/rainfall/v2/rainfall-events/?format=json&page=1",
          results: [{
            event_label: "event-b",
            start_dt: "2026-01-02T00:00:00Z",
            end_dt: "2026-01-02T02:00:00Z",
            duration: 2
          }]
        }
      });

    const actions = [];
    const store = buildStore({ actionSink: actions });
    await store.dispatch(fetchRainfallEventsPaginated());

    const eventActionTypes = actions
      .map((action) => action?.type)
      .filter((type) => typeof type === "string" && type.startsWith("rainfallEvents/"));

    expect(eventActionTypes).toEqual([
      "rainfallEvents/startRainfallEventsLoad",
      "rainfallEvents/appendRainfallEventsPage",
      "rainfallEvents/appendRainfallEventsPage",
      "rainfallEvents/completeRainfallEventsLoad"
    ]);
  });

  it("keeps partial events and marks failure when a later page request errors", async () => {
    const axiosMock = vi.mocked(axios);
    axiosMock
      .mockResolvedValueOnce({
        data: {
          count: 2,
          next: "https://mock.local/rainfall/v2/rainfall-events/?format=json&page=2",
          previous: null,
          results: [MOCK_EVENT]
        }
      })
      .mockRejectedValueOnce(new Error("network boom"));

    const store = buildStore();
    await store.dispatch(fetchRainfallEventsPaginated());

    const state = store.getState().rainfallEvents;
    expect(state.loadStatus).toBe("failed");
    expect(state.list).toHaveLength(1);
    expect(state.error).toContain("network boom");
  });
});
