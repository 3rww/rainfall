import { describe, expect, it } from "vitest";

import { LEGEND_BREAKS } from "./config";
import { initialState } from "./initialState";
import { rootReducer } from "./reducers";
import { applyColorStretch } from "./features/mapStyleSlice";

describe("applyColorStretch", () => {
  it.each(Object.entries(LEGEND_BREAKS))("keeps zero white in the map and legend for %s", (_scale, breaks) => {
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

    const nextState = rootReducer(state, applyColorStretch({ breaks }));

    const gaugeLayer = nextState.mapStyle.layers.find((layer) => layer.id === "gauge-results");
    const pixelLayer = nextState.mapStyle.layers.find((layer) => layer.id === "pixel-results");

    const legend = nextState.mapLegend.content;
    expect(legend[0]).toEqual([0, "#ffffff"]);
    expect(legend.at(-1)).toEqual([Math.max(...breaks), "#440154"]);
    expect(legend.map(([value]) => value)).toEqual(breaks);
    const expression = pixelLayer.paint["fill-color"];
    expect(gaugeLayer.paint["circle-color"]).toEqual(expression);
    expect(expression.slice(0, 3)).toEqual(["case", ["==", ["get", "total"], null], "rgba(0,0,0,0)"]);
    expect(expression[3].slice(3)).toEqual(legend.flat());
  });
});
