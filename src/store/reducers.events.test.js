import { describe, expect, it } from "vitest";

import { pickRainfallDateTimeRange } from "./features/fetchKwargsSlice";
import {
  appendRainfallEventsPage,
  completeRainfallEventsLoad,
  failRainfallEventsLoad,
  startRainfallEventsLoad
} from "./features/rainfallEventsSlice";
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

  it("sets loading metadata and clears prior error when starting paginated load", () => {
    const state = buildState();
    state.rainfallEvents.error = "older failure";
    state.rainfallEvents.loadStatus = "failed";

    const nextState = rootReducer(state, startRainfallEventsLoad());

    expect(nextState.rainfallEvents.loadStatus).toBe("loading");
    expect(nextState.rainfallEvents.error).toBeNull();
    expect(nextState.rainfallEvents.list).toEqual([]);
    expect(nextState.rainfallEvents.loadedCount).toBe(0);
    expect(nextState.rainfallEvents.loadedPages).toBe(0);
  });

  it("appends pages, de-duplicates events, and preserves selected event state", () => {
    const state = buildState();

    const nextState = rootReducer(
      rootReducer(state, appendRainfallEventsPage({
        events: [
          {
            eventid: "event-1",
            startDt: "2025-01-01T01:00:00",
            endDt: "2025-01-01T04:00:00",
            hours: 3,
            selected: false,
            report_url: "https://example.local/report-a.pdf"
          },
          {
            eventid: "event-3",
            startDt: "2025-01-03T01:00:00",
            endDt: "2025-01-03T05:00:00",
            hours: 4,
            selected: false
          }
        ],
        totalCount: 99,
        nextPageUrl: "https://example.local/events?page=2"
      })),
      appendRainfallEventsPage({
        events: [
          {
            eventid: "event-3",
            startDt: "2025-01-03T01:00:00",
            endDt: "2025-01-03T05:00:00",
            hours: 4,
            selected: false
          }
        ],
        totalCount: 99,
        nextPageUrl: null
      })
    );

    expect(nextState.rainfallEvents.list).toHaveLength(3);
    expect(nextState.rainfallEvents.list.find((event) => event.eventid === "event-1")?.selected).toBe(true);
    expect(nextState.rainfallEvents.loadedPages).toBe(2);
    expect(nextState.rainfallEvents.loadedCount).toBe(3);
    expect(nextState.rainfallEvents.totalCount).toBe(99);
  });

  it("keeps partial events when paginated load fails", () => {
    const state = rootReducer(
      rootReducer(buildState(), startRainfallEventsLoad()),
      appendRainfallEventsPage({
        events: [
          {
            eventid: "event-3",
            startDt: "2025-01-03T01:00:00",
            endDt: "2025-01-03T05:00:00",
            hours: 4,
            selected: false
          }
        ],
        totalCount: 4,
        nextPageUrl: "https://example.local/events?page=2"
      })
    );

    const nextState = rootReducer(state, failRainfallEventsLoad({
      error: "network down",
      nextPageUrl: "https://example.local/events?page=2"
    }));

    expect(nextState.rainfallEvents.loadStatus).toBe("failed");
    expect(nextState.rainfallEvents.error).toBe("network down");
    expect(nextState.rainfallEvents.list).toHaveLength(1);
    expect(nextState.rainfallEvents.loadedCount).toBe(1);
  });

  it("marks paginated load as succeeded when complete", () => {
    const state = rootReducer(
      rootReducer(buildState(), startRainfallEventsLoad()),
      appendRainfallEventsPage({
        events: [
          {
            eventid: "event-4",
            startDt: "2025-01-04T01:00:00",
            endDt: "2025-01-04T05:00:00",
            hours: 4,
            selected: false
          }
        ],
        totalCount: 1,
        nextPageUrl: null
      })
    );

    const nextState = rootReducer(state, completeRainfallEventsLoad());

    expect(nextState.rainfallEvents.loadStatus).toBe("succeeded");
    expect(nextState.rainfallEvents.error).toBeNull();
    expect(nextState.rainfallEvents.loadedCount).toBe(1);
    expect(nextState.rainfallEvents.nextPageUrl).toBeNull();
  });
});
