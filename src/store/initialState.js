import {
  MAPBOX_TOKEN,
  MAPBOX_STYLE_BASEMAP,
  RAINFALL_MIN_DATE
} from './config'

import { testFetchHistoryItems } from './data/test_events'

export const initialState = {
  // progress ---------------------------------------------
  // for storing indicators of global application state
  progress: {
    mapLoaded: false,
    initialStyleLoaded: false,
    isFetching: true,
    // isThinking increments decrements with calls to start/stopThinking. Set 
    // at 1 so we're "thinking" on load. There will be one additional call to 
    // stopThinking that's only hit after all start up tasks complete
    isThinking: 0, 
  },

  // fetchKwargs ------------------------------------------
  // holds arguments for calling the API, e.g., sensor type, rollup, zerofill
  fetchKwargs: {
    realtime: {
      startDt: null,
      endDt: null,
      sensorLocations: {
        gauge: [],
        basin: [],
        pixel: []
      },
      rollup: "Total",
      zerofill: true,
      f: 'sensor'
    },
    historic: {
      startDt: null,
      endDt: null,
      sensorLocations: {
        gauge: [],
        basin: [],
        pixel: []
      },
      rollup: "Total",
      zerofill: true,
      f: 'sensor'
    }
  },
  // fetchHistory is for storing requests to the API, *along with the received data*
  fetchHistory: {
    realtime: [],
    historic: testFetchHistoryItems //[],
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
    attribution: '<a href="https://www.3riverswetweather.org" target="_blank">3RWW</a>, <a href="https://www.civicmapper.com" target="_blank">CivicMapper</a>.',
  },  
  // mapStyle is where the MapboxGL map's style sheet is stored; changes here change the map
  // note that we're pre-populating some expected objects
  mapStyle: {}
} 