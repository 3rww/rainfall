import { describe, expect, it } from "vitest";
import { parseZonedDateTime } from "../../../store/utils/dateTime";

import {
  buildDownloadChartData,
  buildDownloadRowsAndFields,
  buildSwmmInpSnippet,
  CHART_SERIES_MODE,
  CHART_TIMESTAMP_RULE,
  extractChartTimestamp,
  formatIsoForExcel,
  getSwmmIntervalFromRollup,
  normalizeDownloadRow
} from "./downloadTableUtils";

describe("download table datetime normalization", () => {
  it("formats single ISO timestamps with offsets for Excel", () => {
    expect(formatIsoForExcel("2025-10-01T00:00:00-04:00")).toBe("10/01/2025 00:00:00");
  });

  it("preserves UTC wall time when parsing Z timestamps", () => {
    expect(formatIsoForExcel("2025-10-01T00:00:00Z")).toBe("10/01/2025 00:00:00");
  });

  it("returns null for invalid ISO timestamps", () => {
    expect(formatIsoForExcel("not-a-timestamp")).toBeNull();
  });

  it("splits and formats range timestamps into start_ts and end_ts", () => {
    const row = {
      ts: "2025-10-01T00:00:00-04:00/2025-10-01T01:00:00-04:00",
      val: 0.75,
      src: "G"
    };

    expect(normalizeDownloadRow(row)).toEqual({
      start_ts: "10/01/2025 00:00:00",
      end_ts: "10/01/2025 01:00:00",
      val: 0.75,
      src: "G"
    });
  });

  it("keeps invalid ts values unchanged in normalized rows", () => {
    const row = {
      ts: "invalid-ts",
      val: 1
    };

    expect(normalizeDownloadRow(row)).toEqual({
      ts: "invalid-ts",
      val: 1
    });
  });

  it("builds deterministic fields and preserves flattened row attributes", () => {
    const resultsTableData = {
      gauge: [{
        id: "8",
        data: [
          {
            ts: "2025-10-01T00:00:00-04:00",
            val: 0.5,
            src: "G",
            quality: "ok"
          },
          {
            ts: "2025-10-01T00:00:00-04:00/2025-10-01T01:00:00-04:00",
            val: 0.75,
            src: "G"
          }
        ]
      }],
      pixel: [{
        id: "100",
        data: [{
          ts: "invalid-ts",
          val: 0.1,
          src: "R"
        }]
      }]
    };

    const { rows, fields } = buildDownloadRowsAndFields(resultsTableData);

    expect(rows).toHaveLength(3);
    expect(fields).toEqual(["start_ts", "end_ts", "ts", "val", "src", "id", "type", "quality"]);

    expect(rows[0]).toEqual({
      ts: "10/01/2025 00:00:00",
      val: 0.5,
      src: "G",
      quality: "ok",
      id: "8",
      type: "gauge"
    });
    expect(rows[1]).toEqual({
      start_ts: "10/01/2025 00:00:00",
      end_ts: "10/01/2025 01:00:00",
      val: 0.75,
      src: "G",
      id: "8",
      type: "gauge"
    });
    expect(rows[2]).toEqual({
      ts: "invalid-ts",
      val: 0.1,
      src: "R",
      id: "100",
      type: "pixel"
    });
  });

  it("extractChartTimestamp uses the start of a range by default", () => {
    const rawTimestamp = "2025-10-01T00:00:00-04:00/2025-10-01T01:00:00-04:00";
    const expectedStartMs = parseZonedDateTime("2025-10-01T00:00:00-04:00", true).valueOf();

    expect(extractChartTimestamp(rawTimestamp)).toBe(expectedStartMs);
    expect(extractChartTimestamp(rawTimestamp, CHART_TIMESTAMP_RULE.start)).toBe(expectedStartMs);
  });

  it("buildDownloadChartData creates distinct series per sensor type and id", () => {
    const resultsTableData = {
      gauge: [{
        id: "8",
        data: [
          { ts: "2025-10-01T00:00:00-04:00", val: 0.5 },
          { ts: "2025-10-01T00:15:00-04:00", val: 0.75 }
        ]
      }],
      pixel: [{
        id: "8",
        data: [
          { ts: "2025-10-01T00:00:00-04:00", val: 0.2 }
        ]
      }]
    };

    const { rows, series } = buildDownloadChartData(resultsTableData, {
      seriesMode: CHART_SERIES_MODE.perSensor
    });
    const firstTimestampMs = parseZonedDateTime("2025-10-01T00:00:00-04:00", true).valueOf();
    const secondTimestampMs = parseZonedDateTime("2025-10-01T00:15:00-04:00", true).valueOf();

    expect(series).toEqual([
      { key: "gauge:8", label: "Gauge 8", sensorType: "gauge", sensorId: "8" },
      { key: "pixel:8", label: "Pixel 8", sensorType: "pixel", sensorId: "8" }
    ]);

    expect(rows).toEqual([
      { timestampMs: firstTimestampMs, "gauge:8": 0.5, "pixel:8": 0.2 },
      { timestampMs: secondTimestampMs, "gauge:8": 0.75 }
    ]);
  });

  it("buildDownloadChartData excludes invalid timestamps and non-numeric values", () => {
    const resultsTableData = {
      gauge: [{
        id: "8",
        data: [
          { ts: "invalid-ts", val: 0.5 },
          { ts: "2025-10-01T00:15:00-04:00", val: "not-a-number" }
        ]
      }],
      pixel: [{
        id: "100",
        data: [
          { ts: "2025-10-01T00:20:00-04:00", val: 0.3 }
        ]
      }]
    };

    const { rows, series } = buildDownloadChartData(resultsTableData);
    const validTimestampMs = parseZonedDateTime("2025-10-01T00:20:00-04:00", true).valueOf();

    expect(series).toEqual([
      { key: "pixel:100", label: "Pixel 100", sensorType: "pixel", sensorId: "100" }
    ]);
    expect(rows).toEqual([
      { timestampMs: validTimestampMs, "pixel:100": 0.3 }
    ]);
  });

  it("buildDownloadChartData averageByType computes per-type means at each timestamp", () => {
    const resultsTableData = {
      gauge: [{
        id: "8",
        data: [{ ts: "2025-10-01T00:00:00-04:00", val: 0.6 }]
      }, {
        id: "9",
        data: [{ ts: "2025-10-01T00:00:00-04:00", val: 0.4 }]
      }],
      pixel: [{
        id: "100",
        data: [{ ts: "2025-10-01T00:00:00-04:00", val: 0.2 }]
      }, {
        id: "101",
        data: [{ ts: "2025-10-01T00:00:00-04:00", val: 0.4 }]
      }]
    };

    const { rows, series } = buildDownloadChartData(resultsTableData, {
      seriesMode: CHART_SERIES_MODE.averageByType
    });
    const timestampMs = parseZonedDateTime("2025-10-01T00:00:00-04:00", true).valueOf();

    expect(series).toEqual([
      { key: "avg:gauge", label: "Gauge Average", sensorType: "gauge" },
      { key: "avg:pixel", label: "Pixel Average", sensorType: "pixel" }
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].timestampMs).toBe(timestampMs);
    expect(rows[0]["avg:gauge"]).toBeCloseTo(0.5);
    expect(rows[0]["avg:pixel"]).toBeCloseTo(0.3);
  });

  it("buildDownloadChartData averageByType rounds means to 3 decimals", () => {
    const resultsTableData = {
      gauge: [{
        id: "8",
        data: [{ ts: "2025-10-01T00:00:00-04:00", val: 1 }]
      }, {
        id: "9",
        data: [{ ts: "2025-10-01T00:00:00-04:00", val: 0 }]
      }, {
        id: "10",
        data: [{ ts: "2025-10-01T00:00:00-04:00", val: 0 }]
      }]
    };

    const { rows } = buildDownloadChartData(resultsTableData, {
      seriesMode: CHART_SERIES_MODE.averageByType
    });
    const timestampMs = parseZonedDateTime("2025-10-01T00:00:00-04:00", true).valueOf();

    expect(rows).toEqual([
      { timestampMs: timestampMs, "avg:gauge": 0.333 }
    ]);
  });

  it("buildDownloadChartData averageByType preserves sparse timestamps per type", () => {
    const resultsTableData = {
      gauge: [{
        id: "8",
        data: [
          { ts: "2025-10-01T00:00:00-04:00", val: 0.3 },
          { ts: "2025-10-01T00:15:00-04:00", val: 0.9 }
        ]
      }],
      pixel: [{
        id: "100",
        data: [{ ts: "2025-10-01T00:00:00-04:00", val: 0.5 }]
      }]
    };

    const { rows } = buildDownloadChartData(resultsTableData, {
      seriesMode: CHART_SERIES_MODE.averageByType
    });
    const firstTimestampMs = parseZonedDateTime("2025-10-01T00:00:00-04:00", true).valueOf();
    const secondTimestampMs = parseZonedDateTime("2025-10-01T00:15:00-04:00", true).valueOf();

    expect(rows).toEqual([
      { timestampMs: firstTimestampMs, "avg:gauge": 0.3, "avg:pixel": 0.5 },
      { timestampMs: secondTimestampMs, "avg:gauge": 0.9 }
    ]);
  });

  it("buildDownloadChartData averageByType ignores invalid rows before averaging", () => {
    const resultsTableData = {
      gauge: [{
        id: "8",
        data: [
          { ts: "2025-10-01T00:00:00-04:00", val: 0.2 },
          { ts: "invalid-ts", val: 0.8 },
          { ts: "2025-10-01T00:00:00-04:00", val: "not-a-number" }
        ]
      }],
      pixel: [{
        id: "100",
        data: [{ ts: "2025-10-01T00:00:00-04:00", val: 0.4 }]
      }]
    };

    const { rows, series } = buildDownloadChartData(resultsTableData, {
      seriesMode: CHART_SERIES_MODE.averageByType
    });
    const timestampMs = parseZonedDateTime("2025-10-01T00:00:00-04:00", true).valueOf();

    expect(series).toEqual([
      { key: "avg:gauge", label: "Gauge Average", sensorType: "gauge" },
      { key: "avg:pixel", label: "Pixel Average", sensorType: "pixel" }
    ]);
    expect(rows).toEqual([
      { timestampMs: timestampMs, "avg:gauge": 0.2, "avg:pixel": 0.4 }
    ]);
  });
});

