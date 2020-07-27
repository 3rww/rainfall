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


// rainfall events data ----------------------------------

// export const eventsData = RAINFALL_EVENTS.events
//   .slice(0)
//   .reverse()
//   .map((e, i) => ({
//     ...e,
//     hours: moment(e.end_dt).diff(moment(e.start_dt), 'hours'),
//     isFetching: false
//   }))
//   .filter(e => e.hours > 0)

// export const eventLongest = Math.max(...eventsData.map(e => e.hours))
// export const eventLatest = eventsData.map(e => e.end_dt).sort()[eventsData.length - 1]
// export const defaultStartDt = moment(eventLatest).startOf("month").format()
// export const defaultEndDt = moment(eventLatest).endOf("month").format()


// rainfall layers + styles (mapbox style spec)

export const MAP_LAYERS = {
  layerGauges: {
    id: 'gauges',
    source: 'gauge',
    type: 'circle',
    paint: {
      "circle-radius": 10,
      "circle-color": "rgba(255,255,255,0)",
    }
  },
  layerPixels : {
    id: 'pixels',
    source: 'pixel',
    type: 'fill-extrusion',
    paint: {
      'fill-extrusion-color': 'rgba(255,255,255,0.0)',
      // use an 'interpolate' expression to add a smooth transition effect to the
      // buildings as the user zooms in
      'fill-extrusion-height': 0,
      // [
      //   'interpolate',
      //   ['linear'],
      //   ['zoom'],
      //   15,
      //   0,
      //   15.05,
      //   ['get', 'total']
      // ],
      'fill-extrusion-base': 0,
      // [
      //   'interpolate',
      //   ['linear'],
      //   ['zoom'],
      //   15,
      //   0,
      //   15.05,
      //   0
      // ],
      'fill-extrusion-opacity': 0
    }
  }
}