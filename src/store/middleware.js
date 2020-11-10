import axios from 'axios';
import { MD5 } from 'object-hash'
import { includes, keys } from 'lodash-es'
import moment from 'moment'

import {
  requestRainfallData,
  requestRainfallDataInvalid,
  requestRainfallDataSuccess,
  requestRainfallDataFail,
  asyncAction,
  asyncActionSuccess,
  asyncActionFail,
  startThinking,
  stopThinking,
  addLayers,
  pickRainfallDateTimeRange,
  calcEventStats,
  buildLayerStyle,
  setLayerStyle,
  setActiveResultItem,
  switchTab
} from './actions'

import {
  selectFetchKwargs,
  selectFetchHistoryItemById,
  selectActiveFetchHistory,
  selectActiveFetchHistoryItem
} from './selectors'

import { 
  transformEventsJSON, 
  transformRainfallGaugesToMapboxSourceObject,
  transformRainfallPixelsToMapboxSourceObject
} from './utils'

import {
  MAP_LAYERS,
  EVENTS_JSON_URL,
  URL_BASIN_PIXEL_LOOKUP,
  URL_GARRD_GEOJSON,
  URL_GAUGE_GEOJSON,
  CONTEXT_TYPES,
  REQUEST_TIME_INTERVAL
} from './config'


import store from './index'
import { distance } from 'chroma-js';

/**
 * Request JSON from a URL; put response.data into store via props 
 * spec'd in pathArray. Optionally transform response.data via passed-in
 * transformer function
 * @param {*} payload 
 */
export function fetchJSON(payload) {
  // Thunk middleware knows how to handle functions.
  // It passes the dispatch method as an argument to the function,
  // thus making it able to dispatch actions itself.

  // First dispatch: the app state is updated to inform
  // that the API call is starting; the currentEvent
  // is set in the store
  return function (dispatch) {

    const { url, pathArray, transformer, keepACopy } = payload

    dispatch(startThinking(`getting data from "${url}"`))
    dispatch(asyncAction(url))

    let data;

    // The function called by the thunk middleware can return a value,
    // that is passed on as the return value of the dispatch method.
    // In this case, we return a promise to wait for.
    // This is not required by thunk middleware, but it is convenient for us.
    return axios({
      url: url,
      method: 'GET',
    })
      .then(
        (response) => {
          if (transformer) {
            data = transformer(response.data)
          } else {
            data = response.data
          }
          // NOTE: We can dispatch many times!
          // Here, we update the app state with the results of the API call. 
          dispatch(asyncActionSuccess({ data: data, pathArray: pathArray, keepACopy: keepACopy }))
          return true
        },
        // Do not use catch, because that will also catch
        // any errors in the dispatch and resulting render,
        // causing a loop of 'Unexpected batch number' errors.
        // https://github.com/facebook/react/issues/6895        
        (error) => {
          console.log('An error occurred.', error)
          dispatch(asyncActionFail('An error occurred.'))
          return false
        }
      )
      .finally(() => dispatch(stopThinking(`data from "${url}" loaded to ${pathArray.join(".")}`)))

  }
}


/******************************************************************************
 * APPLICATION START UP 
 */

/**
 * asynchronously fetch the three seed datasets required for the app to start and render. 
 * Called by initDataFetch 
 * @param {*} dispatch 
 */
function promiseFetchReferenceDatasets(dispatch) {

  return Promise.all([
    // get the rainfall events json
    new Promise((resolve, reject) => {
      let result = dispatch(fetchJSON({
        url: EVENTS_JSON_URL,
        pathArray: ["rainfallEvents", "list"],
        transformer: transformEventsJSON,
        keepACopy: false
      }))
      resolve(result)
    }),
    // get the pixel-basin lookup json
    new Promise((resolve, reject) => {
      let result = dispatch(fetchJSON({
        url: URL_BASIN_PIXEL_LOOKUP,
        pathArray: ['refData', 'basinPixelLookup'],
        transformer: false,
        keepACopy: false
      }))
      resolve(result)
    }),
    // get the gauge geojson
    new Promise((resolve, reject) => {
      let result = dispatch(fetchJSON({
        url: URL_GAUGE_GEOJSON,
        pathArray: ["mapStyle", "sources", "gauge"],
        transformer: transformRainfallGaugesToMapboxSourceObject,
        keepACopy: true
      }))
      resolve(result)
    }),
    // get the pixel geojson
    new Promise((resolve, reject) => {
      let result = dispatch(fetchJSON({
        url: URL_GARRD_GEOJSON,
        pathArray: ["mapStyle", "sources", "pixel"],
        transformer: transformRainfallPixelsToMapboxSourceObject,
        keepACopy: true
      }))
      resolve(result)
    })

  ])

}

/**
 * initial async data fetches, map set up, and pre-calculations
 * @param {*} payload 
 */
