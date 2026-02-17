import { afterEach, describe, expect, it, vi } from "vitest";

describe("config env parsing", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("parseBooleanEnvFlag handles truthy values", async () => {
    const { parseBooleanEnvFlag } = await import("./config");

    expect(parseBooleanEnvFlag("true")).toBe(true);
    expect(parseBooleanEnvFlag("1")).toBe(true);
    expect(parseBooleanEnvFlag("yes")).toBe(true);
    expect(parseBooleanEnvFlag("on")).toBe(true);
    expect(parseBooleanEnvFlag(" TRUE ")).toBe(true);
  });

  it("parseBooleanEnvFlag handles falsy or invalid values", async () => {
    const { parseBooleanEnvFlag } = await import("./config");

    expect(parseBooleanEnvFlag("false")).toBe(false);
    expect(parseBooleanEnvFlag("0")).toBe(false);
    expect(parseBooleanEnvFlag("no")).toBe(false);
    expect(parseBooleanEnvFlag("off")).toBe(false);
    expect(parseBooleanEnvFlag("unexpected")).toBe(false);
    expect(parseBooleanEnvFlag(undefined)).toBe(false);
    expect(parseBooleanEnvFlag(undefined, true)).toBe(true);
  });

  it("ENABLE_SHARE_STATE defaults to false when unset", async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.stubEnv("VITE_ENABLE_SHARE_STATE", "");

    const { ENABLE_SHARE_STATE } = await import("./config");
    expect(ENABLE_SHARE_STATE).toBe(false);
  });

  it("ENABLE_SHARE_STATE is true for supported truthy env values", async () => {
    const truthyValues = ["true", "1", "yes", "on", "On"];

    for (const value of truthyValues) {
      vi.unstubAllEnvs();
      vi.resetModules();
      vi.stubEnv("VITE_ENABLE_SHARE_STATE", value);

      const { ENABLE_SHARE_STATE } = await import("./config");
      expect(ENABLE_SHARE_STATE).toBe(true);
    }
  });

  it("ENABLE_SHARE_STATE is false for unsupported values", async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.stubEnv("VITE_ENABLE_SHARE_STATE", "definitely-not-true");

    const { ENABLE_SHARE_STATE } = await import("./config");
    expect(ENABLE_SHARE_STATE).toBe(false);
  });

  it("ENABLE_DEBUG_LOGS defaults to false when unset", async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.stubEnv("VITE_ENABLE_DEBUG_LOGS", "");

    const { ENABLE_DEBUG_LOGS } = await import("./config");
    expect(ENABLE_DEBUG_LOGS).toBe(false);
  });

  it("ENABLE_DEBUG_LOGS is true for supported truthy env values", async () => {
    const truthyValues = ["true", "1", "yes", "on", "On"];

    for (const value of truthyValues) {
      vi.unstubAllEnvs();
      vi.resetModules();
      vi.stubEnv("VITE_ENABLE_DEBUG_LOGS", value);

      const { ENABLE_DEBUG_LOGS } = await import("./config");
      expect(ENABLE_DEBUG_LOGS).toBe(true);
    }
  });

  it("ENABLE_DEBUG_LOGS is false for unsupported values", async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.stubEnv("VITE_ENABLE_DEBUG_LOGS", "definitely-not-true");

    const { ENABLE_DEBUG_LOGS } = await import("./config");
    expect(ENABLE_DEBUG_LOGS).toBe(false);
  });
});

