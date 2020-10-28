import { createReducer } from '@reduxjs/toolkit'
import moment from 'moment'
import { set, get, forEach, keys, has } from 'lodash-es'

import { initialState } from './initialState'

import {
  switchTab,
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
  selectEventInverse,
  selectFetchKwargs,
  selectFetchHistoryItemById,
  selectFetchHistoryItemsById,
  selectFetchHistoryItemsByIdInverse,
  selectAnyFetchHistoryItemById,
  selectRainfallEvents,
  selectFetchHistory
} from './selectors'

/**
 * root reducer
 */
export const rootReducer = createReducer(
  // INITIAL STATE ----------------------
  initialState,

  // REDUCERS----------------------------
  {
    [switchTab]: (state, action) => {
      state.progress.tab = action.payload
    },
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
    [startThinking]: (state, action) => {
      if (action.payload !== undefined) { console.log(action.payload) }
      state.progress.isThinking = state.progress.isThinking + 1
    },
    [stopThinking]: (state, action) => {
      if (action.payload !== undefined) { console.log(action.payload) }
      state.progress.isThinking = state.progress.isThinking - 1
    },
    /**
     * calculate stats for rainfall events in the store
     */
    [calcEventStats]: (state, action) => {
      const eventsData = state.rainfallEvents.list
      let eventLatest = eventsData.map(e => e.endDt).sort()[eventsData.length - 1]

      state.rainfallEvents.stats.latest = eventLatest
      state.rainfallEvents.stats.longest = Math.max(...eventsData.map(e => e.hours))
      state.rainfallEvents.stats.maxDate = moment(eventLatest).endOf("month").format()
    },

    /**
     * pick the datetime range from the calendar
     */
    [pickRainfallDateTimeRange]: (state, action) => {
      // update the start and end datetimes store for the type of rainfall data
      // to be queried.
      const { contextType, startDt, endDt } = action.payload
      let fk = selectFetchKwargs(state, contextType)
      fk.startDt = startDt
      fk.endDt = endDt
      // also deselect any events if previously selected
      selectRainfallEvents(state).list
        .filter(e => e.selected)
        .forEach(e => e.selected === false)
    },
    /**
     * pick the datetime range from the rainfall events list (historic only)
     */
    [pickRainfallEvent]: (state, action) => {
      // get the event from the list, set it's selected state to True
      console.log(action.payload)
      let {eventid, contextType } = action.payload
      let rainfallEvent = selectEvent(state, eventid)
      rainfallEvent.selected = true
      // set the others to false
      let otherEvents = selectEventInverse(state, eventid)
      otherEvents.forEach((v, i) => v.selected = false)

      //set the event's start and end datetimes as the actively selected event
      let fk = selectFetchKwargs(state, contextType)
      fk.startDt = rainfallEvent.startDt
      fk.endDt = rainfallEvent.endDt
    },
    /**
     * pick the sensor (the "where")
     */
    [pickSensor]: (state, action) => {

      const { contextType, sensorLocationType, selectedOptions } = action.payload

      if (selectedOptions !== null) {
        selectFetchKwargs(state, contextType).sensorLocations[sensorLocationType] = selectedOptions
          .filter((opt) => opt !== null)
      } else {
        selectFetchKwargs(state, contextType).sensorLocations[sensorLocationType] = []
      }

      // we do some additional work if a basin was picked, finding corresponding pixels.
      if (sensorLocationType == 'basin') {
        if (selectedOptions !== null) {
          selectFetchKwargs(state, contextType).sensorLocations[sensorLocationType].forEach((b, i) => {
            let pixelIds = state.refData.basinPixelLookup[b.value]
            console.log(b.value, pixelIds.length)
            selectFetchKwargs(state, contextType).sensorLocations.pixel = pixelIds.map(i => ({ value: i, label: i }))
          })
        } else {
          selectFetchKwargs(state, contextType).sensorLocations.pixel = []
        }
      }

    },
    /**
     * pick the interval used for rainfall summation: 15-min, hourly, etc.
     */
    [pickInterval]: (state, action) => {
      let { rollup, contextType } = action.payload
      selectFetchKwargs(state, contextType).rollup = rollup
    },

    /**
     * requestRainfallData/Success/Fail
     * used to indicate that rainfall is being requested, 
     * w/ success & failure actions
     */
    [requestRainfallData]: (state, action) => {

      let { fetchKwargs, requestId, contextType } = action.payload

      let currentFetch = selectFetchHistoryItemById(state, requestId, contextType)
      // creates a fetch history item, which includes all the parameters
      // that were used in generating the request
      if (currentFetch == undefined) {
        selectFetchHistory(state, contextType).push({
          fetchKwargs: fetchKwargs,
          requestId: requestId,
          isFetching: 1,
          isActive: false,
          results: false
        })
      } else {
        currentFetch.isFetching = currentFetch.isFetching + 1
      }

    },
    [requestRainfallDataSuccess]: (state, action) => {

      console.log("request", action.payload, "succeeded")
      let { requestId, contextType, results, processedKwargs } = action.payload

      // the current fetch:
      selectFetchHistoryItemsById(state, requestId, contextType).forEach(fetchItem => {
        // set actively selected status to true
        fetchItem.isActive = true
        // set fetching status to false
        fetchItem.isFetching = fetchItem.isFetching - 1
        // push the results
        fetchItem.results = { ...results, ...fetchItem.results }
        // save a copy of the request kwargs as interpreted by the API (useful for debugging)
        fetchItem.processedKwargs = processedKwargs

        // then for each type of result (potentially: raingauge and/or pixel)
        // manipulate the map state by first adding the results to the geojson
        keys(results).forEach(layerSource => {

          // find the corresponding geojson (original copy)
          let thisGeoJson = { ...state.refData[layerSource].data }
          // add the results to the properties in the corresponding geojson feature
          forEach(results[layerSource], (rainfallData, sensorId) => {
            thisGeoJson.features
              .filter(f => f.id == sensorId)
              .forEach(f => {
                f.properties = {
                  ...f.properties,
                  intervals: rainfallData.data,
                  total: rainfallData.total,
                  params: processedKwargs
                }
              })
            // repalce the geojson in the style sheet with the updated version
            state.mapStyle.sources[layerSource].data = thisGeoJson
          })

        })

      })

      // for all other fetches (if any), set isActive to false
      selectFetchHistoryItemsByIdInverse(state, requestId, contextType)
        .forEach(h => h.isActive = false)

    },
    /**
     * Similar to getRainfallSuccess, but used for selecting a previously
     * downloaded rainfall dataset
     */
    [pickDownload]: (state, action) => {

      console.log(action.payload)
      let { contextType, ...fetchHistoryItem } = action.payload
      let requestId = fetchHistoryItem.requestId
      let fetchKwargs = fetchHistoryItem.fetchKwargs

      // update the state of the item in the download list
      let thisFetch = selectFetchHistoryItemById(state, requestId, contextType)
      console.log("thisFetch", thisFetch)
      thisFetch.isActive = true

      let otherFetches = selectFetchHistoryItemsByIdInverse(state, requestId, contextType)
      otherFetches.forEach((v) => v.isActive = false)
      console.log("otherFetches", otherFetches)

      // set the overall fetch kwargs to match those of the selected download
      let fk = selectFetchKwargs(state, contextType)
      fk = thisFetch.fetchKwargs

      // then for each type of result (potentially: raingauge and/or pixel)
      // manipulate the map state by first adding the results to the geojson
      keys(thisFetch.results).forEach(layerSource => {
        // find the corresponding geojson (original copy)
        let thisGeoJson = { ...state.refData[layerSource].data }
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
      let { requestId, results } = action.payload
      let fetchItem = selectAnyFetchHistoryItemById(state, requestId)
      fetchItem.isFetching = fetchItem.isFetching - 1
      // fetchItem.results = {...results, ...fetchItem.results}
    },

    /**
     * set parameters used to filter list of rainfall events
     */
    [filterEventByHours]: (state, action) => {
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
          let { INDEX, ...lyr } = v
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