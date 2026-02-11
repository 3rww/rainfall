import { describe, expect, it } from "vitest";
import moment from "moment";

import {
  buildDownloadChartData,
  buildDownloadRowsAndFields,
  CHART_TIMESTAMP_RULE,
  extractChartTimestamp,
  formatIsoForExcel,
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
    const expectedStartMs = moment.parseZone("2025-10-01T00:00:00-04:00", moment.ISO_8601, true).valueOf();

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

    const { rows, series } = buildDownloadChartData(resultsTableData);
    const firstTimestampMs = moment.parseZone("2025-10-01T00:00:00-04:00", moment.ISO_8601, true).valueOf();
    const secondTimestampMs = moment.parseZone("2025-10-01T00:15:00-04:00", moment.ISO_8601, true).valueOf();

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
    const validTimestampMs = moment.parseZone("2025-10-01T00:20:00-04:00", moment.ISO_8601, true).valueOf();

    expect(series).toEqual([
      { key: "pixel:100", label: "Pixel 100", sensorType: "pixel", sensorId: "100" }
    ]);
    expect(rows).toEqual([
      { timestampMs: validTimestampMs, "pixel:100": 0.3 }
    ]);
  });
});
