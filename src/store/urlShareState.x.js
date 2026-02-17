import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const flushAsync = async () => {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const mapStyleFixture = {
  sources: {
    gauge: {
      data: {
        features: [
          { id: "1", properties: { id: "1", name: "Gauge One" } },
          { id: "3", properties: { id: "3", name: "Gauge Three" } }
        ]
      }
    },
    pixel: {
      data: {
        features: [
          { id: "101", properties: { id: "101" } },
          { id: "102", properties: { id: "102" } }
        ]
      }
    }
  },
  layers: []
};

const selectedIds = (state, contextType, sensorType) => (
  state.fetchKwargs[contextType].active.sensorLocations[sensorType]
    .map((option) => `${option.value}`)
    .sort()
);

const loadHarness = async ({ enableShareState = "true" } = {}) => {
  vi.resetModules();
  vi.unstubAllEnvs();

  if (enableShareState !== undefined) {
    vi.stubEnv("VITE_ENABLE_SHARE_STATE", enableShareState);
  }

  const [{ configureStore }, reducers, actions, share, config] = await Promise.all([
    import("@reduxjs/toolkit"),
    import("./reducers"),
    Promise.all([
      import("./features/mapStyleSlice"),
      import("./features/progressSlice"),
      import("./features/fetchKwargsSlice")
    ]).then(([mapStyleSlice, progressSlice, fetchKwargsSlice]) => ({
      setStyle: mapStyleSlice.setStyle,
      startThinking: progressSlice.startThinking,
      switchTab: progressSlice.switchTab,
      pickSensor: fetchKwargsSlice.pickSensor
    })),
    import("./urlShareState"),
    import("./config")
  ]);

  const makeStore = () => configureStore({
    reducer: reducers.rootReducer,
    devTools: false
  });

  return {
    makeStore,
    actions,
    share,
    config
  };
};

describe("urlShareState", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
    window.history.replaceState(null, "", "/");
  });

  it("does not hydrate or sync when feature flag is disabled", async () => {
    const { makeStore, actions, share } = await loadHarness({ enableShareState: "false" });
    const store = makeStore();
    store.dispatch(actions.setStyle(mapStyleFixture));

    const token = await share.encodeShareState({
      v: 1,
      c: "legacyRealtime",
      g: ["1"],
      p: ["101"]
    });

    window.history.replaceState(null, "", `/?foo=bar#s=${token}`);

    const hydrated = await share.hydrateShareStateToRedux({
      dispatch: store.dispatch,
      getState: store.getState
    });

    expect(hydrated).toBe(false);
    expect(window.location.hash).toBe(`#s=${token}`);

    const replaceSpy = vi.spyOn(window.history, "replaceState");
    const stopSync = share.startShareStateSync(store);

    store.dispatch(actions.switchTab("legacyGauge"));
    store.dispatch(actions.pickSensor({
      contextType: "legacyGauge",
      sensorLocationType: "gauge",
      selectedOptions: [{ value: "1", label: "1" }]
    }));
    await flushAsync();

    expect(replaceSpy).not.toHaveBeenCalled();
    expect(window.location.hash).toBe(`#s=${token}`);

    stopSync();
  });

  it("builds deterministic share state from the active context", async () => {
    const { makeStore, actions, share, config } = await loadHarness({ enableShareState: "true" });
    const store = makeStore();

    store.dispatch(actions.switchTab(config.CONTEXT_TYPES.legacyRealtime));
    store.dispatch(actions.pickSensor({
      contextType: config.CONTEXT_TYPES.legacyRealtime,
      sensorLocationType: "gauge",
      selectedOptions: [{ value: "3" }, { value: "1" }, { value: "3" }]
    }));
    store.dispatch(actions.pickSensor({
      contextType: config.CONTEXT_TYPES.legacyRealtime,
      sensorLocationType: "pixel",
      selectedOptions: [{ value: 102 }, { value: 101 }]
    }));

    const state = share.buildShareStateFromStore(store.getState());
    expect(state).toEqual({
      v: 1,
      c: config.CONTEXT_TYPES.legacyRealtime,
      g: ["1", "3"],
      p: ["101", "102"]
    });
  });

  it("enforces context-specific sensor rules", async () => {
    const { makeStore, actions, share, config } = await loadHarness({ enableShareState: "true" });
    const store = makeStore();

    store.dispatch(actions.switchTab(config.CONTEXT_TYPES.legacyGarr));
    store.dispatch(actions.pickSensor({
      contextType: config.CONTEXT_TYPES.legacyGarr,
      sensorLocationType: "gauge",
      selectedOptions: [{ value: "1" }]
    }));
    store.dispatch(actions.pickSensor({
      contextType: config.CONTEXT_TYPES.legacyGarr,
      sensorLocationType: "pixel",
      selectedOptions: [{ value: "101" }]
    }));

    const state = share.buildShareStateFromStore(store.getState());
    expect(state).toEqual({
      v: 1,
      c: config.CONTEXT_TYPES.legacyGarr,
      g: [],
      p: ["101"]
    });
  });

  it("encodes and decodes state round-trip", async () => {
    const { share, config } = await loadHarness({ enableShareState: "true" });

    const token = await share.encodeShareState({
      v: 1,
      c: config.CONTEXT_TYPES.legacyRealtime,
      g: ["3", "1"],
      p: ["102", "101"]
    });

    const decoded = await share.decodeShareState(token);

    expect(decoded).toEqual({
      v: 1,
      c: config.CONTEXT_TYPES.legacyRealtime,
      g: ["1", "3"],
      p: ["101", "102"]
    });
  });

  it("returns null for malformed tokens", async () => {
    const { share } = await loadHarness({ enableShareState: "true" });
    await expect(share.decodeShareState("this-is-not-valid-base64url")).resolves.toBeNull();
  });

  it("hydrates redux from a valid hash token and canonicalizes hash", async () => {
    const { makeStore, actions, share, config } = await loadHarness({ enableShareState: "true" });
    const store = makeStore();
    store.dispatch(actions.setStyle(mapStyleFixture));

    const token = await share.encodeShareState({
      v: 1,
      c: config.CONTEXT_TYPES.legacyRealtime,
      g: ["1"],
      p: ["101", "999"]
    });

    window.history.replaceState(null, "", `/?foo=bar#s=${token}`);

    const hydrated = await share.hydrateShareStateToRedux({
      dispatch: store.dispatch,
      getState: store.getState
    });

    expect(hydrated).toBe(true);
    const nextState = store.getState();
    expect(nextState.progress.tab).toBe(config.CONTEXT_TYPES.legacyRealtime);
    expect(selectedIds(nextState, config.CONTEXT_TYPES.legacyRealtime, "gauge")).toEqual(["1"]);
    expect(selectedIds(nextState, config.CONTEXT_TYPES.legacyRealtime, "pixel")).toEqual(["101"]);

    const fromHash = await share.readShareStateFromHash();
    expect(fromHash).toEqual({
      v: 1,
      c: config.CONTEXT_TYPES.legacyRealtime,
      g: ["1"],
      p: ["101"]
    });
    expect(window.location.search).toBe("?foo=bar");
  });

  it("migrates legacy query param state to hash token", async () => {
    const { makeStore, actions, share, config } = await loadHarness({ enableShareState: "true" });
    const store = makeStore();
    store.dispatch(actions.setStyle(mapStyleFixture));

    const legacyJson = encodeURIComponent(JSON.stringify({
      context: config.CONTEXT_TYPES.legacyGauge,
      gauge: ["1", "3"],
      pixel: ["101"]
    }));
    window.history.replaceState(null, "", `/?state=${legacyJson}&foo=bar`);

    const hydrated = await share.hydrateShareStateToRedux({
      dispatch: store.dispatch,
      getState: store.getState
    });

    expect(hydrated).toBe(true);
    const nextState = store.getState();
    expect(nextState.progress.tab).toBe(config.CONTEXT_TYPES.legacyGauge);
    expect(selectedIds(nextState, config.CONTEXT_TYPES.legacyGauge, "gauge")).toEqual(["1", "3"]);
    expect(selectedIds(nextState, config.CONTEXT_TYPES.legacyGauge, "pixel")).toEqual([]);

    expect(window.location.hash.startsWith("#s=")).toBe(true);
    expect(window.location.search).toBe("?foo=bar");
  });

  it("syncs hash from store changes and skips unchanged writes when enabled", async () => {
    const { makeStore, actions, share, config } = await loadHarness({ enableShareState: "true" });
    const store = makeStore();
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    const stopSync = share.startShareStateSync(store);

    await flushAsync();
    const afterInitialSyncCount = replaceSpy.mock.calls.length;

    store.dispatch(actions.startThinking("unrelated"));
    await flushAsync();
    expect(replaceSpy.mock.calls.length).toBe(afterInitialSyncCount);

    store.dispatch(actions.switchTab(config.CONTEXT_TYPES.legacyRealtime));
    store.dispatch(actions.pickSensor({
      contextType: config.CONTEXT_TYPES.legacyRealtime,
      sensorLocationType: "gauge",
      selectedOptions: [{ value: "1", label: "1" }]
    }));

    await flushAsync();

    expect(replaceSpy.mock.calls.length).toBeGreaterThan(afterInitialSyncCount);
    const stateFromHash = await share.readShareStateFromHash();
    expect(stateFromHash).toEqual({
      v: 1,
      c: config.CONTEXT_TYPES.legacyRealtime,
      g: ["1"],
      p: []
    });

    stopSync();
  });
});
