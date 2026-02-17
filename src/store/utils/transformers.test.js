import { describe, expect, it } from "vitest";

import {
  transformDataApiEventsJSON,
  transformRainfallResults
} from "./transformers";

const clone = (value) => JSON.parse(JSON.stringify(value));

describe("transformRainfallResults", () => {
  it("keeps canonical non-5-minute data shape and calculates totals", () => {
    const payload = {
      data: [{
        id: "8",
        data: [
          { ts: "2025-10-01T00:00:00-04:00", val: 0.5, src: "G" },
          { ts: "2025-10-01T00:15:00-04:00", val: 0.25, src: "G" }
        ]
      }]
    };

    const result = transformRainfallResults(clone(payload), { contextType: "legacyGauge" });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe("8");
    expect(result.data[0].data).toEqual(payload.data[0].data);
    expect(result.data[0].total).toBeCloseTo(0.75);
  });

  it("normalizes historic5 gauge rows into grouped canonical points with src G", () => {
    const payload = {
      data: [
        {
          id: "outer-1",
          data: [
            { ts: "2025-10-01T04:00:00", id: "160129", rainfall: 0.1 },
            { ts: "2025-10-01T04:05:00", id: "160130", rainfall: 0.2 }
          ]
        },
        {
          id: "outer-2",
          data: [
            { ts: "2025-10-01T04:10:00", id: "160129", rainfall: 0.3 }
          ]
        }
      ]
    };

    const result = transformRainfallResults(clone(payload), { contextType: "legacyGauge" });

    expect(result.data.map((series) => series.id)).toEqual(["160129", "160130"]);
    expect(result.data[0].data).toEqual([
      { ts: "2025-10-01T04:00:00", val: 0.1, src: "G" },
      { ts: "2025-10-01T04:10:00", val: 0.3, src: "G" }
    ]);
    expect(result.data[1].data).toEqual([
      { ts: "2025-10-01T04:05:00", val: 0.2, src: "G" }
    ]);
    expect(result.data[0].total).toBeCloseTo(0.4);
    expect(result.data[0].data[0]).not.toHaveProperty("rainfall");
    expect(result.data[0].data[0]).not.toHaveProperty("id");
  });

  it("normalizes historic5 calibrated radar rows with src set to null", () => {
    const payload = {
      data: [{
        id: "200001",
        data: [
          { ts: "2025-10-01T04:00:00", id: "200001", rainfall: 0.0 },
          { ts: "2025-10-01T04:05:00", id: "200001", rainfall: 0.4 }
        ]
      }]
    };

    const result = transformRainfallResults(clone(payload), { contextType: "legacyGarr" });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe("200001");
    expect(result.data[0].data).toEqual([
      { ts: "2025-10-01T04:00:00", val: 0.0, src: null },
      { ts: "2025-10-01T04:05:00", val: 0.4, src: null }
    ]);
    expect(result.data[0].total).toBeCloseTo(0.4);
  });

  it("normalizes flat historic5 rows with no nested series objects", () => {
    const payload = {
      data: [
        { ts: "2025-10-01T04:00:00", id: "160129", rainfall: 0.1 },
        { ts: "2025-10-01T04:05:00", id: "160130", rainfall: 0.2 },
        { ts: "2025-10-01T04:10:00", id: "160129", rainfall: 0.3 },
        { id: "unused-without-value" }
      ]
    };

    const result = transformRainfallResults(clone(payload), { contextType: "legacyGauge" });

    expect(result.data.map((series) => series.id)).toEqual(["160129", "160130"]);
    expect(result.data[0].data).toEqual([
      { ts: "2025-10-01T04:00:00", val: 0.1, src: "G" },
      { ts: "2025-10-01T04:10:00", val: 0.3, src: "G" }
    ]);
    expect(result.data[1].data).toEqual([
      { ts: "2025-10-01T04:05:00", val: 0.2, src: "G" }
    ]);
    expect(result.data.find((series) => series.id === "unused-without-value")).toBeUndefined();
    expect(result.data[0].total).toBeCloseTo(0.4);
  });

  it("does not throw when non-canonical rows are missing a data array", () => {
    const payload = {
      data: [
        {
          id: "8",
          data: [{ ts: "2025-10-01T00:00:00-04:00", val: 0.5, src: "G" }]
        },
        {
          id: "bad-row"
        }
      ]
    };

    const result = transformRainfallResults(clone(payload), { contextType: "legacyGauge" });

    expect(result.data).toHaveLength(2);
    expect(result.data[0].total).toBeCloseTo(0.5);
    expect(result.data[1].data).toEqual([]);
    expect(result.data[1].total).toBe(0);
  });

  it("groups mixed historic5 rows by point id, falls back to outer id, and drops rows with no id", () => {
    const payload = {
      data: [
        {
          id: "500",
          data: [
            { ts: "2025-10-01T04:00:00", id: "600", rainfall: 0.5 },
            { ts: "2025-10-01T04:05:00", rainfall: 0.25 },
            { ts: "2025-10-01T04:10:00", id: null, rainfall: 0.1 }
          ]
        },
        {
          id: "700",
          data: [
            { ts: "2025-10-01T04:15:00", id: "600", rainfall: 0.75 },
            { ts: "2025-10-01T04:20:00", rainfall: 0.2 }
          ]
        },
        {
          id: null,
          data: [
            { ts: "2025-10-01T04:25:00", rainfall: 0.3 }
          ]
        }
      ]
    };

    const result = transformRainfallResults(clone(payload), { contextType: "legacyGauge" });

    expect(result.data.map((series) => series.id)).toEqual(["600", "500", "700"]);
    expect(result.data[0].data.map((point) => point.val)).toEqual([0.5, 0.75]);
    expect(result.data[1].data.map((point) => point.val)).toEqual([0.25, 0.1]);
    expect(result.data[2].data.map((point) => point.val)).toEqual([0.2]);
    expect(result.data.find((series) => series.id === null)).toBeUndefined();
    expect(result.data.reduce((sum, series) => sum + series.data.length, 0)).toBe(5);
  });
});

