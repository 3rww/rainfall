/**
 * config.js
 * contains constants and derived variables required on application initializations. 
 * Some of these is used in the initial state tree, others are imported by 
 * components by middleware
 */

import moment from 'moment'

// Seed data --------------------------------------------
import RAINFALL_EVENTS from '../data/events.json'


// Mapbox constants -------------------------------------
export const MAPBOX_TOKEN = 'pk.eyJ1IjoiY2l2aWNtYXBwZXIiLCJhIjoiY2s2azUycjc4MDBvMzNsbnliZDU4dTZiZCJ9.35H-OLQdcpQuCjKE9iAmwg'
export const MAPBOX_STYLE_BASEMAP = 'mapbox://styles/civicmapper/ck2xlf5qg2pbc1clav3r8ddku'

// Service URLs -----------------------------------------
// export const URL_GARRD_GEOJSON = "https://services6.arcgis.com/dMKWX9NPCcfmaZl3/arcgis/rest/services/garrd/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&returnExceededLimitFeatures=true&f=pgeojson"
// export const URL_GAUGE_GEOJSON = "https://services6.arcgis.com/dMKWX9NPCcfmaZl3/arcgis/rest/services/3RWWRG/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&returnExceededLimitFeatures=true&f=pgeojson"
export const API_URL_ROOT = "http://127.0.0.1:3000/"
export const URL_GARRD_GEOJSON = "/static/data/pixels.geojson"
export const URL_GAUGE_GEOJSON = "/static/data/gauges.geojson"
export const URL_BASIN_PIXEL_LOOKUP = "/static/data/basin-lookup-pixel.json"


// rainfall events data ----------------------------------
// this is derived from a static file for now; will be replaced with an API call
export const eventsData = RAINFALL_EVENTS.events
  .slice(0)
  .reverse()
  .map((e, i) => ({
    ...e,
    hours: moment(e.end_dt).diff(moment(e.start_dt), 'hours'),
    isFetching: false
  }))
  .filter(e => e.hours > 0)

export const eventLongest = Math.max(...eventsData.map(e => e.hours))
export const eventLatest = eventsData.map(e => e.end_dt).sort()[eventsData.length - 1]
export const defaultStartDt = moment(eventLatest).startOf("month").format()
export const defaultEndDt = moment(eventLatest).endOf("month").format()


// rainfall layers + styles (mapbox style spec)




export const mapLayers = {
  layerGauges: {
    id: 'rain-gauges',
    source: 'raingauge',
    type: 'circle',
    paint: {
      "circle-radius": 10,
      "circle-color": "rgba(255,255,255,0)",
    }
  },
  layerPixels : {
    id: 'rain-gaard',
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