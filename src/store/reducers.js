import { createReducer } from '@reduxjs/toolkit'
import moment from 'moment'
import { set, get, forEach, keys, has } from 'lodash-es'

import { initialState } from './initialState'

import {
  mapLoaded,
  setStyle,
  filterEventByHours,
  pickRainfallEvent,
  pickRainfallDateTimeRange,
  pickSensor,
  pickInterval,
  pickDownload,
  requestRainfallData,
  requestRainfallDataInvalid,
  requestRainfallDataSuccess,
  requestRainfallDataFail,
  asyncAction,
  asyncActionSuccess,
  asyncActionFail,
  addLayers,
  calcEventStats,
  setState,
  isFetching,
  startThinking,
  stopThinking
} from './actions'

import { 
  selectEvent, 
  selectFetchKwargs,
  selectFetchById,
  selectFetchesById,
  selectFetchesByIdInverse,
  selectSelectedEvent
} from './selectors'

/**
 * root reducer
 */
export const rootReducer = createReducer(
  // INITIAL STATE ----------------------
  initialState,

  // REDUCERS----------------------------
  {
    /**
     * Request JSON (+success/fail)
     * used by the fetchJSON middleware
     */
    [asyncAction]: (state, action) => {
      state.progress.isFetching = true
    },
    [asyncActionSuccess]: (state, action) => {
      state.progress.isFetching = false
      const { data, pathArray, keepACopy } = action.payload
      set(state, pathArray, data)
      if (keepACopy === true) {
        let refPatharray = ['refData', pathArray[pathArray.length - 1]]
        set(state, refPatharray, data)
      }
    },
    [asyncActionFail]: (state, action) => {
      state.progress.isFetching = false
      console.log(action.payload)
    },
    [isFetching]: (state, action) => {
      state.progress.isFetching = action.payload.isFetching
    },
    [startThinking]: state => {
      state.progress.isThinking = state.progress.isThinking + 1
    },
    [stopThinking]: state => {
      state.progress.isThinking = state.progress.isThinking - 1
    },
    /**
     * calculate stats for rainfall events in the store
     */
    [calcEventStats] : (state, action) => {
      const eventsData = state.rainfallEvents.list
      let eventLatest = eventsData.map(e => e.end_dt).sort()[eventsData.length - 1]
      state.rainfallEvents.stats.latest = eventLatest
      state.rainfallEvents.stats.longest = Math.max(...eventsData.map(e => e.hours))
      state.rainfallEvents.stats.minDate = moment(eventLatest).startOf("month").format()
      state.rainfallEvents.stats.maxDate = moment(eventLatest).endOf("month").format()
    },
    /**
     * pickRainfallEvent
     * retrieves details for the selected event from the events list;
     * copies to fetchKwargs.selectedEvent state property
     */
    [pickRainfallEvent]: (state, action) => {
      // get the event from the list
      let rainfallEvent = selectEvent(state, action.payload)
      console.log({...rainfallEvent})
      // set as the actively selected event
      state.fetchKwargs.selectedEvent = rainfallEvent
    },
    [pickRainfallDateTimeRange]: (state, action) => {
      const { startDt, endDt } = action.payload
      let selectedEvent = selectSelectedEvent(state)
      selectedEvent = {
        start_dt: startDt,
        end_dt: endDt,
        eventid: "custom",
        report: null
      }
      state.fetchKwargs.selectedEvent = selectedEvent
    },
    [pickSensor]: (state, action) => {

      const {sensorLocationType, selectedOptions} = action.payload
      if (selectedOptions !== null) {
        selectFetchKwargs(state).sensorLocations[sensorLocationType] = selectedOptions
          .filter((opt) => opt !== null)
      } else {
        selectFetchKwargs(state).sensorLocations[sensorLocationType] = []
      }

      // we do some additional work if a basin was picked, finding corresponding pixels.
      if (sensorLocationType == 'basin') {
        selectFetchKwargs(state).sensorLocations[sensorLocationType].forEach((b, i) => {
          let pixelIds = state.refData.basinPixelLookup[b.value]
          selectFetchKwargs(state).sensorLocations.pixel = pixelIds.map(i => ({value: i, label: i}))
        })
      }

    },
    [pickInterval]: (state, action) => {
      state.fetchKwargs.rollup = action.payload
    },
    [requestRainfallDataInvalid]: (state, action) => {
    },
    /**
     * requestRainfallData/Success/Fail
     * used to indicate that rainfall is being requested, 
     * w/ success & failure actions
     */
    [requestRainfallData]: (state, action) => {

      let { fetchKwargs, requestId, sensor } = action.payload

      let currentFetch = state.fetchHistory.find(h => h.requestId == requestId)

      if (currentFetch == undefined) {
        state.fetchHistory.push({
          fetchKwargs: fetchKwargs,
          requestId: requestId,
          isFetching: true,
          isActive: false,
          results: false,
          // results: {[sensor]: false}
        })
      } // else {
      //   currentFetch[sensor] = false
      // }

      state.progress.isFetching = true

    },
    [requestRainfallDataSuccess]: (state, action) => {

      console.log("request", action.payload, "succeeded")
      let {requestId, results, kwargs } = action.payload

      // the current fetch:
      selectFetchesById(state, requestId).forEach(thisRequest => {
        // set actively selected status to true
        thisRequest.isActive = true
        // set fetching status to false
        thisRequest.isFetching = false
        // push the results
        thisRequest.results = {...results, ...thisRequest.results}
  
        // then for each type of result (potentially: raingauge and/or pixel)
        // manipulate the map state by first adding the results to the geojson
        keys(results).forEach(layerSource => {
  
          // find the corresponding geojson (original copy)
          let thisGeoJson = {...state.refData[layerSource].data}
          // add the results to the properties in the corresponding geojson feature
          forEach(results[layerSource], (rainfallData, sensorId) => {
            thisGeoJson.features
              .filter(f => f.id == sensorId)
              .forEach(f => {
                f.properties = {
                  ...f.properties, 
                  intervals: rainfallData.data,
                  total: rainfallData.total,
                  params: kwargs
                }
              })
            // repalce the geojson in the style sheet with the updated version
            state.mapStyle.sources[layerSource].data = thisGeoJson
          })
  
        })

      })

      // for all other fetches (if any), set isActive to false
      selectFetchesByIdInverse(state, requestId).forEach(h => h.isActive = false)

      state.progress.isFetching = false

    },
    /**
     * Similar to getRainfallSuccess, but used for selecting a previously
     * downloaded rainfall dataset
     */
    [pickDownload]: (state, action) => {
      let { requestId, fetchKwargs } = action.payload
      console.log(requestId, fetchKwargs)
      // set the overall fetch kwargs to match those of the selected download
      state.fetchKwargs = fetchKwargs
      // update the state of the item in the download list

      state.fetchHistory
        .forEach(h => h.isActive = false)
      state.fetchHistory
        .filter(h => h.requestId == requestId)
        .forEach(h => h.isActive = true)

      let thisFetch = selectFetchById(state, requestId)

      // then for each type of result (potentially: raingauge and/or pixel)
      // manipulate the map state by first adding the results to the geojson
      keys(thisFetch.results).forEach(layerSource => {

        // find the corresponding geojson (original copy)
        let thisGeoJson = {...state.refData[layerSource].data}
        // add the results to the properties in the corresponding geojson feature
        forEach(thisFetch.results[layerSource], (rainfallData, sensorId) => {
          thisGeoJson.features
            .filter(f => f.id == sensorId)
            .forEach(f => {
              f.properties = {
                ...f.properties, 
                intervals: rainfallData.data,
                total: rainfallData.total,
                params: fetchKwargs
              }
            })
          // repalce the geojson in the style sheet with the updated version
          state.mapStyle.sources[layerSource].data = thisGeoJson
        })

      })        

    },    
    [requestRainfallDataFail]: (state, action) => {

      console.log("request", action.payload, "failed")
      let {requestId, results } = action.payload
      let thisRequest = selectFetchById(state, requestId)
      thisRequest.isFetching = false
      // thisRequest.results = {...results, ...thisRequest.results}
      state.progress.isFetching = false

    },

    /**
     * set parameters used to filter list of rainfall events
     */
    [filterEventByHours] : (state, action) => {
      state.eventFilters.maxHours = action.payload.maxHours
      // state.eventFilters.minHours = action.payload.minHours
    },
    /**
     * MAP LOADING AND STYLING ACTIONS
     */    
    [mapLoaded]: (state, action) => {

      // set map loading state
      if (!state.progress.mapLoaded) {
        state.progress.mapLoaded = true
      }

      return state
    },    
    [setStyle]: (state, action) => {
      state.mapStyle = action.payload
      if (!state.progress.initialStyleLoaded) {
        state.progress.initialStyleLoaded = true
      }
      return state
    },
    [addLayers]: (state, action) => {
      forEach(action.payload, (v, k) => {
        // if an index is provided, use for layer order
        if (has(v, 'INDEX')) {
          let {INDEX, ...lyr} = v
          let layers = [...state.mapStyle.layers]
          layers.splice(INDEX, 0, lyr);
          state.mapStyle.layers = layers
        // otherwise, put on top it on top of the layer list
        } else {
          state.mapStyle.layers.push(v)
        }
      })
    },
    /**
     * generic action called from middleware, used to set a piece of state, e.g.,
     * with the response from an async call
     */
    [setState]: (state, action) => {
      const { data, path, how } = action.payload

      if (how == "replace") {
        // put the JSON in the store at path using lodash's set function
        set(state, path, data)
      } else if (how == "append") {
        let existing = get(state, path)
        // console.log(existing, data)
        set(state, path, [...existing, ...data])
      }
    },    

  }
)