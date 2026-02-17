import { describe, expect, it } from "vitest";

import { BREAKS_050 } from "./config";
import { initialState } from "./initialState";
import { rootReducer } from "./reducers";
import { applyColorStretch } from "./features/mapStyleSlice";

describe("applyColorStretch", () => {
  it("updates result layer color expressions and legend content together", () => {
    const state = JSON.parse(JSON.stringify(initialState));

    state.mapStyle = {
      sources: {},
      layers: [
        {
          id: "gauge-results",
          type: "circle",
          paint: {
            "circle-color": "#fff"
          }
        },
        {
          id: "pixel-results",
          type: "fill",
          paint: {
            "fill-color": "#fff"
          }
        }
      ]
    };

    const nextState = rootReducer(state, applyColorStretch({ breaks: BREAKS_050 }));

    const gaugeLayer = nextState.mapStyle.layers.find((layer) => layer.id === "gauge-results");
    const pixelLayer = nextState.mapStyle.layers.find((layer) => layer.id === "pixel-results");

    expect(Array.isArray(gaugeLayer.paint["circle-color"])).toBe(true);
    expect(Array.isArray(pixelLayer.paint["fill-color"])).toBe(true);
    expect(Array.isArray(nextState.mapLegend.content)).toBe(true);
    expect(nextState.mapLegend.content.length).toBeGreaterThan(0);
  });
});