export function initDataFetch(payload) {

  return function (dispatch) {

    dispatch(startThinking("Loading reference data and map layers"))

    // get all the core datsets and layers and add them to the store (in parallel), then...
    promiseFetchReferenceDatasets(dispatch)
      .then((r) => {
        // add additional map layer styles
        dispatch(addLayers(MAP_LAYERS))
        // calculate event stats
        // TODO: make an API endpoint for a database view that does this calc 
        // to save some time here
        dispatch(calcEventStats())

      })
      .then(() => {

        // set the default date/time range for all the contexts

        let maxDate = store.getState().rainfallEvents.stats.maxDate

        dispatch(pickRainfallDateTimeRange({
          contextType: CONTEXT_TYPES.legacyRealtime,
          startDt: moment().subtract(2, 'hour').toISOString(),
          endDt: moment().toISOString()
        }))

        dispatch(pickRainfallDateTimeRange({
          contextType: CONTEXT_TYPES.legacyGauge,
          startDt: moment(maxDate).startOf('month').toISOString(),
          endDt: maxDate
        }))

        dispatch(pickRainfallDateTimeRange({
          contextType: CONTEXT_TYPES.legacyGarr,
          startDt: moment(maxDate).startOf('month').toISOString(),
          endDt: maxDate
        }))

      })
      .then(() => dispatch(stopThinking("Initial data load complete."))
      )

  }
}


const _calc_rainfall_stats = (r) => {

    // the API results don't come with rainfall total per sensor, 
    // so we tabulate rainfall values from one for all observation 
    // intervals for each sensor

    r.data.forEach((s) => {

      let initialValue = 0;
      let total = (
        s.data.length > 1 & s.data.length !== 0
      ) ? (
        s.data.map(i => i.val).reduce((totalValue, currentValue) => totalValue + currentValue, initialValue)
      ) : (
        s.data[0].val
      )
      // we assign negative totals as null, so they don't later on skew the symbology.
      // s.total = (total >= 0) ? total : null
      s.total = total

    })

    // let totals = r.data.map(row => row.total)
    // r.maxValue = Math.max(...totals)
    // r.minValue = Math.min(...totals)
  
    return r

}

/**
 * Recursive function for making calls to the API while the request is being
 * processed. Calls itself, or success or fail actions depending on API 
 * response. 
 * @param {*} dispatch 
 * @param {*} requestId 
 * @param {*} sensor 
 * @param {*} contextType 
 * @param {*} url 
 * @param {*} params 
 */
const _fetchRainfallDataFromApiV2 = (dispatch, requestId, sensor, contextType, url, params) => {

  // console.log(dispatch, requestId, sensor, contextType, url, params)

  // assemble the arguments for fetch
  let requestKwargs = {
    url: url,
    method: 'POST'
  }
  // if the request params are explicitly not `false`, then 
  // add them in; otherwise we've called this function in a recursive loop to
  // check on job status, and we don't want to include the params in that req.
  if (params !== false) {
    // requestKwargs.params = params
    requestKwargs.data = params
  }

  // make the request:
  axios(requestKwargs)
    .then(
      (response) => {
        // console.log(response)
        // get the API's JSON response from the data prop of the ajax response obj
        let r = response.data
        // log it
        console.log(`job ${r.meta.jobId} ${r.status} - ${sensor}`)
        // if job status is queued or started:
        if (includes(['queued', 'started'], r.status)) {
          // wait, then check on status/results at the provided 'job-url'
          // this triggers a recurive call to _fetchRainfallDataFromApiV2
          setTimeout(
            () => _fetchRainfallDataFromApiV2(dispatch, requestId, sensor, contextType, r.meta.jobUrl, false),
            REQUEST_TIME_INTERVAL
          )
        // if status is deferred or failed,
        } else if (includes(['deferred', 'failed'], r.status)) {
          // Dispatch the job failed action for recording in state, 
          // triggering ui, etc.
          dispatch(requestRainfallDataFail({
            requestId: requestId,
            contextType: contextType,
            results: {[sensor]: false},
            status: r.status,
            messages: r.messages            
          }))
        // if the job finishes:
        } else if (r.status === 'finished') {

          // calculate totals and any stats
          r = _calc_rainfall_stats(r)

          // dispatch the success action, which puts the data in the correct 
          // places, updates the status in the ui, etc.
          dispatch(requestRainfallDataSuccess({
            requestId: requestId,
            contextType: contextType,
            results: {[sensor]: r.data},
            processedKwargs: r.args,
            status: r.status,
            // stats: {
            //   maxValue: r.maxValue,
            //   minValue: r.minValue
            // }
            // messages: (r.messages.length > 0) ? (r.messages) : (false)
          }))
          dispatch(buildLayerStyle({
            requestId: requestId,
            contextType: contextType,
            sensor: sensor
          }))
          // Update the map layer style for the layers used to represent
          // results. e.g., gauge-results, pixel-results. In the future 
          // there could be others
          dispatch(setLayerStyle({
            requestId: requestId,
            contextType: contextType,
            sensor: sensor
          }))

          // Set the result item to active by default. This will 
          // highlight it in the history list for the context and put it 
          // on the map for that context.
          dispatch(setActiveResultItem({
            requestId: requestId,
            contextType: contextType
          }))

        } else if (r.status === "does not exist") {
          console.log("Job was cancelled.")
          dispatch(requestRainfallDataFail({
            requestId: requestId,
            contextType: contextType,
            results: {[sensor]: false},
            status: r.status,
            messages: r.messages
          }))
        }

      },
      // if the request itself errors out, we trigger dispatch the failure action
      (error) => {
        console.log('An error occurred.', error)
        dispatch(requestRainfallDataFail({
          requestId: requestId,
          contextType: contextType,
          results: {[sensor]: false},
          status: "error",
          messages: []
        }))
      }
    )
    .finally(() => console.log("_fetchRainfallDataFromApiV2 completed"))

}



