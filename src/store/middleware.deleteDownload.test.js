import { describe, expect, it } from "vitest";
import { configureStore } from "@reduxjs/toolkit";

import { CONTEXT_TYPES } from "./config";
import { initialState } from "./initialState";
import { rootReducer } from "./reducers";
import listenerMiddleware from "./listenerMiddleware";
import { deleteDownload } from "./features/downloadThunks";

const CONTEXT = CONTEXT_TYPES.legacyRealtime;

const buildFeatureCollection = (features) => ({
  type: "FeatureCollection",
  features
});

const baseGaugeFeatures = [
  {
    id: "g-1",
    geometry: null,
    properties: { id: "g-1", selected: false, name: "Gauge 1" }
  },
  {
    id: "g-2",
    geometry: null,
    properties: { id: "g-2", selected: false, name: "Gauge 2" }
  }
];

const basePixelFeatures = [
  {
    id: "p-1",
    geometry: null,
    properties: { id: "p-1", selected: false }
  },
  {
    id: "p-2",
    geometry: null,
    properties: { id: "p-2", selected: false }
  }
];

const buildFetchHistoryItem = ({
  requestId,
  isActive = false,
  results = false,
  sensorLocations = { gauge: [], pixel: [] }
}) => ({
  fetchKwargs: {
    sensorLocations,
    rollup: "15-minute",
    f: "sensor",
    startDt: "2025-01-01T00:00:00Z",
    endDt: "2025-01-01T01:00:00Z"
  },
  requestId,
  isFetching: 0,
  isActive,
  results,
  status: "finished",
  messages: []
});

const buildState = ({ history, activeSensorLocations = { gauge: [], pixel: [] } }) => {
  const state = JSON.parse(JSON.stringify(initialState));

  const cleanGaugeData = buildFeatureCollection(baseGaugeFeatures);
  const cleanPixelData = buildFeatureCollection(basePixelFeatures);

  state.refData = {
    gauge: { type: "geojson", data: cleanGaugeData },
    pixel: { type: "geojson", data: cleanPixelData }
  };

  state.mapStyle = {
    sources: {
      gauge: {
        type: "geojson",
        data: buildFeatureCollection(baseGaugeFeatures.map((feature) => ({
          ...feature,
          properties: {
            ...feature.properties,
            selected: true
          }
        })))
      },
      pixel: {
        type: "geojson",
        data: buildFeatureCollection(basePixelFeatures.map((feature) => ({
          ...feature,
          properties: {
            ...feature.properties,
            selected: true
          }
        })))
      }
    },
    layers: []
  };

  state.fetchKwargs[CONTEXT].active.sensorLocations = activeSensorLocations;
  state.fetchKwargs[CONTEXT].history = history;

  return state;
};

const buildStore = (preloadedState) => configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().prepend(listenerMiddleware.middleware),
  preloadedState,
  devTools: false
});

describe("deleteDownload thunk", () => {
  it("deleting a non-active item only removes that history entry", () => {
    const store = buildStore(buildState({
      history: [
        buildFetchHistoryItem({ requestId: "request-a", isActive: true }),
        buildFetchHistoryItem({ requestId: "request-b", isActive: false })
      ]
    }));

    store.dispatch(deleteDownload({ contextType: CONTEXT, requestId: "request-b" }));

    const nextState = store.getState();
    expect(nextState.fetchKwargs[CONTEXT].history.map((item) => item.requestId)).toEqual(["request-a"]);
    expect(nextState.fetchKwargs[CONTEXT].history[0].isActive).toBe(true);
  });

  it("deleting an active item with remaining history activates the newest remaining request", () => {
    const store = buildStore(buildState({
      history: [
        buildFetchHistoryItem({ requestId: "request-a", isActive: false }),
        buildFetchHistoryItem({ requestId: "request-b", isActive: true }),
        buildFetchHistoryItem({ requestId: "request-c", isActive: false })
      ]
    }));

    store.dispatch(deleteDownload({ contextType: CONTEXT, requestId: "request-b" }));

    const nextHistory = store.getState().fetchKwargs[CONTEXT].history;
    expect(nextHistory.map((item) => item.requestId)).toEqual(["request-a", "request-c"]);
    expect(nextHistory.find((item) => item.requestId === "request-c")?.isActive).toBe(true);
    expect(nextHistory.find((item) => item.requestId === "request-a")?.isActive).toBe(false);
  });

  it("deleting the active last item resets map sources to clean reference data", () => {
    const store = buildStore(buildState({
      history: [
        buildFetchHistoryItem({ requestId: "request-a", isActive: true })
      ],
      activeSensorLocations: {
        gauge: [],
        pixel: []
      }
    }));

    store.dispatch(deleteDownload({ contextType: CONTEXT, requestId: "request-a" }));

    const nextState = store.getState();
    expect(nextState.fetchKwargs[CONTEXT].history).toHaveLength(0);
    expect(nextState.mapStyle.sources.gauge.data).toEqual(nextState.refData.gauge.data);
    expect(nextState.mapStyle.sources.pixel.data).toEqual(nextState.refData.pixel.data);
    expect(nextState.mapStyle.sources.gauge.data.features.every((feature) => feature.properties.selected === false)).toBe(true);
    expect(nextState.mapStyle.sources.pixel.data.features.every((feature) => feature.properties.selected === false)).toBe(true);
  });

  it("deleting the active last item reapplies gauge/pixel highlights from active kwargs", () => {
    const store = buildStore(buildState({
      history: [
        buildFetchHistoryItem({ requestId: "request-a", isActive: true })
      ],
      activeSensorLocations: {
        gauge: [{ value: "g-1", label: "Gauge 1" }],
        pixel: [{ value: "p-1", label: "Pixel 1" }]
      }
    }));

    store.dispatch(deleteDownload({ contextType: CONTEXT, requestId: "request-a" }));

    const nextState = store.getState();
    const gaugeFeatures = nextState.mapStyle.sources.gauge.data.features;
    const pixelFeatures = nextState.mapStyle.sources.pixel.data.features;

    expect(gaugeFeatures.find((feature) => feature.id === "g-1")?.properties?.selected).toBe(true);
    expect(gaugeFeatures.find((feature) => feature.id === "g-2")?.properties?.selected).toBe(false);
    expect(pixelFeatures.find((feature) => feature.id === "p-1")?.properties?.selected).toBe(true);
    expect(pixelFeatures.find((feature) => feature.id === "p-2")?.properties?.selected).toBe(false);
  });
});
