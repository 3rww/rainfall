import axios from 'axios';
import { MD5 } from 'object-hash'
import { includes, keys, intersectionBy, xorBy, unionBy, get } from 'lodash-es'
import moment from 'moment'

import {
  requestRainfallData,
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
  pickActiveResultItem,
  switchTab,
  applyColorStretch,
  resetLayerSrcs,
  highlightSensor,
  pickSensor
} from './actions'

import {
  selectFetchKwargs,
  selectFetchHistoryItemById,
  selectActiveFetchHistoryItem,
  selectLatestlegacyGarrTS,
  selectLatestlegacyGaugeTS,
  selectMapStyleSourceDataFeatures,
  selectSensorGeographyLookup
} from './selectors'

import { 
  // transformEventsJSON, 
  transformDataApiEventsJSON,
  transformRainfallGaugesToMapboxSourceObject,
  transformRainfallPixelsToMapboxSourceObject,
  transformRainfallResults,
  transformFeatureToOption
} from './utils/transformers'


import {
  MAP_LAYERS,
  // EVENTS_JSON_URL,
  EVENTS_API_URL,
  TIMESTAMPS_API_URL,
  URL_GEOGRAPHY_LOOKUP,
  URL_GARRD_GEOJSON,
  URL_GAUGE_GEOJSON,
  CONTEXT_TYPES,
  REQUEST_TIME_INTERVAL,
  // BREAKS_005,
  BREAKS_050,
  // BREAKS_100,
  SENSOR_TYPES
} from './config'


import store from './index'

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
    // new Promise((resolve, reject) => {
    //   let result = dispatch(fetchJSON({
    //     url: EVENTS_JSON_URL,
    //     pathArray: ["rainfallEvents", "list"],
    //     transformer: transformEventsJSON,
    //     keepACopy: false
    //   }))
    //   resolve(result)
    // }),
    //get the rainfall events json from the API
    new Promise((resolve, reject) => {
      let result = dispatch(fetchJSON({
        url: EVENTS_API_URL,
        pathArray: ["rainfallEvents", "list"],
        transformer: transformDataApiEventsJSON,
        keepACopy: false
      }))
      resolve(result)
    }),    
    
    // get the rainfall events json
    new Promise((resolve, reject) => {
      let result = dispatch(fetchJSON({
        url: TIMESTAMPS_API_URL,
        pathArray: ["stats", "latest"],
        transformer: false,
        keepACopy: false
      }))
      resolve(result)
    }),
    // get the lookup for geographies (basin, muni, watershed)
    new Promise((resolve, reject) => {
      let result = dispatch(fetchJSON({
        url: URL_GEOGRAPHY_LOOKUP,
        pathArray: ['refData', 'lookups'],
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
        
        // apply style defaults to the default results map layers
        dispatch(applyColorStretch({breaks: BREAKS_050}))

        // calculate event stats
        // TODO: make an API endpoint for a database view that does this calc 
        // to save some time here
        // dispatch(calcEventStats())

      })
      .then(() => {

        // set the default date/time range for all the contexts

        dispatch(pickRainfallDateTimeRange({
          contextType: CONTEXT_TYPES.legacyRealtime,
          startDt: moment().subtract(2, 'hour').toISOString(),
          endDt: moment().toISOString()
        }))

        let maxDateLegacyGauge = selectLatestlegacyGaugeTS(store.getState())
        dispatch(pickRainfallDateTimeRange({
          contextType: CONTEXT_TYPES.legacyGauge,
          // startDt: moment(maxDateLegacyGauge).startOf('month').toISOString(),
          startDt: moment(maxDateLegacyGauge).subtract(1, 'month').toISOString(),
          endDt: maxDateLegacyGauge
        }))

        let maxDateLegacyGarr = selectLatestlegacyGarrTS(store.getState())
        dispatch(pickRainfallDateTimeRange({
          contextType: CONTEXT_TYPES.legacyGarr,
          // startDt: moment(maxDateLegacyGarr).startOf('month').toISOString(),
          startDt: moment(maxDateLegacyGarr).subtract(1, 'month').toISOString(),
          endDt: maxDateLegacyGarr
        }))

      })
      .then(() => dispatch(stopThinking("Initial data load complete."))
      )

  }
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

          try {


            // handle scenarios where the job technically finished but returned
            // no results
            if (r.data === null) {

              console.log('No data was returned.')
              dispatch(requestRainfallDataFail({
                requestId: requestId,
                contextType: contextType,
                results: {[sensor]: false},
                status: "error",
                messages: r.messages
              }))

            } else {

              // calculate totals and any stats
              r = transformRainfallResults(r)

              // dispatch the success action, which puts the data in the correct 
              // places, updates the status in the ui, etc.
              dispatch(requestRainfallDataSuccess({
                requestId: requestId,
                contextType: contextType,
                results: {[sensor]: r.data},
                processedKwargs: r.args,
                status: r.status,
                messages: r.messages
                // stats: {
                //   maxValue: r.maxValue,
                //   minValue: r.minValue
                // }
                // messages: (r.messages.length > 0) ? (r.messages) : (false)
              }))

              // Set the result item to active by default. This will 
              // highlight it in the history list for the context and put it 
              // on the map for that context.
              dispatch(pickActiveResultItem({
                requestId: requestId,
                contextType: contextType
              }))              

            }



          } catch (e) {
            // this handles any server-side request errors.
            console.log('An error occurred processing the result.', e)
            dispatch(requestRainfallDataFail({
              requestId: requestId,
              contextType: contextType,
              results: {[sensor]: false},
              status: "error",
              messages: r.messages
            }))

          }

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
          messages: ['An error occurred when trying to fetch the rainfall data.', error]
        }))
      }
    )
    .catch(error => {
      console.error('An error occurred.', error)
      dispatch(requestRainfallDataFail({
        requestId: requestId,
        contextType: contextType,
        results: {[sensor]: false},
        status: "error",
        messages: ['An error occurred when trying to fetch the rainfall data.', error]
      }))      
    });
    // .finally(() => console.log("_fetchRainfallDataFromApiV2 completed"))

}



