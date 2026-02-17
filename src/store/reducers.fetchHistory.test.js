import { afterEach, describe, expect, it, vi } from "vitest";

import { CONTEXT_TYPES } from "./config";
import { initialState } from "./initialState";
import {
  pickActiveResultItem,
  removeFetchHistoryItem,
  requestRainfallDataFail
} from "./features/fetchKwargsSlice";
import { rootReducer } from "./reducers";

const CONTEXT = CONTEXT_TYPES.legacyRealtime;

const buildFetchHistoryItem = ({ requestId, isActive = false, isFetching = 0 }) => ({
  fetchKwargs: {
    sensorLocations: {
      gauge: [],
      pixel: []
    }
  },
  requestId,
  isFetching,
  isActive,
  results: false,
  status: "finished",
  messages: []
});

const buildState = () => {
  const state = JSON.parse(JSON.stringify(initialState));
  state.fetchKwargs[CONTEXT].history = [
    buildFetchHistoryItem({ requestId: "request-a", isActive: true, isFetching: 1 }),
    buildFetchHistoryItem({ requestId: "request-b", isActive: false, isFetching: 0 })
  ];
  return state;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetch history reducers", () => {
  it("removes only the targeted request from the targeted context history", () => {
    const state = buildState();

    const nextState = rootReducer(
      state,
      removeFetchHistoryItem({ contextType: CONTEXT, requestId: "request-b" })
    );

    expect(nextState.fetchKwargs[CONTEXT].history.map((item) => item.requestId)).toEqual(["request-a"]);
    expect(nextState.fetchKwargs[CONTEXT_TYPES.legacyGauge].history).toHaveLength(0);
    expect(nextState.fetchKwargs[CONTEXT_TYPES.legacyGarr].history).toHaveLength(0);
  });

  it("treats pickActiveResultItem as a no-op when requestId does not exist", () => {
    const state = buildState();
    vi.spyOn(console, "log").mockImplementation(() => {});

    const nextState = rootReducer(
      state,
      pickActiveResultItem({ contextType: CONTEXT, requestId: "missing-request-id" })
    );

    expect(nextState.fetchKwargs[CONTEXT].history[0].isActive).toBe(true);
    expect(nextState.fetchKwargs[CONTEXT].history[1].isActive).toBe(false);
  });

  it("treats requestRainfallDataFail as a no-op when requestId does not exist", () => {
    const state = buildState();
    vi.spyOn(console, "log").mockImplementation(() => {});

    expect(() => rootReducer(
      state,
      requestRainfallDataFail({
        contextType: CONTEXT,
        requestId: "missing-request-id",
        status: "error",
        messages: ["not found"],
        results: {}
      })
    )).not.toThrow();

    const nextState = rootReducer(
      state,
      requestRainfallDataFail({
        contextType: CONTEXT,
        requestId: "missing-request-id",
        status: "error",
        messages: ["not found"],
        results: {}
      })
    );

    expect(nextState.fetchKwargs[CONTEXT].history[0].isFetching).toBe(1);
    expect(nextState.fetchKwargs[CONTEXT].history[0].status).toBe("finished");
    expect(nextState.fetchKwargs[CONTEXT].history[0].messages).toEqual([]);
  });
});
