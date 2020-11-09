import { createReducer } from '@reduxjs/toolkit'
import moment from 'moment'
import { set, get, forEach, keys, has, includes } from 'lodash-es'

import { initialState } from './initialState'

import { 
  SENSOR_TYPES,
  RAINFALL_BREAK_COUNT,
  RAINFALL_COLOR_ARRAY,
  RAINFALL_COLOR_MODE
} from './config'

import {
  switchTab,
  mapLoaded,
  setStyle,
  filterEventByHours,
  pickRainfallEvent,
  pickRainfallDateTimeRange,
  pickSensor,
  pickInterval,
  setActiveResultItem,
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
  stopThinking,
  setLayerStyle
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
  selectFetchHistory,
  selectLayersByIds,
  selectLayersByStartsWithId
} from './selectors'

import {
  minmaxTableAttr,
  buildColorStyleExpression
} from './utils'

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
      if (action.payload !== undefined) { 
        console.log(action.payload) 
        state.progress.messages.push(action.payload)
      }
      state.progress.isThinking = state.progress.isThinking + 1
    },
    [stopThinking]: (state, action) => {
      if (action.payload !== undefined) { 
        console.log(action.payload)
        state.progress.messages.push(action.payload)
      }
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
      // console.log(action.payload)
      let {eventid, contextType} = action.payload
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

      let { fetchKwargs, requestId, contextType, status, messages } = action.payload

      let currentFetch = selectFetchHistoryItemById(state, requestId, contextType)
      // creates a fetch history item, which includes all the parameters
      // that were used in generating the request
      if (currentFetch == undefined) {
        selectFetchHistory(state, contextType).push({
          fetchKwargs: fetchKwargs,
          requestId: requestId,
          isFetching: 1,
          isActive: false,
          results: false,
          status: status
        })
      } else {
        currentFetch.isFetching = currentFetch.isFetching + 1
      }

    },
    /**
     * upon successful rainfall data request, turn off fetching status, save
     * the data, save the fetch kwargs as processed, and save the API status.
     */
    [requestRainfallDataSuccess]: (state, action) => {

      let { requestId, contextType, results, processedKwargs, status, messages } = action.payload
      
      console.log("request", requestId, status)

      // the current fetch:
      selectFetchHistoryItemsById(state, requestId, contextType).forEach(fetchItem => {
        // set fetching status to false
        fetchItem.isFetching = fetchItem.isFetching - 1
        // push the results
        fetchItem.results = { ...results, ...fetchItem.results }
        // save a copy of the request kwargs as interpreted by the API (useful for debugging)
        fetchItem.processedKwargs = processedKwargs
        // save the API status message for good measure
        fetchItem.status = status

        // then for each type of result (potentially: raingauge and/or pixel)
        // manipulate the map state by first adding the results to the geojson
        // keys(results).forEach(layerSource => {
        //   console.log(layerSource)
        //   // find the corresponding geojson (original copy)
        //   let thisGeoJson = { ...state.refData[layerSource].data }
        //   // add the results to the properties in the corresponding geojson feature
        //   let resultDataList = results[layerSource]
        //   resultDataList.forEach((sensor) => {
        //     thisGeoJson.features
        //       .filter(f => f.id == sensor.id)
        //       .forEach(f => {
        //         let initialValue = 0;
        //         f.properties = {
        //           ...f.properties,
        //           data: sensor.data,
        //           total: (
        //             sensor.data.length > 1 & sensor.data.length !== 0
        //             ) ? (
        //             sensor.data.map(i => i.val).reduce((totalValue, currentValue) => totalValue + currentValue, initialValue)
        //             ) : (
        //               sensor.data[0].val
        //             )
        //         }
        //       })
        //     // repalce the geojson in the style sheet with the updated version
        //     state.mapStyle.sources[layerSource].data = thisGeoJson
        //   })

        // })

      })

    },
    /**
     * Similar to getRainfallSuccess, but used for selecting a previously
     * downloaded rainfall dataset
     */

    [requestRainfallDataFail]: (state, action) => {
      let { requestId, results, status, messages } = action.payload
      console.log(requestId, status)
      let fetchItem = selectAnyFetchHistoryItemById(state, requestId)
      fetchItem.isFetching = fetchItem.isFetching - 1
      fetchItem.status = status
      // fetchItem.results = {...results, ...fetchItem.results}
    },
    [setActiveResultItem]: (state, action) => {
      let {requestId, contextType} = action.payload
      selectFetchHistoryItemsById(state, requestId, contextType)
        .forEach(i => i.isActive = true)
      selectFetchHistoryItemsByIdInverse(state, requestId, contextType)
        .forEach(i => i.isActive = false)
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
    /**
     * add mapbox layer styles to the style object in the state, optionally
     * at a specified position.
     * See `MAP_LAYERS` in ./config.js for an example of what is consumed here.
     */
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
    [setLayerStyle]: (state, action)  => {

      // expand the payload
      let { requestId, contextType } = action.payload

      // get the source data used for styling the layer
      let fetchHistoryItem = selectFetchHistoryItemById(state, requestId, contextType)
      let sensors = keys(fetchHistoryItem.results)

      let styleExp, legendContent;

      // if fetchHistoryItem has style and legend props, we use those to set
      // the style on the layer.
      if (has(fetchHistoryItem, 'style') && has(fetchHistoryItem, 'legend')) {
        styleExp = fetchHistoryItem.styleExp
        legendContent = fetchHistoryItem.legendContent

      // if they don't then this is the first time we're putting this on
      // the map, and we need to calculate them.        
      } else {
        // we create a single style expression object from the composite of all
        // sensor types present, since we want to show gauges and pixels
        // on the same scale at the same time

        // first put all the results into one array:
        let allResults = [] 
        sensors.forEach(s => {
          allResults = allResults.concat(
            fetchHistoryItem.results[s]
            // .map(r => {
            //   return {id: Number(r.id), data:r.data, total:r.total}
            // })
          )
        })
        console.log("allResults", allResults)
        // calculate stats for that array
        let minmax = minmaxTableAttr(allResults, 'total')
        // build the style expression
        let breaks = 7
        let symbology = buildColorStyleExpression(
          allResults,
          'total',
          'id',
          RAINFALL_COLOR_ARRAY,
          RAINFALL_COLOR_MODE,
          RAINFALL_BREAK_COUNT,
          'e',
          minmax
        )

        styleExp = symbology.styleExp
        legendContent = symbology.legendContent

        // save the calc'd style and legend to the fetch history item
        fetchHistoryItem.styleExp = styleExp
        fetchHistoryItem.legendContent = legendContent
        fetchHistoryItem.stats = minmax

      }    

      // update state:

      // apply the style expression to the layers:
      let lyrIdsToStyle = sensors.map(s => `${s}-results`)
      let lyrIdsToNoteStyle = keys(SENSOR_TYPES).filter(st => !includes(sensors, st))
      // find those layers and update their paint props
      selectLayersByStartsWithId(state, lyrIdsToStyle)
        .forEach(lyr => {
          lyr.paint[`${lyr.type}-color`] = styleExp
          lyr.paint[`${lyr.type}-opacity`] = 0.8
        })

      if (lyrIdsToNoteStyle.length > 0) {
        selectLayersByStartsWithId(state, lyrIdsToNoteStyle)
        .forEach(lyr => {
          lyr.paint[`${lyr.type}-color`] = "#fff"
          lyr.paint[`${lyr.type}-opacity`] = 0
        })
      }

      // set the legend property
      set(state, ['mapLegend'], legendContent)

    },
  }
)