import { describe, expect, it } from "vitest";
import moment from "moment";

import {
  clampDateTime,
  clampDateTimeRange,
  isRangeWithinBounds,
  resolveAvailableBounds
} from "./dateBounds";

import {
  CONTEXT_TYPES,
  FIVE_MINUTE_ROLLUP
} from "../config";

describe("resolveAvailableBounds", () => {
  const now = "2026-02-11T12:00:00Z";
  const rainfallMinDate = "2000-04-01T00:00:00Z";

  it("uses latest realtime-radar/gauge key for legacyRealtime", () => {
    const bounds = resolveAvailableBounds({
      contextType: CONTEXT_TYPES.legacyRealtime,
      rollup: "15-minute",
      latest: {
        "realtime-radar": "2026-02-10T10:00:00Z",
        "realtime-gauge": "2026-02-11T10:00:00Z"
      },
      rainfallMinDate,
      now
    });

    expect(bounds.max.toISOString()).toBe(moment("2026-02-11T10:00:00Z").toISOString());
    expect(bounds.min.toISOString()).toBe(moment("2025-02-01T00:00:00Z").toISOString());
  });

  it("falls back to now for legacyRealtime max when realtime keys are missing", () => {
    const bounds = resolveAvailableBounds({
      contextType: CONTEXT_TYPES.legacyRealtime,
      rollup: "15-minute",
      latest: {},
      rainfallMinDate,
      now
    });

    expect(bounds.max.toISOString()).toBe(moment(now).toISOString());
    expect(bounds.min.toISOString()).toBe(moment(now).subtract(1, "year").startOf("month").toISOString());
  });

  it("uses env min and calibrated max for legacyGauge non-5-minute", () => {
    const bounds = resolveAvailableBounds({
      contextType: CONTEXT_TYPES.legacyGauge,
      rollup: "15-minute",
      latest: {
        "calibrated-gauge": "2026-01-31T00:00:00Z"
      },
      rainfallMinDate,
      now
    });

    expect(bounds.min.toISOString()).toBe(moment(rainfallMinDate).toISOString());
    expect(bounds.max.toISOString()).toBe(moment("2026-01-31T00:00:00Z").toISOString());
  });

  it("falls back to now minus 60 days endOf month for legacyGauge non-5-minute max", () => {
    const bounds = resolveAvailableBounds({
      contextType: CONTEXT_TYPES.legacyGauge,
      rollup: "15-minute",
      latest: {},
      rainfallMinDate,
      now
    });

    expect(bounds.max.toISOString()).toBe(moment(now).subtract(60, "days").endOf("month").toISOString());
  });

  it("uses 5-minute min/max keys for legacyGauge and falls back for missing max", () => {
    const bounds = resolveAvailableBounds({
      contextType: CONTEXT_TYPES.legacyGauge,
      rollup: FIVE_MINUTE_ROLLUP,
      latest: {
        "earliest-5min-calibrated-gauge": "2024-01-01T00:00:00Z",
        "calibrated-gauge": "2026-01-31T00:00:00Z"
      },
      rainfallMinDate,
      now
    });

    expect(bounds.min.toISOString()).toBe(moment("2024-01-01T00:00:00Z").toISOString());
    expect(bounds.max.toISOString()).toBe(moment("2026-01-31T00:00:00Z").toISOString());
  });

  it("prioritizes latest 5-minute key over calibrated max for legacyGauge 5-minute", () => {
    const bounds = resolveAvailableBounds({
      contextType: CONTEXT_TYPES.legacyGauge,
      rollup: FIVE_MINUTE_ROLLUP,
      latest: {
        "earliest-5min-calibrated-gauge": "2024-01-01T00:00:00Z",
        "latest-5min-calibrated-gauge": "2026-01-01T00:00:00Z",
        "calibrated-gauge": "2026-02-01T00:00:00Z"
      },
      rainfallMinDate,
      now
    });

    expect(bounds.max.toISOString()).toBe(moment("2026-01-01T00:00:00Z").toISOString());
  });

  it("mirrors gauge behavior for legacyGarr keys", () => {
    const bounds = resolveAvailableBounds({
      contextType: CONTEXT_TYPES.legacyGarr,
      rollup: FIVE_MINUTE_ROLLUP,
      latest: {
        "earliest-5min-calibrated-radar": "2025-01-01T00:00:00Z",
        "latest-5min-calibrated-radar": "2026-02-01T00:00:00Z"
      },
      rainfallMinDate,
      now
    });

    expect(bounds.min.toISOString()).toBe(moment("2025-01-01T00:00:00Z").toISOString());
    expect(bounds.max.toISOString()).toBe(moment("2026-02-01T00:00:00Z").toISOString());
  });

  it("guards against min greater than max", () => {
    const bounds = resolveAvailableBounds({
      contextType: CONTEXT_TYPES.legacyGauge,
      rollup: FIVE_MINUTE_ROLLUP,
      latest: {
        "earliest-5min-calibrated-gauge": "2030-01-01T00:00:00Z",
        "latest-5min-calibrated-gauge": "2026-01-01T00:00:00Z"
      },
      rainfallMinDate,
      now
    });

    expect(bounds.min.toISOString()).toBe(bounds.max.toISOString());
  });
});

describe("date bound helpers", () => {
  it("clampDateTime clamps before min and after max", () => {
    const min = moment("2025-01-01T00:00:00Z");
    const max = moment("2025-12-31T00:00:00Z");

    expect(clampDateTime("2024-01-01T00:00:00Z", min, max).toISOString()).toBe(min.toISOString());
    expect(clampDateTime("2026-01-01T00:00:00Z", min, max).toISOString()).toBe(max.toISOString());
  });

  it("clampDateTimeRange enforces bounds and start <= end", () => {
    const range = clampDateTimeRange({
      start: "2026-01-10T00:00:00Z",
      end: "2024-01-10T00:00:00Z",
      min: "2025-01-01T00:00:00Z",
      max: "2025-12-31T00:00:00Z"
    });

    expect(range.start.toISOString()).toBe(moment("2025-12-31T00:00:00Z").toISOString());
    expect(range.end.toISOString()).toBe(moment("2025-12-31T00:00:00Z").toISOString());
  });

  it("isRangeWithinBounds validates inclusive ranges", () => {
    const min = "2025-01-01T00:00:00Z";
    const max = "2025-12-31T00:00:00Z";

    expect(isRangeWithinBounds({
      start: "2025-01-01T00:00:00Z",
      end: "2025-12-31T00:00:00Z",
      min,
      max
    })).toBe(true);

    expect(isRangeWithinBounds({
      start: "2024-12-31T00:00:00Z",
      end: "2025-12-31T00:00:00Z",
      min,
      max
    })).toBe(false);
  });
});
