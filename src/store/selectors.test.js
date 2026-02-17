import { describe, expect, it } from "vitest";

import {
  selectFilteredRainfallEventsByDay,
  selectFilteredRainfallEventYearSections,
  selectEarliestlegacyGauge5MinTS,
  selectEarliestlegacyGarr5MinTS,
  selectLatestlegacyRealtimeGaugeTS,
  selectLatestlegacyRealtimeRadarTS,
  selectLatestlegacyGauge5MinTS,
  selectLatestlegacyGarr5MinTS,
  selectLatestlegacyGaugeTS,
  selectLatestlegacyGarrTS
} from "./selectors";

describe("latest timestamp selectors", () => {
  it("maps legacy realtime latest timestamp keys", () => {
    const state = {
      stats: {
        latest: {
          "realtime-gauge": "2026-02-10T00:00:00Z",
          "realtime-radar": "2026-02-11T00:00:00Z"
        }
      }
    };

    expect(selectLatestlegacyRealtimeGaugeTS(state)).toBe("2026-02-10T00:00:00Z");
    expect(selectLatestlegacyRealtimeRadarTS(state)).toBe("2026-02-11T00:00:00Z");
  });

  it("maps legacy default latest timestamp keys", () => {
    const state = {
      stats: {
        latest: {
          "calibrated-gauge": "2026-01-30T00:00:00Z",
          "calibrated-radar": "2026-01-31T00:00:00Z"
        }
      }
    };

    expect(selectLatestlegacyGaugeTS(state)).toBe("2026-01-30T00:00:00Z");
    expect(selectLatestlegacyGarrTS(state)).toBe("2026-01-31T00:00:00Z");
  });

  it("maps legacy 5-minute earliest/latest timestamp keys", () => {
    const state = {
      stats: {
        latest: {
          "earliest-5min-calibrated-gauge": "2025-01-01T00:00:00Z",
          "latest-5min-calibrated-gauge": "2026-01-01T00:00:00Z",
          "earliest-5min-calibrated-radar": "2025-02-01T00:00:00Z",
          "latest-5min-calibrated-radar": "2026-02-01T00:00:00Z"
        }
      }
    };

    expect(selectEarliestlegacyGauge5MinTS(state)).toBe("2025-01-01T00:00:00Z");
    expect(selectLatestlegacyGauge5MinTS(state)).toBe("2026-01-01T00:00:00Z");
    expect(selectEarliestlegacyGarr5MinTS(state)).toBe("2025-02-01T00:00:00Z");
    expect(selectLatestlegacyGarr5MinTS(state)).toBe("2026-02-01T00:00:00Z");
  });

  it("returns undefined when 5-minute keys are missing", () => {
    const state = {
      stats: {
        latest: {}
      }
    };

    expect(selectEarliestlegacyGauge5MinTS(state)).toBeUndefined();
    expect(selectLatestlegacyGauge5MinTS(state)).toBeUndefined();
    expect(selectEarliestlegacyGarr5MinTS(state)).toBeUndefined();
    expect(selectLatestlegacyGarr5MinTS(state)).toBeUndefined();
  });
});

describe("rainfall event heatmap selectors", () => {
  it("memoizes grouped events by day for unchanged state", () => {
    const state = {
      rainfallEvents: {
        list: [
          {
            eventid: "event-a",
            startDt: "2025-06-10T01:00:00Z",
            endDt: "2025-06-10T02:00:00Z",
            hours: 1
          }
        ],
        filters: { maxHours: 24 }
      }
    };

    const first = selectFilteredRainfallEventsByDay(state);
    const second = selectFilteredRainfallEventsByDay(state);

    expect(second).toBe(first);
  });

  it("memoizes year sections for unchanged state", () => {
    const state = {
      rainfallEvents: {
        list: [
          {
            eventid: "event-a",
            startDt: "2025-06-10T01:00:00Z",
            endDt: "2025-06-10T02:00:00Z",
            hours: 1
          }
        ],
        filters: { maxHours: 24 }
      }
    };

    const first = selectFilteredRainfallEventYearSections(state);
    const second = selectFilteredRainfallEventYearSections(state);

    expect(second).toBe(first);
  });
});
