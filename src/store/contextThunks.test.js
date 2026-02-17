import { describe, expect, it } from "vitest";
import { configureStore } from "@reduxjs/toolkit";

import { CONTEXT_TYPES } from "./config";
import { initialState } from "./initialState";
import { rootReducer } from "./reducers";
import listenerMiddleware from "./listenerMiddleware";
import { switchContext } from "./features/contextThunks";

const CONTEXT = CONTEXT_TYPES.legacyGauge;

const buildFeatureCollection = (features) => ({
  type: "FeatureCollection",
  features
});

const buildBaseState = () => {
  const state = JSON.parse(JSON.stringify(initialState));

  state.refData = {
    gauge: {
      type: "geojson",
      data: buildFeatureCollection([
        { id: "g-1", geometry: null, properties: { id: "g-1", selected: false } }
      ])
    },
    pixel: {
      type: "geojson",
      data: buildFeatureCollection([
        { id: "p-1", geometry: null, properties: { id: "p-1", selected: false } }
      ])
    }
  };

  state.mapStyle = {
    sources: {
      gauge: {
        type: "geojson",
        data: buildFeatureCollection([
          { id: "g-1", geometry: null, properties: { id: "g-1", total: "", selected: true } }
        ])
      },
      pixel: {
        type: "geojson",
        data: buildFeatureCollection([
          { id: "p-1", geometry: null, properties: { id: "p-1", total: "", selected: true } }
        ])
      }
    },
    layers: []
  };

  return state;
};

const buildStore = (preloadedState) => configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().prepend(listenerMiddleware.middleware),
  preloadedState,
  devTools: false
});

describe("contextThunks.switchContext", () => {
  it("switches tab and resets sources when target context has no active history", () => {
    const state = buildBaseState();
    state.fetchKwargs[CONTEXT].history = [];

    const store = buildStore(state);
    store.dispatch(switchContext(CONTEXT));

    const nextState = store.getState();
    expect(nextState.progress.tab).toBe(CONTEXT);
    expect(nextState.mapStyle.sources.gauge.data).toEqual(nextState.refData.gauge.data);
    expect(nextState.mapStyle.sources.pixel.data).toEqual(nextState.refData.pixel.data);
  });

  it("applies the active result item to map sources when available", () => {
    const state = buildBaseState();

    state.fetchKwargs[CONTEXT].history = [
      {
        requestId: "request-a",
        isActive: true,
        isFetching: 0,
        status: "finished",
        messages: [],
        fetchKwargs: {
          startDt: "2025-01-01T00:00:00Z",
          endDt: "2025-01-01T01:00:00Z",
          rollup: "15-minute",
          f: "sensor",
          sensorLocations: {
            gauge: [{ value: "g-1", label: "Gauge 1" }],
            pixel: []
          }
        },
        results: {
          gauge: [{ id: "g-1", total: 2.5 }]
        }
      }
    ];

    const store = buildStore(state);
    store.dispatch(switchContext(CONTEXT));

    const nextState = store.getState();
    expect(nextState.progress.tab).toBe(CONTEXT);
    expect(nextState.fetchKwargs[CONTEXT].history[0].isActive).toBe(true);
    expect(nextState.mapStyle.sources.gauge.data.features[0].properties.total).toBe(2.5);
    expect(nextState.mapStyle.sources.pixel.data).toEqual(nextState.refData.pixel.data);
  });

  it("reapplies active sensor highlights after reset when no active history item exists", () => {
    const realtimeContext = CONTEXT_TYPES.legacyRealtime;
    const state = buildBaseState();

    state.fetchKwargs[realtimeContext].history = [];
    state.fetchKwargs[realtimeContext].active.sensorLocations = {
      gauge: [{ value: "g-1", label: "Gauge 1" }],
      pixel: [{ value: "p-1", label: "Pixel 1" }],
      geographies: []
    };

    const store = buildStore(state);
    store.dispatch(switchContext(realtimeContext));

    const nextState = store.getState();
    expect(nextState.progress.tab).toBe(realtimeContext);
    expect(nextState.mapStyle.sources.gauge.data.features[0].properties.selected).toBe(true);
    expect(nextState.mapStyle.sources.pixel.data.features[0].properties.selected).toBe(true);
  });
});