/**
 * request data from the 3RWW Rainfall API
 * @param {*} payload 
 */
export function fetchRainfallDataFromApiV2(payload) {

  return function (dispatch) {

    let { contextType, rainfallDataType } = payload
    let kwargs = selectFetchKwargs(store.getState(), contextType)

    // generate a unique ID, based on the hash of the kwargs
    // this will let us 1) update the correct object in fetchHistory
    // with the results, and 2) not retrieve the same data twice
    let requestId = MD5(kwargs)

    // TODO: return data from selectedEvent if it's available (previously been fetched)

    // TODO: handle validation (here or in component)
    // requestRainfallDataInvalid(s)

    // parse the props of selectedEvent to form the body of the API request
    let requestSensors = ['gauge', 'basin']

    // return Promise.all([
    //   // get the rainfall events json
    //   new Promise((resolve, reject) => {

    //   })
    
    // ])

    requestSensors.forEach((s, i) => {

      // skip if no selections
      if (kwargs.sensorLocations[s].length == 0) {
        return
      }

      // assemble the request params, except IDs
      let requestParams = {
        start_dt: kwargs.startDt,
        end_dt: kwargs.endDt,
        rollup: kwargs.rollup,
        f: kwargs.f
      }

      // then deal with the IDs.
      // It gets a little weird here: get the correct names used for various 
      // api params and state tree lookups
      // 0: api url endpoint and state tree path, 1: api param
      let sensor = (s == 'basin') ? ['pixel', 'pixels'] : ['gauge', 'gauges']

      requestParams[sensor[1]] = kwargs.sensorLocations[sensor[0]].map(i => i.value).join(",")


      // indicate that the request is proceeding in the UI
      // stores the fetchKwargs from the state in the history object.
      dispatch(requestRainfallData({
        fetchKwargs: kwargs,
        requestId: requestId,
        contextType: contextType
      }))

      let url = `${process.env.REACT_APP_API_URL_ROOT}v2/${sensor[0]}/${rainfallDataType}/`
      let params = requestParams

      _fetchRainfallDataFromApiV2(dispatch, requestId, sensor[0], contextType, url, params)

    })

  }

}

export function pickDownload(payload) {

  let { contextType, ...fetchHistoryItem } = payload

  return function (dispatch) {
    
    let requestId = fetchHistoryItem.requestId

    let sensors = keys(fetchHistoryItem.results)

    // Set the result item to active by default. This will 
    // highlight it in the history list for the context and put it 
    // on the map for that context.
    dispatch(setActiveResultItem({
      requestId: requestId,
      contextType: contextType
    }))
    // Update the map layer style for the layers used to represent
    // results. e.g., gauge-results, pixel-results.
    sensors.forEach(sensor => {
      dispatch(setLayerStyle({
        requestId: requestId,
        contextType: contextType,
        sensor: sensor,
        recall: true
      }))
    })

  }
 
}

// /**
//  * function for re-running a previous download
//  * @param {*} payload 
//  */
// export function reFetchRainfallDataFromApiV2(payload) {

//   return function (dispatch) {
//     // select the current fetch item from the history via requestId
//     // dispatch a reducer that updates the fetchKwargs for the 
//     // context with that item.
//     // run fetchRainfallDataFromApiV2
//   }

// }


export function switchContext(payload) {
  
  return function(dispatch) {
  
    dispatch(switchTab(payload))
    // select the active item in the context
    let fhi = selectActiveFetchHistoryItem(store.getState())
    // set the layer style on the map using the active item, if any
    dispatch(setLayerStyle({
      requestId: fhi.requestId,
      contextType: payload,
    }))

  }

}