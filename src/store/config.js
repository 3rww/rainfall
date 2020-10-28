/**
 * config.js
 * contains constants and derived variables required on application initializations. 
 * Some of these is used in the initial state tree, others are imported by 
 * components by middleware
 */

import moment from 'moment'

// Seed data --------------------------------------------
// import RAINFALL_EVENTS from '../data/events.json'
const ROOT = window.location.href


// Mapbox constants -------------------------------------
export const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN
export const MAPBOX_STYLE_BASEMAP = process.env.REACT_APP_MAPBOX_STYLE_BASEMAP

// Service URLs -----------------------------------------
// export const URL_GARRD_GEOJSON = "https://services6.arcgis.com/dMKWX9NPCcfmaZl3/arcgis/rest/services/garrd/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&returnExceededLimitFeatures=true&f=pgeojson"
// export const URL_GAUGE_GEOJSON = "https://services6.arcgis.com/dMKWX9NPCcfmaZl3/arcgis/rest/services/3RWWRG/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&returnExceededLimitFeatures=true&f=pgeojson"
export const EVENTS_JSON_URL = "/static/data/events.json"
export const URL_GARRD_GEOJSON = "/static/data/pixels.geojson"
export const URL_GAUGE_GEOJSON = "/static/data/gauges.geojson"
export const URL_BASIN_PIXEL_LOOKUP = "/static/data/basin-lookup-pixel.json"

// Service Parms -----------------------------------------
export const REQUEST_TIME_INTERVAL = `${process.env.API_REQUEST_INTERVAL_MS}`


// rainfall data constants ----------------------------------

export const INTERVAL_OPTIONS = [
  "15-minute",
  "Hourly",
  "Daily",
  "Total"
]

// the earliest date that can be selected:
export const RAINFALL_MIN_DATE = `${process.env.REACT_APP_RAINFALL_MIN_DATE}`

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

// Default Operational Layers + Styles --------------------
// These are layer definitions per the Mapbox style-spec, with one exception: the INDEX property. 
// When INDEX is used with the `addLayers` reducer, the layer will be inserted at that position 
// in the style sheet, so that it renders in the correct order with the basemap elements
export const MAP_LAYERS = [
  {
    INDEX: 71,
    'id': 'HOVER-pixel',
    'type': 'fill',
    'source': 'pixel',
    'layout': {},
    'paint': {
      'fill-color': '#2196f3',
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        0.75,
        0
      ]
    }
  },
  {
    INDEX: 72,
    "id": `HOVER-gauge-halo`,
    "type": "circle",
    "source": `gauge`,
    'layout': {},
    "paint": {
      "circle-radius": 30,
      "circle-color": "#2196f3",
      "circle-blur": 0.8,
      "circle-opacity": [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        0.8,
        0
      ],
    }
  },
  {
    // INDEX: 73,
    "id": `HOVER-gauge`,
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
  }
]

export const LAYERS_W_MOUSEOVER = [
  ['HOVER-pixel', 'pixel'],
  ['HOVER-gauge', 'gauge'],
  ['HOVER-gauge-halo', 'gauge']
]