/**
 * request data from the 3RWW Rainfall API
 * @param {*} payload 
 */
export function fetchRainfallDataFromApiV2(payload) {

  // console.log(payload)

  let state = store.getState()

  return function (dispatch) {

    let { contextType, rainfallDataType } = payload
    // get the active batch of Fetch Kwargs
    let kwargs = selectFetchKwargs(state, contextType)

    // generate a unique ID, based on the hash of the kwargs
    // this will let us 1) update the correct object in fetchHistory
    // with the results, and 2) not retrieve the same data twice
    let requestId = MD5(kwargs)

    let matchingRequest = selectFetchHistoryItemById(state, requestId, contextType)

    if (matchingRequest !== undefined) {
      console.log("This exact request was already made. Keeping existing data from request", matchingRequest.requestId)
      if (matchingRequest.isActive === false) {
        dispatch(pickActiveResultItem({
          requestId: matchingRequest.requestId,
          contextType: contextType
        }))
      }

    }

    // parse the props of selectedEvent to form the body of the API request
    let requestSensors = ['gauge', 'basin']

    requestSensors.forEach((s, i) => {

      // then deal with the IDs.
      // It gets a little weird here: get the correct names used for various 
      // api params and state tree lookups
      // [0: api url endpoint and state tree path, 1: api param]      

      let sensor = (s === 'basin') ? ['pixel', 'pixels'] : ['gauge', 'gauges']

      // skip if no selections
      if (kwargs.sensorLocations[sensor[0]].length === 0) {
        return
      }

      // assemble the request params, except IDs
      let requestParams = {
        start_dt: kwargs.startDt,
        end_dt: kwargs.endDt,
        rollup: kwargs.rollup,
        f: kwargs.f
      }

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

      // console.log(s, sensor[0], params)

      _fetchRainfallDataFromApiV2(dispatch, requestId, sensor[0], contextType, url, params)

    })

  }

}

/**
 * 
 * @param {*} payload 
 */
