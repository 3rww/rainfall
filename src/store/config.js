/**
 * config.js
 * contains constants and derived variables required on application initializations. 
 * Some of these is used in the initial state tree, others are imported by 
 * components by middleware
 */



// Seed data --------------------------------------------
// import RAINFALL_EVENTS from '../data/events.json'
const withTrailingSlash = (value) => (value ? (value.endsWith("/") ? value : `${value}/`) : "");
const normalizeMapboxStyleUrl = (value) => {
  if (!value) {
    return "mapbox://styles/mapbox/light-v11";
  }

  const trimmed = value.trim();

  if (trimmed.startsWith("mapbox://styles/") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  // Accept shorthand like "mapbox/light-v11" and normalize it.
  if (/^[^/]+\/[^/]+$/.test(trimmed)) {
    return `mapbox://styles/${trimmed}`;
  }

  return trimmed;
};

export const ROOT = import.meta.env.BASE_URL;
export const API_URL_ROOT = withTrailingSlash(import.meta.env.VITE_API_URL_ROOT || "");

// Mapbox constants -------------------------------------
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
export const MAPBOX_STYLE_BASEMAP = normalizeMapboxStyleUrl(import.meta.env.VITE_MAPBOX_STYLE_BASEMAP);

// Service URLs -----------------------------------------
export const GLOBAL_CONFIG_URL = `${ROOT}static/config.json`;
export const EVENTS_JSON_URL = `${ROOT}static/data/events.json`;
export const EVENTS_API_URL = `${API_URL_ROOT}rainfall-events/?format=json`;
export const TIMESTAMPS_API_URL = `${API_URL_ROOT}v2/latest-observations/?format=json`;
export const URL_GARRD_GEOJSON = `${API_URL_ROOT}pixels/`; // ROOT + "static/data/pixels.geojson"
export const URL_GAUGE_GEOJSON = `${API_URL_ROOT}gauges/`; // ROOT + "static/data/gauges.geojson"
export const URL_BASIN_PIXEL_LOOKUP = `${ROOT}static/data/basin-lookup-pixel.json`;
export const URL_GEOGRAPHY_LOOKUP = `${ROOT}static/data/geography-lookup.json`;

// Service Parms -----------------------------------------
export const REQUEST_TIME_INTERVAL = Number(import.meta.env.VITE_API_REQUEST_INTERVAL_MS || 2000);


// rainfall data constants ----------------------------------

export const INTERVAL_OPTIONS = [
  "15-minute",
  "Hourly",
  "Daily",
  "Total"
]

// the earliest date that can be selected:
export const RAINFALL_MIN_DATE = `${import.meta.env.VITE_RAINFALL_MIN_DATE || "2000-04-01"}`

// the types of rainfall data that can be queried
export const RAINFALL_TYPES = {
  historic: "historic",
  realtime: "realtime"
}

export const SENSOR_TYPES = {
  pixel: "pixel",
  gauge: "gauge",
}

export const CONTEXT_TYPES = {
  legacyRealtime: "legacyRealtime",
  legacyGauge: "legacyGauge",
  legacyGarr: "legacyGarr",
  makeItRain: "makeItRain"
}

export const HEADER_LABELS = {
  ts: "timestamp",
  val: "rainfall",
  src: "source",
  id: "sensor id",
  type: "sensor type"
}

// rainfall layers + styles (mapbox style spec)

export const LYR_HOVER_PREFIX = 'HOVER'
export const LYR_HIGHLIGHT_PREFIX = 'HIGHLIGHT'

// Default Operational Layers + Styles --------------------
// These are layer definitions per the Mapbox style-spec, with one exception: the INDEX property. 
// When INDEX is used with the `addLayers` reducer, the layer will be inserted at that position 
// in the style sheet, so that it renders in the correct order with the basemap elements
export const MAP_LAYERS = [
  {
    INDEX: 8,
    "id": "pixel",
    "type": "line",
    "source": "pixel",
    "layout": {},
    "paint": {
      "line-color": "hsl(209, 25%, 55%)",
      "line-width": 0.5,
      "line-opacity": 0.2
    }
  },
  {
    INDEX: 68,
    'id': `${LYR_HIGHLIGHT_PREFIX}-pixel-fill`,
    'type': 'fill',
    'source': 'pixel',
    'layout': {},
    'paint': {
      'fill-color': '#2196f3',
      // 'fill-color': "#cad2d3",
      'fill-opacity': [
        "case",
        ['boolean', ['get', 'selected'], false],
        0.2,
        0
      ]
    }
  },
  {
    INDEX: 70,
    'id': `${LYR_HIGHLIGHT_PREFIX}-pixel`,
    'type': 'line',
    'source': 'pixel',
    'layout': {},
    'paint': {
      'line-color': '#2196f3',
      'line-width': 1,
      'line-opacity': [
        "case",
        ['boolean', ['get', 'selected'], false],
        1,
        0
      ]
    }
  },
  {
    INDEX: 69,
    'id': `pixel-results`,
    'type': 'fill',
    'source': 'pixel',
    'layout': {},
    'paint': {
      'fill-color': [
        "match",
        ["get", "total"],
        "",
        "#fff",
        [
          "interpolate",
          ["linear"],
          ["get", "total"],
          0,
          '#fafa6e',
          10,
          '#2A4858',
        ]
      ],
      'fill-opacity': [
        "match",
        ["get", "total"],
        "",
        0,
        0.8
      ]
    }
  },
  {
    INDEX: 71,
    'id': `${LYR_HOVER_PREFIX}-pixel`,
    'type': 'fill',
    'source': 'pixel',
    'layout': {},
    'paint': {
      // 'fill-color': '#2196f3',
      'fill-color': "#cad2d3",
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        0.8,
        0
      ]
    }
  },
  {
    INDEX: 72,
    "id": `${LYR_HIGHLIGHT_PREFIX}-gauge`,
    "type": "circle",
    "source": `gauge`,
    "layout": {},
    "paint": {
      "circle-radius": [
        'interpolate',
        ['linear'],
        ['zoom'],
        7, 6,
        18, 12
      ],
      "circle-color": "#2196f3",
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 2,
      "circle-opacity": [
        'case',
        ['boolean', ['get', 'selected'], false],
        0.4,
        0
      ],
      "circle-stroke-opacity": [
        'case',
        ['boolean', ['get', 'selected'], false],
        1,
        0
      ]
    }
  },
  {
    INDEX: 73,
    "id": `${LYR_HOVER_PREFIX}-gauge`,
    "type": "circle",
    "source": `gauge`,
    "layout": {},
    "paint": {
      "circle-radius": [
        'interpolate',
        ['linear'],
        ['zoom'],
        7,
        6,
        18,
        12
      ],
      "circle-color": "hsl(209, 25%, 55%)",
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 2,
      "circle-opacity": [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        1,
        0
      ],
      "circle-stroke-opacity": [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        1,
        0
      ]
    }
  },
  {
    "id": "pixel-points",
    "type": "circle",
    "source": "pixel",
    "layout": { "visibility": "none" },
    "paint": {
      "circle-color": "hsl(209, 25%, 55%)",
      "circle-opacity": 0,
      "circle-stroke-width": 1,
      "circle-stroke-color": "hsl(0, 0%, 31%)",
      "circle-radius": 0
    }
  },
  {
    "id": "gauges",
    "type": "circle",
    "source": "gauge",
    "paint": {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        7,
        3,
        18,
        9
      ],
      "circle-stroke-color": "hsl(0, 100%, 100%)",
      "circle-stroke-opacity": 0.5,
      "circle-color": "#708da9"
    }
  },
  {
    // INDEX: 73,
    'id': `gauge-results`,
    "type": "circle",
    "source": `gauge`,
    'layout': {},
    "paint": {
      "circle-radius": [
        'interpolate',
        ['linear'],
        ['zoom'],
        7,
        8,
        18,
        14
      ],
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 2,
      'circle-color': [
        "match",
        ["get", "total"],
        "",
        "#fff",
        [
          "interpolate",
          ["linear"],
          ["get", "total"],
          0,
          '#fafa6e',
          10,
          '#2A4858',
        ]
      ],
      'circle-opacity': [
        "match",
        ["get", "total"],
        "",
        0,
        1
      ],
      'circle-stroke-opacity': [
        "match",
        ["get", "total"],
        "",
        0,
        1
      ]
    }
  },
  {
    "id": "gauges-labels",
    "type": "symbol",
    "source": "gauge",
    "layout": {
      "text-field": ["to-string", ["get", "name"]],
      "text-anchor": "top",
      "text-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        8,
        12,
        18,
        18
      ],
      "text-offset": [0, 0.75]
    },
    "paint": {
      "text-color": "#708da9",
      "text-halo-width": 2,
      "text-halo-color": "hsl(0, 0%, 100%)"
    }
  },  
]