describe("config interval and path helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("adds 5-minute interval only for legacy gauge and calibrated radar contexts", async () => {
    const {
      CONTEXT_TYPES,
      FIVE_MINUTE_ROLLUP,
      INTERVAL_OPTIONS,
      getIntervalOptionsForContext
    } = await import("./config");

    expect(getIntervalOptionsForContext(CONTEXT_TYPES.legacyGauge)).toEqual([
      FIVE_MINUTE_ROLLUP,
      ...INTERVAL_OPTIONS
    ]);
    expect(getIntervalOptionsForContext(CONTEXT_TYPES.legacyGarr)).toEqual([
      FIVE_MINUTE_ROLLUP,
      ...INTERVAL_OPTIONS
    ]);
    expect(getIntervalOptionsForContext(CONTEXT_TYPES.legacyRealtime)).toEqual(INTERVAL_OPTIONS);
  });

  it("does not mutate the shared interval options array", async () => {
    const {
      CONTEXT_TYPES,
      INTERVAL_OPTIONS,
      getIntervalOptionsForContext
    } = await import("./config");

    const initial = [...INTERVAL_OPTIONS];
    getIntervalOptionsForContext(CONTEXT_TYPES.legacyGauge);
    expect(INTERVAL_OPTIONS).toEqual(initial);
  });

  it("uses historic5 only for legacy gauge/garr with 5-minute rollup", async () => {
    const {
      CONTEXT_TYPES,
      RAINFALL_TYPES,
      FIVE_MINUTE_ROLLUP,
      getRainfallDataTypePath
    } = await import("./config");

    expect(getRainfallDataTypePath({
      contextType: CONTEXT_TYPES.legacyGauge,
      rainfallDataType: RAINFALL_TYPES.historic,
      rollup: FIVE_MINUTE_ROLLUP
    })).toBe("historic5");

    expect(getRainfallDataTypePath({
      contextType: CONTEXT_TYPES.legacyGarr,
      rainfallDataType: RAINFALL_TYPES.historic,
      rollup: FIVE_MINUTE_ROLLUP
    })).toBe("historic5");

    expect(getRainfallDataTypePath({
      contextType: CONTEXT_TYPES.legacyGauge,
      rainfallDataType: RAINFALL_TYPES.historic,
      rollup: "15-minute"
    })).toBe(RAINFALL_TYPES.historic);

    expect(getRainfallDataTypePath({
      contextType: CONTEXT_TYPES.legacyRealtime,
      rainfallDataType: RAINFALL_TYPES.historic,
      rollup: FIVE_MINUTE_ROLLUP
    })).toBe(RAINFALL_TYPES.historic);

    expect(getRainfallDataTypePath({
      contextType: CONTEXT_TYPES.legacyGauge,
      rainfallDataType: RAINFALL_TYPES.realtime,
      rollup: FIVE_MINUTE_ROLLUP
    })).toBe(RAINFALL_TYPES.realtime);
  });

  it("omits rollup only when request path resolves to historic5", async () => {
    const {
      CONTEXT_TYPES,
      RAINFALL_TYPES,
      FIVE_MINUTE_ROLLUP,
      shouldIncludeRollupParam
    } = await import("./config");

    expect(shouldIncludeRollupParam({
      contextType: CONTEXT_TYPES.legacyGauge,
      rainfallDataType: RAINFALL_TYPES.historic,
      rollup: FIVE_MINUTE_ROLLUP
    })).toBe(false);

    expect(shouldIncludeRollupParam({
      contextType: CONTEXT_TYPES.legacyGarr,
      rainfallDataType: RAINFALL_TYPES.historic,
      rollup: FIVE_MINUTE_ROLLUP
    })).toBe(false);

    expect(shouldIncludeRollupParam({
      contextType: CONTEXT_TYPES.legacyGauge,
      rainfallDataType: RAINFALL_TYPES.historic,
      rollup: "15-minute"
    })).toBe(true);

    expect(shouldIncludeRollupParam({
      contextType: CONTEXT_TYPES.legacyRealtime,
      rainfallDataType: RAINFALL_TYPES.historic,
      rollup: FIVE_MINUTE_ROLLUP
    })).toBe(true);

    expect(shouldIncludeRollupParam({
      contextType: CONTEXT_TYPES.legacyRealtime,
      rainfallDataType: RAINFALL_TYPES.realtime,
      rollup: "15-minute"
    })).toBe(true);
  });

  it("returns interactive map layers by context", async () => {
    const {
      CONTEXT_TYPES,
      getInteractiveMapLayersForContext
    } = await import("./config");

    expect(getInteractiveMapLayersForContext(CONTEXT_TYPES.legacyRealtime)).toEqual([
      "HOVER-pixel",
      "HOVER-gauge"
    ]);
    expect(getInteractiveMapLayersForContext(CONTEXT_TYPES.legacyGauge)).toEqual([
      "HOVER-gauge"
    ]);
    expect(getInteractiveMapLayersForContext(CONTEXT_TYPES.legacyGarr)).toEqual([
      "HOVER-pixel"
    ]);
  });

  it("returns selectable sensor types by context", async () => {
    const {
      CONTEXT_TYPES,
      SENSOR_TYPES,
      getSelectableSensorTypesForContext
    } = await import("./config");

    expect(getSelectableSensorTypesForContext(CONTEXT_TYPES.legacyRealtime)).toEqual([
      SENSOR_TYPES.pixel,
      SENSOR_TYPES.gauge
    ]);
    expect(getSelectableSensorTypesForContext(CONTEXT_TYPES.legacyGauge)).toEqual([
      SENSOR_TYPES.gauge
    ]);
    expect(getSelectableSensorTypesForContext(CONTEXT_TYPES.legacyGarr)).toEqual([
      SENSOR_TYPES.pixel
    ]);
  });
});