export function pickDownload(payload) {

  let { contextType, ...fetchHistoryItem } = payload

  return function (dispatch) {
    
    let requestId = fetchHistoryItem.requestId

    // let sensors = keys(fetchHistoryItem.results)
    if (!fetchHistoryItem.isActive) {
      // Set the result item to active by default. This will 
      // highlight it in the history list for the context and put it 
      // on the map for that context.
      dispatch(pickActiveResultItem({
        requestId: requestId,
        contextType: contextType
      }))
    }

    // Update the map layer style for the layers used to represent
    // results. e.g., gauge-results, pixel-results.
    // sensors.forEach(sensor => {
    //   dispatch(setLayerStyle({
    //     requestId: requestId,
    //     contextType: contextType,
    //     sensor: sensor,
    //     recall: true
    //   }))
    // })

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

  let contextType = payload
  
  return function(dispatch) {
  
    // switch the tab
    dispatch(switchTab(contextType))

    // select the active item in the context (which we just set above)
    let fhi = selectActiveFetchHistoryItem(store.getState())

    if (fhi === undefined) {
      dispatch(resetLayerSrcs({lyrSrcNames: keys(SENSOR_TYPES)}))
    } else {
      dispatch(pickActiveResultItem({
        requestId: fhi.requestId,
        contextType: contextType
      }))      
    }
    // set the active result


    // set the layer style on the map using the active item, if any
    // dispatch(setLayerStyle({
    //   requestId: fhi.requestId,
    //   contextType: payload,
    // }))

  }

}

/******************************************************************************
 * ACTIONS THAT FIRE MULTIPLE REDUCERS
 */


/**
 * Dispatch pickSensor and highlightSensor when clicking a tract on the map.
 * Use when the sensors's geojson feature is the source of the sensor ID.
 * Handles comparison of payload to state tree so that `pickSensor` and 
 * `highlightSensor` are provided with only the list of sensors to show 
 * @param {*} payload arguments match that of the `pickSensor` reducer
 */
export function pickSensorMiddleware(payload, isMappable=true) {

  let state = store.getState()

  console.log(payload)

  const { contextType, sensorLocationType, selectedOptions, inputType } = payload

  // const sensorFeature = { ...payload }
  // console.log(sensorFeature)

  return async function (dispatch) {

    let newOpts = []
    let oldOpts = []
    let opts = []

    if (selectedOptions !== null || get(selectedOptions, 'length', 0) !== 0) {

      newOpts = selectedOptions.filter((opt) => opt !== null)
      oldOpts = [...selectFetchKwargs(state, contextType).sensorLocations[sensorLocationType]]              

      // console.log("------------------")
      console.log("existing selection",  oldOpts) //.map(i => i.label))
      console.log("incoming selection", newOpts) //.map(i => i.label))  
      
      // react-select always send the entire list of selections everytime
      if (inputType === "geomPicker") {
        if (newOpts.length < oldOpts.length) {
          // determine what is left in both
          opts = intersectionBy(oldOpts, newOpts, 'value')
        } else {
          // combine them both
          opts = unionBy(oldOpts, newOpts, 'value')
        }
      // selections from the map only send those picked
      } else {
        // if newOpt in oldOpts, remove it, leave the rest as-is
        // if newOpt not in oldOpts, add it leave the rest as-is        
        opts = xorBy(oldOpts, newOpts, 'value')  
      }
      console.log("new selection", opts)//.map(i =>i.label))
    }


    let kwargs = {
      contextType: contextType,
      sensorLocationType: sensorLocationType,
      selectedOptions: opts
    }

    dispatch(pickSensor(kwargs))
    if (isMappable) { dispatch(highlightSensor(kwargs))}

  }

}


/**
 * similar to pickSensorMiddleware, this function takes a user-selected geography 
 * and crosswalks it to a list of pixels and gauges. It then fires pickSensor
 * action to update the selected geography state, and then fires the 
 * pickSensorMiddleware(pixels) and pickSensorMiddleware(gauges)
 * @param {*} payload 
 * @returns 
 */
export function pickSensorByGeographyMiddleware(payload) {

  let state = store.getState()

  const { selectedOptions, sensorLocationType, contextType, inputType } = payload

  return async function (dispatch) {

    console.log(payload)

    /**********************************
     * first: pass the geography selection to pickSensorMiddleware to update UI 
     * state, but *not* the map (isMappable = false)
     */    
    pickSensorMiddleware(payload, false)

      /**********************************
       * second: crosswalk the selected geographies to pixels and gauges
       */

    let sensorTypes = ['pixel', 'gauge']

    sensorTypes.forEach(st => {

      // if (selectedOptions !== null || get(selectedOptions, 'length', 0) !== 0) {

      let sIds = new Set() // need to be a string for comparison 
      if (selectedOptions !== null || get(selectedOptions, 'length', 0) !== 0) {
        // gets the list of Sensor Ids associated with each selected geography
        selectedOptions.forEach((opt, i) => {
          let lkp = selectSensorGeographyLookup(state, opt.value);
          get(lkp, st, []).forEach(v => sIds.add(v.toString()));
        })
      }

      // convert the set to an array
      let sensorIds = [...sIds]

      // we then need to turn that list of sensor ids into options objects 
      // themselves, so we do another lookup
      let selectedFeatures = selectMapStyleSourceDataFeatures(state, st)
        .filter(f => includes(sensorIds, f.properties.id))
      // then convert that to an options object
      let selectedSensorOptions = selectedFeatures
        .map(f => transformFeatureToOption(f))
      
      // dispatch the pickSensor and highlightSensor actions
      // with assembled arguments:
      let kwargs = {
        contextType: contextType,
        sensorLocationType: st,
        selectedOptions: selectedSensorOptions,
        inputType: inputType
      }

      dispatch(pickSensorMiddleware(kwargs))


    })

  }

}
