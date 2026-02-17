import { describe, expect, it } from "vitest";

import { pickRainfallDateTimeRange } from "./features/fetchKwargsSlice";
import { CONTEXT_TYPES } from "./config";
import { initialState } from "./initialState";
import { rootReducer } from "./reducers";

const CONTEXT = CONTEXT_TYPES.legacyGauge;

const buildState = () => {
  const state = JSON.parse(JSON.stringify(initialState));

  state.rainfallEvents.list = [
    {
      eventid: "event-1",
      startDt: "2025-01-01T01:00:00",
      endDt: "2025-01-01T04:00:00",
      hours: 3,
      selected: true,
      isFetching: false
    },
    {
      eventid: "event-2",
      startDt: "2025-01-02T01:00:00",
      endDt: "2025-01-02T03:00:00",
      hours: 2,
      selected: false,
      isFetching: false
    }
  ];

  return state;
};

describe("event reducers", () => {
  it("clears selected events when manually picking a date range", () => {
    const state = buildState();
    const nextState = rootReducer(
      state,
      pickRainfallDateTimeRange({
        contextType: CONTEXT,
        startDt: "2025-01-15T00:00:00",
        endDt: "2025-01-16T00:00:00"
      })
    );

    expect(nextState.fetchKwargs[CONTEXT].active.startDt).toBe("2025-01-15T00:00:00");
    expect(nextState.fetchKwargs[CONTEXT].active.endDt).toBe("2025-01-16T00:00:00");
    expect(nextState.rainfallEvents.list.every((event) => event.selected === false)).toBe(true);
  });
});
