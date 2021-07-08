import {
  MAPBOX_TOKEN,
  MAPBOX_STYLE_BASEMAP,
  RAINFALL_MIN_DATE,
  CONTEXT_TYPES
} from './config'

// import { testFetchHistoryItems } from './data/test_events'

export const initialState = {
  // progress ---------------------------------------------
  // for storing indicators of global application state
  progress: {
    tab: CONTEXT_TYPES.legacyRealtime,
    mapLoaded: false,
    initialStyleLoaded: false,
    isFetching: true,
    // isThinking increments decrements with calls to start/stopThinking. E.g: 
    // Set at +1 so we're "thinking" on load, then after all start up tasks 
    // complete, -1 to get back to zero.
    isThinking: 0,
    messages: []
  },
  // fetchKwargs ------------------------------------------
  // Holds arguments for calling the API, e.g., sensor type, rollup, zerofill.
  // Keys correspond to tabs in the UI, and each tab has both an active and history
  // object for storing current parameters and past requests, respectively.
  fetchKwargs: {
    [CONTEXT_TYPES.legacyRealtime] : {
      active: {
        startDt: null,
        endDt: null,
        sensorLocations: {
          gauge: [],
          basin: [],
          pixel: []
        },
        rollup: "15-minute",
        zerofill: true,
        f: 'sensor'
      },
      history: []
    },
    [CONTEXT_TYPES.legacyGauge] : {
      active: {
        startDt: null,
        endDt: null,
        sensorLocations: {
          gauge: [],
          basin: [],
          pixel: []
        },
        rollup: "15-minute",
        zerofill: true,
        f: 'sensor'
      },
      // history: testFetchHistoryItems
      history: []
    },
    [CONTEXT_TYPES.legacyGarr] : {
      active: {
        startDt: null,
        endDt: null,
        sensorLocations: {
          gauge: [],
          basin: [],
          pixel: []
        },
        rollup: "15-minute",
        zerofill: true,
        f: 'sensor'
      },
      history: []
    }       
  },
  // EVENTS -----------------------------------------------  
  rainfallEvents: {
    // list of rainfall events; populated via an async call to the API at load time.
    list: [],
    // maxDateTime stores the max datetime found in the events array. It's eval'd an on-app load and 
    // used to set limits on selectable datetimes for the historic data
    stats: {
      latest: null,
      longest: null,
      maxDate: null,
      minDate: RAINFALL_MIN_DATE
    },
    // eventFilters stores any filter conditions used to filter the list of events
    filters: {
      maxHours: 24,
      // minHours: 0,
      // year: 2019,
      // month: null
    },    
  },
  // EVENTS -----------------------------------------------
  stats: {
    latest: {}
  },
  // refData --------------------------------------------------
  // reference data
  refData: {},
  // MAP --------------------------------------------------
  // initMap provides *initial* values fed into the MapboxGL map object.
  initMap: {
    token: MAPBOX_TOKEN,
    latitude: 40.4481524,
    longitude: -79.9864242,
    zoom: 10,
    mapboxSources: {
      "3rww-rainfall-base": {
        type: "vector",
        url: MAPBOX_STYLE_BASEMAP
      }
    },
    sourcesToAdd: [],
    layersToAdd: [],
    attribution: '<a href="https://www.3riverswetweather.org" target="_blank">3RWW</a>, <a href="https://www.civicmapper.com" target="_blank">CivicMapper</a>.',
  },
  // mapStyle is where the MapboxGL map's style sheet is stored; changes here change the map
  // note that we're pre-populating some expected objects
  mapStyle: {},
  // mapLegend stores the breaks and colors used to render the map legend.
  mapLegend: {}
} 