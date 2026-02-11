import { describe, expect, it, vi } from "vitest";

import { CONTEXT_TYPES, SENSOR_TYPES } from "./config";
import { deleteDownload } from "./middleware";
import {
  highlightSensor,
  pickActiveResultItem,
  removeFetchHistoryItem,
  resetLayerSrcs
} from "./actions";

const CONTEXT = CONTEXT_TYPES.legacyRealtime;

const buildHistoryItem = ({ requestId, isActive = false }) => ({
  requestId,
  isActive
});

const buildState = ({ history, sensorLocations = { gauge: [], pixel: [] } }) => ({
  fetchKwargs: {
    [CONTEXT_TYPES.legacyRealtime]: {
      active: {
        sensorLocations
      },
      history
    },
    [CONTEXT_TYPES.legacyGauge]: {
      active: {
        sensorLocations: {
          gauge: [],
          pixel: []
        }
      },
      history: []
    },
    [CONTEXT_TYPES.legacyGarr]: {
      active: {
        sensorLocations: {
          gauge: [],
          pixel: []
        }
      },
      history: []
    }
  }
});

const createDispatchWithStateMutation = ({ contextType, getStateRef, setStateRef }) => (
  vi.fn((action) => {
    if (action?.type === removeFetchHistoryItem.type) {
      const currentState = getStateRef();
      const updatedHistory = currentState.fetchKwargs[contextType].history
        .filter((item) => item.requestId !== action.payload.requestId);

      setStateRef({
        ...currentState,
        fetchKwargs: {
          ...currentState.fetchKwargs,
          [contextType]: {
            ...currentState.fetchKwargs[contextType],
            history: updatedHistory
          }
        }
      });
    }
  })
);

describe("deleteDownload middleware", () => {
  it("deleting a non-active item dispatches only removeFetchHistoryItem", () => {
    let state = buildState({
      history: [
        buildHistoryItem({ requestId: "request-a", isActive: true }),
        buildHistoryItem({ requestId: "request-b", isActive: false })
      ]
    });

    const getState = vi.fn(() => state);
    const dispatch = createDispatchWithStateMutation({
      contextType: CONTEXT,
      getStateRef: () => state,
      setStateRef: (nextState) => {
        state = nextState;
      }
    });

    deleteDownload({ contextType: CONTEXT, requestId: "request-b" })(dispatch, getState);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      removeFetchHistoryItem({ contextType: CONTEXT, requestId: "request-b" })
    );
  });

  it("deleting an active item with remaining history activates the newest remaining request", () => {
    let state = buildState({
      history: [
        buildHistoryItem({ requestId: "request-a", isActive: false }),
        buildHistoryItem({ requestId: "request-b", isActive: true }),
        buildHistoryItem({ requestId: "request-c", isActive: false })
      ]
    });

    const getState = vi.fn(() => state);
    const dispatch = createDispatchWithStateMutation({
      contextType: CONTEXT,
      getStateRef: () => state,
      setStateRef: (nextState) => {
        state = nextState;
      }
    });

    deleteDownload({ contextType: CONTEXT, requestId: "request-b" })(dispatch, getState);

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      removeFetchHistoryItem({ contextType: CONTEXT, requestId: "request-b" })
    );
    expect(dispatch).toHaveBeenNthCalledWith(
      2,
      pickActiveResultItem({ contextType: CONTEXT, requestId: "request-c" })
    );
  });

  it("deleting an active last item with no selected sensors only resets layer sources", () => {
    let state = buildState({
      history: [
        buildHistoryItem({ requestId: "request-a", isActive: true })
      ],
      sensorLocations: {
        gauge: [],
        pixel: []
      }
    });

    const getState = vi.fn(() => state);
    const dispatch = createDispatchWithStateMutation({
      contextType: CONTEXT,
      getStateRef: () => state,
      setStateRef: (nextState) => {
        state = nextState;
      }
    });

    deleteDownload({ contextType: CONTEXT, requestId: "request-a" })(dispatch, getState);

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      removeFetchHistoryItem({ contextType: CONTEXT, requestId: "request-a" })
    );

    const secondAction = dispatch.mock.calls[1][0];
    expect(secondAction.type).toBe(resetLayerSrcs.type);
    expect(secondAction.payload.lyrSrcNames.sort()).toEqual(Object.keys(SENSOR_TYPES).sort());
  });

  it("deleting an active last item re-applies selected sensor highlights", () => {
    let state = buildState({
      history: [
        buildHistoryItem({ requestId: "request-a", isActive: true })
      ],
      sensorLocations: {
        gauge: [{ value: "g-1", label: "Gauge 1" }],
        pixel: [{ value: "p-1", label: "Pixel 1" }]
      }
    });

    const getState = vi.fn(() => state);
    const dispatch = createDispatchWithStateMutation({
      contextType: CONTEXT,
      getStateRef: () => state,
      setStateRef: (nextState) => {
        state = nextState;
      }
    });

    deleteDownload({ contextType: CONTEXT, requestId: "request-a" })(dispatch, getState);

    expect(dispatch).toHaveBeenCalledTimes(4);
    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      removeFetchHistoryItem({ contextType: CONTEXT, requestId: "request-a" })
    );

    const secondAction = dispatch.mock.calls[1][0];
    expect(secondAction.type).toBe(resetLayerSrcs.type);
    expect(secondAction.payload.lyrSrcNames.sort()).toEqual(Object.keys(SENSOR_TYPES).sort());

    const highlightActions = dispatch.mock.calls.slice(2).map((call) => call[0]);
    expect(highlightActions).toHaveLength(2);
    expect(highlightActions.map((action) => action.type)).toEqual([
      highlightSensor.type,
      highlightSensor.type
    ]);
    expect(highlightActions.map((action) => action.payload.sensorLocationType).sort()).toEqual([
      "gauge",
      "pixel"
    ]);
  });
});
