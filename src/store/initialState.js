import {
  eventsData,
  eventLatest,
  eventLongest,
  defaultStartDt,
  defaultEndDt,
  MAPBOX_TOKEN,
  MAPBOX_STYLE_BASEMAP
} from './config'

import { testFetchHistoryItems } from './helpers'

export const initialState = {
  // progress ---------------------------------------------
  // for storing indicators of global application state
  progress: {
    mapLoaded: false,
    initialStyleLoaded: false,
    isFetching: true,
  },

  // fetchKwargs ------------------------------------------
  // holds arguments for calling the API, e.g., sensor type, rollup, zerofill
  fetchKwargs: {
    // selectedEvent holds date/time parameters for the request, along with any other info about the event
    selectedEvent: {
      start_dt: eventsData[0].start_dt, //defaultStartDt,
      end_dt: eventsData[0].end_dt,
      // these two props are available with the pre-defined events:
      eventid: null,
      report: null
    },
    sensorLocations: {
      raingauge: [],
      basin: [],
      pixel: []
    },
    rollup: "Total",
    zerofill: true,
    f: 'sensor'
  },
  // fetchHistory is for storing requests to the API, *along with the received data*
  fetchHistory: testFetchHistoryItems,

  // EVENTS -----------------------------------------------  
  rainfallEvents: {
    // events is the pre-loaded rainfall events data; TODO: replace with call to the events table in DDB
    list: eventsData,
    // maxDateTime stores the max datetime found in the events array. It's eval'd an on-app load and 
    // used to set limits on selectable datetime
    stats: {
      latest: eventLatest,
      longest: eventLongest,
      maxDate: defaultEndDt
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
  mapStyle: {
    sources: {
      pixel: {
        data: {}
      },
      raingauge: {
        data: {}
      }      
    }
  }
} 