export const LAYERS_W_MOUSEOVER = [
  [`${LYR_HOVER_PREFIX}-pixel`, 'pixel'],
  [`${LYR_HOVER_PREFIX}-gauge`, 'gauge'],
  // [`${LYR_HOVER_PREFIX}-gauge-halo`, 'gauge']
]

export const LAYERS_W_RESULTS = [
  'pixel-results',
  'gauge-results',
  // 'pixel-results-3d',
]

export const symbolBinLookup = {
  'q': 'Quantile',
  'e': 'Equal Interval',
  'l': 'Linear',
}

export const RAINFALL_COLOR_ARRAY = ["#fde725", "#5dc962", "#20908d", "#3a528b", "#440154"]
export const RAINFALL_COLOR_MODE = 'lch'
export const RAINFALL_BREAK_COUNT = 7



export const BREAKS_005 = [
  0.01,
  0.02,
  0.04,
  0.06,
  0.08,
  0.10,
  0.12,
  0.15,
  0.20,
  0.25,
  0.30,
  0.35,
  0.40,
  0.45,
  0.50
]

export const BREAKS_050 = [
  0.1,
  0.2,
  0.4,
  0.6,
  0.8,
  1.0,
  1.5,
  2.0,
  2.5,
  3.0,
  3.5,
  4.0,
  4.5,
  5.0
]

export const BREAKS_100 = [
  0.2,
  0.4,
  0.8,
  1.0,
  1.2,
  1.6,
  2.0,
  2.4,
  3.0,
  4.0,
  5.0,
  6.0,
  7.0,
  8.0,
  9.0,
  10
]


export const LEGEND_BREAKS = {
  "breaks_005": BREAKS_005,
  "breaks_050": BREAKS_050,
  "breaks_100": BREAKS_100
}
