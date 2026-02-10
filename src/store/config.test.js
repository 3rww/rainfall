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
});