describe("transformDataApiEventsJSON", () => {
  it("de-duplicates exact duplicate events", () => {
    const payload = [
      {
        event_label: "storm-a",
        start_dt: "2025-07-01T00:00:00Z",
        end_dt: "2025-07-01T03:00:00Z",
        duration: 3
      },
      {
        event_label: "storm-a",
        start_dt: "2025-07-01T00:00:00Z",
        end_dt: "2025-07-01T03:00:00Z",
        duration: 3
      }
    ];

    const result = transformDataApiEventsJSON(clone(payload));

    expect(result).toHaveLength(1);
    expect(result[0].eventid).toBe("storm-a");
  });

  it("keeps distinct events when timestamps differ", () => {
    const payload = [
      {
        event_label: "storm-a",
        start_dt: "2025-07-01T00:00:00Z",
        end_dt: "2025-07-01T03:00:00Z",
        duration: 3
      },
      {
        event_label: "storm-a",
        start_dt: "2025-07-02T00:00:00Z",
        end_dt: "2025-07-02T03:00:00Z",
        duration: 3
      }
    ];

    const result = transformDataApiEventsJSON(clone(payload));

    expect(result).toHaveLength(2);
    expect(result[0].eventid).toBe("storm-a");
    expect(result[1].eventid).toBe("storm-a");
  });

  it("reads events from paginated results payload", () => {
    const payload = {
      count: 2,
      next: "https://example.local/rainfall/v2/rainfall-events/?format=json&page=2",
      previous: null,
      results: [
        {
          event_label: "storm-a",
          start_dt: "2025-07-01T00:00:00Z",
          end_dt: "2025-07-01T03:00:00Z",
          duration: 3
        },
        {
          event_label: "storm-b",
          start_dt: "2025-07-03T00:00:00Z",
          end_dt: "2025-07-03T02:00:00Z",
          duration: 2
        }
      ]
    };

    const result = transformDataApiEventsJSON(clone(payload));

    expect(result).toHaveLength(2);
    expect(result[0].eventid).toBe("storm-a");
    expect(result[1].eventid).toBe("storm-b");
  });

  it("returns empty array for paginated payload with empty results", () => {
    const payload = {
      count: 0,
      next: null,
      previous: null,
      results: []
    };

    const result = transformDataApiEventsJSON(clone(payload));

    expect(result).toEqual([]);
  });
});
