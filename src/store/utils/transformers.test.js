import { describe, expect, it } from "vitest";

import {
  joinTabletoGeojson,
  transformDataApiEventsJSON,
  transformRainfallResults
} from "./transformers";

const clone = (value) => JSON.parse(JSON.stringify(value));

describe("joinTabletoGeojson", () => {
  const feature = (id) => ({
    id,
    geometry: { type: "Point", coordinates: [-80, 40] },
    properties: { id, label: `Pixel ${id}`, total: "" }
  });
  const collection = (features) => ({ type: "FeatureCollection", features });

  it("keeps feature order, merges the first matching row, and leaves inputs unchanged", () => {
    const geojson = collection([feature("8"), feature("missing"), feature("9")]);
    const table = [{ id: "9", total: null }, { id: "8", total: 0 }, { id: "8", total: 99 }];
    const originalGeojson = clone(geojson);
    const originalTable = clone(table);

    const result = joinTabletoGeojson(geojson, table, undefined, "id");

    expect(result).toEqual(collection([
      { ...geojson.features[0], properties: { id: "8", label: "Pixel 8", total: 0 } },
      geojson.features[1],
      { ...geojson.features[2], properties: { id: "9", label: "Pixel 9", total: null } }
    ]));
    expect(result.features[0]).not.toBe(geojson.features[0]);
    expect(result.features[0].geometry).toBe(geojson.features[0].geometry);
    expect(result.features[1]).toBe(geojson.features[1]);
    expect(geojson).toEqual(originalGeojson);
    expect(table).toEqual(originalTable);
  });

  it.each([
    ["properties.id", "sensor.id"],
    [["properties", "id"], ["sensor", "id"]]
  ])("supports nested join paths %j and %j when dropping unmatched features", (featurePath, rowPath) => {
    const geojson = collection([feature("missing"), feature("8"), feature("9")]);
    const table = [{ sensor: { id: "9" }, total: 2 }, { sensor: { id: "8" }, total: 1 }];

    const result = joinTabletoGeojson(geojson, table, featurePath, rowPath, true);

    expect(result.features.map(({ id, properties }) => [id, properties.total])).toEqual([["8", 1], ["9", 2]]);
  });

  it("preserves strict key equality, including missing keys and nonmatching NaN", () => {
    const ids = ["8", 8, "9", false, null, undefined, NaN, -0];
    const geojson = collection(ids.map(feature));
    const table = [
      { id: 8, total: 1 }, { id: "8", total: 2 }, { id: 9, total: 3 },
      { id: false, total: 4 }, { id: null, total: 5 }, { total: 6 },
      { id: NaN, total: 7 }, { id: 0, total: 8 }
    ];

    const result = joinTabletoGeojson(geojson, table, "id", "id");

    expect(result.features.map(f => f.properties.total)).toEqual([2, 1, "", 4, 5, 6, "", 8]);
    expect(result.features[2]).toBe(geojson.features[2]);
    expect(result.features[6]).toBe(geojson.features[6]);
  });

  it("preserves an undefined first match rather than taking a later duplicate", () => {
    const geojson = collection([feature(undefined)]);
    const result = joinTabletoGeojson(geojson, [undefined, { total: 5 }], "id", "id", true);
    expect(result).toEqual(collection([]));
  });

  it("handles empty tables and empty geometry with either unmatched-feature policy", () => {
    const geojson = collection([feature("8")]);
    expect(joinTabletoGeojson(geojson, [], "id", "id")).toEqual(geojson);
    expect(joinTabletoGeojson(geojson, [], "id", "id", true)).toEqual(collection([]));
    expect(joinTabletoGeojson(collection([]), [{ id: "8" }], "id", "id")).toEqual(collection([]));
  });

  it("keeps key reads linear as geometry and result counts grow", () => {
    let keyReads = 0;
    const features = Array.from({ length: 1000 }, (_, i) => ({
      ...feature(String(i)),
      properties: { get id() { keyReads++; return String(i); } }
    }));
    const table = Array.from({ length: 800 }, (_, i) => ({
      sensor: { get id() { keyReads++; return String(i); } }, total: i
    }));

    const result = joinTabletoGeojson(collection(features), table, "properties.id", "sensor.id");

    expect(result.features).toHaveLength(1000);
    expect(result.features[799].properties.total).toBe(799);
    expect(result.features[800]).toBe(features[800]);
    expect(keyReads).toBeLessThanOrEqual(2 * (features.length + table.length));
  });
});

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
    expect(result.data[1].total).toBeNull();
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

describe("missing rainfall", () => {
  it("keeps null observations and distinguishes empty totals from measured zero", () => {
    const result = transformRainfallResults({ data: [
      { id: "missing", data: [{ ts: "2026-01-01", val: null, src: "N/D" }] },
      { id: "zero", data: [{ ts: "2026-01-01", val: 0 }, { ts: "2026-01-02", val: null }] },
      { id: "partial", data: [{ ts: "2026-01-01", val: 1 }, { ts: "2026-01-02", val: null }] }
    ] });
    expect(result.data.map((row) => row.total)).toEqual([null, 0, 1]);
    expect(result.data[0].data[0].val).toBeNull();
  });
  it("retains a null rainfall field in the existing five-minute adapter", () => {
    const result = transformRainfallResults({ data: [{ id: "8", ts: "2026-01-01", rainfall: null }] }, { contextType: "legacyGauge" });
    expect(result.data[0].data[0].val).toBeNull();
    expect(result.data[0].total).toBeNull();
  });
});
