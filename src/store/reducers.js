import { createReducer } from '@reduxjs/toolkit'
import moment from 'moment'
import { set, get, forEach, keys, has, includes, cloneDeep } from 'lodash-es'

import { initialState } from './initialState'

import {
  SENSOR_TYPES,
  RAINFALL_BREAK_COUNT,
  RAINFALL_COLOR_ARRAY,
  RAINFALL_COLOR_MODE,
  LAYERS_W_RESULTS,
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
  pickActiveResultItem,
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
  buildLayerStyle,
  setLayerStyle,
  applyColorStretch,
  resetLayerSrcs,
  highlightSensor
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
  selectLyrSrcByName,
  selectLayerById,
  selectMapStyleSourceDataFeatures
} from './selectors'

import {
  minmaxTableAttr,
  buildColorStyleExpression,
  buildRainfallColorStyleExp
} from './utils/mb'
import {
  joinTabletoGeojson
} from './utils/transformers'

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

      // unset any map styles

      // set map styles per expression

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
      let { eventid, contextType } = action.payload
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
     * selectedOptions is the complete list of selected sensors
     */
    [pickSensor]: (state, action) => {

      const { contextType, sensorLocationType, selectedOptions } = action.payload

      if (selectedOptions !== null) {
        selectFetchKwargs(state, contextType).sensorLocations[sensorLocationType] = selectedOptions
          .filter((opt) => opt !== null)
      } else {
        selectFetchKwargs(state, contextType).sensorLocations[sensorLocationType] = []
      }

    },
    [highlightSensor]: (state, action) => {
      // console.log(action.payload)
      const { contextType, sensorLocationType, selectedOptions } = action.payload

      let selectedIds = selectedOptions.map(i => i.value)
      
      if (selectedOptions !== null) {
        selectMapStyleSourceDataFeatures(state, sensorLocationType).forEach((f, i) => {
          if (includes(selectedIds, f.id )) {
            f.properties.selected = true
          } else {
            f.properties.selected = false
          }
        })
        //   .filter(f => includes(selectedIds, f.id))
        //   .forEach((f, i) => {
        //     f.properties.selected = !f.properties.selected
        // })

      } else {
        selectMapStyleSourceDataFeatures(state, sensorLocationType).forEach((f, i) => {
          f.properties.selected = false
        })
      }

      // let { joinAttr } = action.payload
      // const tracts = state.selections.tracts.length !== 0 ? state.selections.tracts : ["none"]
      // selectAllHighlightLayers(state).forEach(lyr => {
      //   let lyrFilter = ['match', ['get', joinAttr], tracts, true, false]
      //   // console.log(lyr.id, lyrFilter)
      //   lyr.filter = lyrFilter
      // })
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
          status: status,
          messages: messages
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
      selectFetchHistoryItemsById(state, requestId, contextType)
        .forEach(fetchItem => {
          // set fetching status to false
          fetchItem.isFetching = fetchItem.isFetching - 1
          // push the results
          fetchItem.results = { ...results, ...fetchItem.results }
          // save a copy of the request kwargs as interpreted by the API (useful for debugging)
          fetchItem.processedKwargs = processedKwargs
          // save the API status message for good measure
          fetchItem.status = status
          // save the messages as well
          fetchItem.messages = messages

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
      fetchItem.messages = messages
      // fetchItem.results = {...results, ...fetchItem.results}
    },
    /**
     * set a rainfall query result as active, and join its data into the 
     * corresponding layer
     */
    [pickActiveResultItem]: (state, action) => {

      let { requestId, contextType } = action.payload

      // turn off all other items
      selectFetchHistoryItemsByIdInverse(state, requestId, contextType)
        .forEach(i => i.isActive = false)
      // turn on this item
      let i = selectFetchHistoryItemById(state, requestId, contextType)
      i.isActive = true

      // take the results from this item and join them to the layer sources
      keys(i.results).forEach(sensor => {

        // make a copy of the original layer, which we've kept for reference
        console.log(`getting reference ${sensor} layer`)
        let gj = cloneDeep(state.refData[sensor].data)
        let table = i.results[sensor]

        // join the results to the geojson
        console.log(`joining ${sensor} results to layer`)
        let gjForMap = joinTabletoGeojson(gj, table, 'properties.id', 'id', false)

        // push the geojson to the Mapbox source object
        console.log(`pushing udpated ${sensor} results layer to map`)
        selectLyrSrcByName(state, sensor).data = gjForMap

      })

      // for any others, empty them out.
      keys(SENSOR_TYPES)
        .filter(s => !includes(keys(i.results), s))
        .forEach(s => {
          console.log(s)
          let cleanGeojson = cloneDeep(state.refData[s].data)
          selectLyrSrcByName(state, s).data = cleanGeojson
        })

    },
    /**
     * Swaps the layer source ref data into the mapbox style sheet layer object.
     * If a list of names is provided, it will only do it for those layers;
     * otherwise it does it for all of them.
     */
    [resetLayerSrcs]: (state, action) => {
      let { lyrSrcNames } = action.payload

      if (lyrSrcNames === undefined) {
        lyrSrcNames = keys(SENSOR_TYPES)
      }

      if (lyrSrcNames.length > 0) {
        lyrSrcNames.forEach(lyrSrcName => {
          // get the original, clean geojson
          if (has(state.refData, lyrSrcName)) {
            let cleanGeojson = cloneDeep(state.refData[lyrSrcName].data)
            // swap it into the version that's in the mapbox style source object
            selectLyrSrcByName(state, lyrSrcName).data = cleanGeojson
          }
        })
      }



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

      if (how === "replace") {
        // put the JSON in the store at path using lodash's set function
        set(state, path, data)
      } else if (how === "append") {
        let existing = get(state, path)
        // console.log(existing, data)
        set(state, path, [...existing, ...data])
      }
    },
    [buildLayerStyle]: (state, action) => {
      // NOTE: Not in use

      let { requestId, contextType, sensor } = action.payload

      let fetchHistoryItem = selectFetchHistoryItemById(state, requestId, contextType)
      let sensors = keys(fetchHistoryItem.results)

      // We calculate rainfall stats used for the style expression from the 
      // composite of all sensor types present, since we want to show gauges 
      // and pixels on the same scale at the same time. Note that this looks
      // at all sensors in the results state available at the time, 
      // so in cases where the request was for both pixels and gauges,
      // the second one will update the style expression using stats calc'd 
      // from both.

      // first put all the results into one array:
      let allResults = []
      sensors.forEach(s => {
        allResults = allResults.concat(fetchHistoryItem.results[s])
      })

      // calculate stats for that array
      let minmax = minmaxTableAttr(allResults, 'total')
      // For building the style expression, we need our
      // min and max to be at least 0 for rainfall. This doesn't 
      // affect the data download, only the the map symbology:
      // minmax.maxValue = minmax.maxValue < 0 ? 0 : minmax.maxValue
      // minmax.minValue = 0

      console.log(minmax)

      // build the style expression
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

      // update state:
      // save the calc'd style and legend to the fetch history item
      set(fetchHistoryItem, ['styleExp', sensor], symbology.styleExp)
      set(fetchHistoryItem, ['heightExp', sensor], symbology.heightExp)
      set(fetchHistoryItem, ['legendContent', sensor], symbology.legendContent)

      fetchHistoryItem.stats = minmax

    },
    /**
     * Set the Mapbox layer's style for a given rainfall data query result.
     * 
     * This works on a single sensor, e.g., a pixel or sensor
     * 
     * NOTE: we do a little but of superficial data cleaning here so that
     * negative values (which are erroneous for purely visual purposes) don't 
     * skew the calculation of the breaks and colors. This doesn't affect the
     * tabular/downloaded data.
     */
    [setLayerStyle]: (state, action) => {

      // expand the payload
      let { requestId, contextType, sensor } = action.payload

      // get the source data used for styling the layer
      let fetchHistoryItem = selectFetchHistoryItemById(state, requestId, contextType)
      let sensorsToStyle = keys(fetchHistoryItem.results)
      let sensorsToUnStyle = keys(SENSOR_TYPES).filter(st => !includes(sensorsToStyle, st))

      // console.log("sensorsToStyle", sensorsToStyle)
      // console.log("sensorsToUnStyle", sensorsToUnStyle)

      // update state:
      // Apply the style exp for the layers we have in the results object.
      // If it's not there, then it gets un-styled.
      sensorsToStyle.forEach(s => {
        // if fetchHistoryItem has style and legend props, we use those to set
        // the style on the layer.
        if (
          has(fetchHistoryItem, ['styleExp', s]) &&
          has(fetchHistoryItem, ['heightExp', s])
          // has(fetchHistoryItem, ['legendContent', s])
        ) {

          let styleExp = fetchHistoryItem.styleExp[s]
          let heightExp = fetchHistoryItem.heightExp[s]

          let lyrIdsToStyle = [`${s}-results`, `${s}-results-3d`]
          // console.log("setting style for", lyrIdsToStyle)
          selectLayersByIds(state, lyrIdsToStyle)
            .forEach(lyr => {
              lyr.paint[`${lyr.type}-color`] = styleExp

              if (lyr.type == "fill-extrusion") {
                lyr.paint[`${lyr.type}-base`] = 0
                lyr.paint[`${lyr.type}-height`] = heightExp
                lyr.paint[`${lyr.type}-opacity`] = 1
              } else {
                lyr.paint[`${lyr.type}-opacity`] = 0.5
              }

            })
          // set the legend property
          // set(state, ['mapLegend', s], fetchHistoryItem.legendContent)
        }
        // if they don't then this is the first time we're putting this on
        // the map, and we need to calculate them.        
        else {
          console.log("style and legend not previously calculated.")
        }
      })


      sensorsToUnStyle.forEach(s => {
        let lyrIdsToNotStyle = [`${s}-results`]
        // console.log("clearing style for", lyrIdsToNotStyle)
        selectLayersByIds(state, lyrIdsToNotStyle)
          .forEach(lyr => {
            lyr.paint[`${lyr.type}-color`] = "#fff"
            lyr.paint[`${lyr.type}-opacity`] = 0
          })
      })


    },
    [applyColorStretch]: (state, action) => {

      let { breaks } = action.payload

      let {colorExp, legendContent} = buildRainfallColorStyleExp('total', breaks)

      LAYERS_W_RESULTS.forEach(lyrId => {
        let lyr = selectLayerById(state, lyrId)
        lyr.paint[`${lyr.type}-color`] = colorExp
      })

      state.mapLegend.content = legendContent

    },


  }
) 