describe("SWMM INP export helpers", () => {
  it("maps app rollups to SWMM intervals", () => {
    expect(getSwmmIntervalFromRollup("15-minute")).toBe("0:15");
    expect(getSwmmIntervalFromRollup("Hourly")).toBe("1:00");
    expect(getSwmmIntervalFromRollup("Daily")).toBe("24:00");
    expect(getSwmmIntervalFromRollup("Total")).toBe("0:00");
    expect(getSwmmIntervalFromRollup("5-minute")).toBe("0:05");
    expect(getSwmmIntervalFromRollup("unknown")).toBe("0:00");
  });

  it("builds SWMM [RAINGAGES] and [TIMESERIES] blocks for mixed sensor results", () => {
    const resultsTableData = {
      gauge: [{
        id: "8",
        data: [
          { ts: "2025-10-01T00:00:00-04:00", val: 0.5 },
          { ts: "2025-10-01T00:15:00-04:00", val: 0.75 }
        ]
      }],
      pixel: [{
        id: "100",
        data: [
          { ts: "2025-10-01T00:00:00-04:00", val: 0.2 }
        ]
      }]
    };

    const snippet = buildSwmmInpSnippet(resultsTableData, {
      rollup: "15-minute",
      timestampRule: CHART_TIMESTAMP_RULE.start
    });

    expect(snippet).toContain("[RAINGAGES]");
    expect(snippet).toContain("[TIMESERIES]");
    expect(snippet).toContain("RG_GAUGE_8 VOLUME 0:15 1.0 TIMESERIES TS_GAUGE_8");
    expect(snippet).toContain("RG_PIXEL_100 VOLUME 0:15 1.0 TIMESERIES TS_PIXEL_100");
    expect(snippet).toContain("TS_GAUGE_8 10/01/2025 00:00 0.5");
    expect(snippet).toContain("TS_GAUGE_8 10/01/2025 00:15 0.75");
    expect(snippet).toContain("TS_PIXEL_100 10/01/2025 00:00 0.2");
  });

  it("uses the start timestamp for ranged rows in SWMM output", () => {
    const resultsTableData = {
      gauge: [{
        id: "8",
        data: [{
          ts: "2025-10-01T00:00:00-04:00/2025-10-01T01:00:00-04:00",
          val: 1.25
        }]
      }]
    };

    const snippet = buildSwmmInpSnippet(resultsTableData, {
      rollup: "Hourly"
    });

    expect(snippet).toContain("RG_GAUGE_8 VOLUME 1:00 1.0 TIMESERIES TS_GAUGE_8");
    expect(snippet).toContain("TS_GAUGE_8 10/01/2025 00:00 1.25");
    expect(snippet).not.toContain("TS_GAUGE_8 10/01/2025 01:00 1.25");
  });

  it("skips invalid timestamps and non-numeric values in SWMM output", () => {
    const resultsTableData = {
      gauge: [{
        id: "8",
        data: [
          { ts: "invalid-ts", val: 0.5 },
          { ts: "2025-10-01T00:00:00-04:00", val: "not-a-number" },
          { ts: "2025-10-01T00:15:00-04:00", val: 0.75 }
        ]
      }]
    };

    const snippet = buildSwmmInpSnippet(resultsTableData, {
      rollup: "15-minute"
    });

    expect(snippet).toContain("RG_GAUGE_8 VOLUME 0:15 1.0 TIMESERIES TS_GAUGE_8");
    expect(snippet).toContain("TS_GAUGE_8 10/01/2025 00:15 0.75");
    expect(snippet).not.toContain("not-a-number");
  });

  it("orders SWMM sensors deterministically by sensor type then id", () => {
    const resultsTableData = {
      pixel: [{
        id: "100",
        data: [{ ts: "2025-10-01T00:00:00-04:00", val: 1 }]
      }, {
        id: "2",
        data: [{ ts: "2025-10-01T00:00:00-04:00", val: 1 }]
      }],
      gauge: [{
        id: "9",
        data: [{ ts: "2025-10-01T00:00:00-04:00", val: 1 }]
      }, {
        id: "8",
        data: [{ ts: "2025-10-01T00:00:00-04:00", val: 1 }]
      }]
    };

    const snippet = buildSwmmInpSnippet(resultsTableData, {
      rollup: "15-minute"
    });

    const gauge8Index = snippet.indexOf("RG_GAUGE_8 VOLUME 0:15 1.0 TIMESERIES TS_GAUGE_8");
    const gauge9Index = snippet.indexOf("RG_GAUGE_9 VOLUME 0:15 1.0 TIMESERIES TS_GAUGE_9");
    const pixel2Index = snippet.indexOf("RG_PIXEL_2 VOLUME 0:15 1.0 TIMESERIES TS_PIXEL_2");
    const pixel100Index = snippet.indexOf("RG_PIXEL_100 VOLUME 0:15 1.0 TIMESERIES TS_PIXEL_100");

    expect(gauge8Index).toBeGreaterThan(-1);
    expect(gauge9Index).toBeGreaterThan(-1);
    expect(pixel2Index).toBeGreaterThan(-1);
    expect(pixel100Index).toBeGreaterThan(-1);
    expect(gauge8Index).toBeLessThan(gauge9Index);
    expect(gauge9Index).toBeLessThan(pixel2Index);
    expect(pixel2Index).toBeLessThan(pixel100Index);
  });

  it("sanitizes SWMM identifiers for sensor ids with unsafe characters", () => {
    const resultsTableData = {
      gauge: [{
        id: "9 alpha/beta",
        data: [{ ts: "2025-10-01T00:00:00-04:00", val: 1 }]
      }]
    };

    const snippet = buildSwmmInpSnippet(resultsTableData, {
      rollup: "15-minute"
    });

    expect(snippet).toContain("RG_GAUGE_9_ALPHA_BETA VOLUME 0:15 1.0 TIMESERIES TS_GAUGE_9_ALPHA_BETA");
    expect(snippet).toContain("TS_GAUGE_9_ALPHA_BETA 10/01/2025 00:00 1");
  });

  it("returns stable minimal SWMM output for empty or invalid inputs", () => {
    const snippet = buildSwmmInpSnippet({
      gauge: [{
        id: "8",
        data: [{ ts: "invalid-ts", val: "not-a-number" }]
      }]
    });

    expect(snippet).toContain("[RAINGAGES]");
    expect(snippet).toContain("[TIMESERIES]");
    expect(snippet).toContain(";;No valid rainfall rows available.");
    expect(snippet).not.toContain("RG_GAUGE_8");
    expect(snippet).not.toContain("TS_GAUGE_8");
  });
});
