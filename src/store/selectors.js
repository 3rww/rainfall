import { has, isEmpty, keys, forEach, includes, startsWith, get } from 'lodash-es'
import { createSelector } from '@reduxjs/toolkit'

import { LYR_HIGHLIGHT_PREFIX } from './config'

const EMPTY_ARRAY = []
const EMPTY_OBJECT = {}

// ----------------------------------------------
// selecting UI State

export const selectContext = (state) => state.progress.tab

// ----------------------------------------------
// selecting rainfall data request parameters and history

export const selectFetchKwargs = (state, contextType) => (
  state.fetchKwargs[contextType].active
)

export const selectActiveFetchKwargs = (state) => (
  state.fetchKwargs[selectContext(state)].active
)

const selectSensorLocationsForContext = (state, contextType) => (
  state.fetchKwargs?.[contextType]?.active?.sensorLocations || EMPTY_OBJECT
)

export const makeSelectSelectedSensors = () => createSelector(
  [selectSensorLocationsForContext],
  (sensorLocations) => {
    let selectedSensors = null
    forEach(sensorLocations, (sensors, sensorType) => {
      if (Array.isArray(sensors) && sensors.length > 0) {
        if (selectedSensors === null) {
          selectedSensors = {}
        }
        selectedSensors[sensorType] = sensors
      }
    })
    return selectedSensors || EMPTY_OBJECT
  }
)

const sharedSelectedSensorsSelector = makeSelectSelectedSensors()

export const selectSelectedSensors = (state, contextType) => (
  sharedSelectedSensorsSelector(state, contextType)
)

export const selectFetchHistory = (state, contextType) => {
  return state.fetchKwargs[contextType].history
}

export const selectFetchHistoryItemLifecycle = (state, requestId, contextType) => {
  const item = selectFetchHistoryItemById(state, requestId, contextType)
  if (!item) {
    return 'idle'
  }
  return item.lifecycle || 'idle'
}

export const selectFetchHistoryLifecycleSummary = createSelector(
  [(state) => state.fetchKwargs],
  (fetchKwargs) => {
    const summary = {
      idle: 0,
      pending: 0,
      partial: 0,
      succeeded: 0,
      failed: 0,
      timed_out: 0,
      canceled: 0
    }

    forEach(fetchKwargs, (contextData) => {
      ;(contextData?.history || []).forEach((item) => {
        const lifecycle = item?.lifecycle || 'idle'
        if (Object.prototype.hasOwnProperty.call(summary, lifecycle)) {
          summary[lifecycle] += 1
        } else {
          summary.idle += 1
        }
      })
    })

    return summary
  }
)

export const selectActiveFetchHistory = (state) => (
  state.fetchKwargs[selectContext(state)].history
)

export const selectActiveFetchHistoryItem = (state) => (
  selectActiveFetchHistory(state).find(i => i.isActive === true)
)

export const selectFetchHistoryItemById = (state, requestId, contextType) => {
  // console.log(requestId, contextType)
  let r = selectFetchHistory(state, contextType).find(f => f.requestId == requestId)
  // console.log(r)
  return r
}

export const selectFetchHistoryItemsById = (state, requestId, contextType) => (
  selectFetchHistory(state, contextType)
    .filter(f => f.requestId == requestId)
)

export const selectFetchHistoryItemsByIdInverse = (state, requestId, contextType) => (
  selectFetchHistory(state, contextType)
    .filter(f => f.requestId !== requestId)
)

export const selectAnyFetchHistoryItemById = (state, requestId) => {
  let i;
  forEach(state.fetchKwargs, (contextData, contextType) => {
    let found = contextData.history.find(f => f.requestId == requestId)
    if (found !== undefined) { i = found }
  })
  return i
}

export const selectAnyFetchHistoryItemsById = (state, requestId) => {
  let i = [];
  forEach(state.fetchKwargs, (contextData, contextType) => {
    i = i.concat(contextData.history.filter(f => f.requestId == requestId))
  })
  return i
}

export const selectAnyFetchHistoryItemsByIdInverse = (state, requestId) => {
  let i = [];
  forEach(state.fetchKwargs, (contextData, contextType) => {
    i = i.concat(contextData.history.filter(f => f.requestId !== requestId))
  })
  return i
}

// select all/any active fetch history items across contexts
export const selectAnyActiveFetchHistoryItems = (state) => {
  let i = [];
  forEach(state.fetchKwargs, (contextData, contextType) => {
    i = i.concat(contextData.history.filter(f => f.isActive == true))
  })
  return i
}

export const selectPickedSensors = (state, contextType, sensorLocationType) => {
  let v = state.fetchKwargs[contextType].active.sensorLocations[sensorLocationType]
  if (v === undefined) {
    return EMPTY_ARRAY
  }
  return v
}

export const selectAnyActiveFetches = (state) => {
  let i = [];
  forEach(state.fetchKwargs, (contextData, contextType) => {
    i = i.concat(contextData.history.filter(f => f.isFetching))
  })
  return i
}

// ----------------------------------------------
// selecting from the Mapbox style sheet object 
// and supporting geodata

/** -------------------------------------------------------
 * selections for the Mapbox style-spec state object
 */

 export const selectLyrSrcs = (state) => state.mapStyle.sources

 export const selectLyrSrcByName = (state, name) => selectLyrSrcs(state)[name]

// the mapStyle object in the store provides layer state for the map
export const selectLayers = (state) => state.mapStyle.layers

// select a map layer by its ID
export const selectLayerById = (state, layerId) => {
  return selectLayers(state).find(lyr => lyr.id === layerId)
}

// select multiple map layers by multiple IDs
export const selectLayersByIds = (state, layerIds) => {
  // let allLayers = selectLayers(state)
  // console.log(allLayers)
  return selectLayers(state).filter(lyr => includes(layerIds, lyr.id))
}

// select a map layers using an ID
export const selectLayersByStartsWithId = (state, layerId) => {
  const mapLayers = selectLayers(state)
  const matchingLayers = []
  mapLayers.forEach(lyr => {
    if (startsWith(lyr.id, layerId)) {
      matchingLayers.push(lyr)
    }
  })
  return matchingLayers
}

// get all map layers currently added to the map's style
// that are prefixed with "HIGHLIGHT-"
export const selectAllHighlightLayers = (state) => {
  return selectLayers(state).filter((lyr) => startsWith(lyr.id, LYR_HIGHLIGHT_PREFIX))
}

export const selectMapStyleSourceDataFeatures = (state, name) => {
  if (has(state.mapStyle, ['sources', name, 'data', 'features'])) {
    return state.mapStyle.sources[name].data.features
  }
  return EMPTY_ARRAY
}

export const selectMapStyleSourceDataIDs = (state, name) => {
  let srcData = selectMapStyleSourceDataFeatures(state, name)
  if (!isEmpty(srcData)) {
    return srcData.map(f => f.id)
  }
  return EMPTY_ARRAY
}

// export const selectPixelLookupsBasinsOnly = (state) => {
//   if (has(state, ['refData', 'lookups', 'pixel', 'basin'])) {
//     let basins = state.refData.basinPixelLookup
//     return keys(basins)
//       .filter(k => k !== "other")
//       .map(k => ({ value: k, pixels: basins[k] }))
//   } else {
//     return []
//   }
// }

export const selectSensorGeographyLookup = (state, lookupPath) => {
  return get(state.refData.lookups, lookupPath, EMPTY_OBJECT)
}

const selectGeographyLookups = (state) => get(state, 'refData.lookups', EMPTY_OBJECT)

export const selectGeographyLookupsAsGroupedOptions = createSelector(
  [selectGeographyLookups],
  (geographyTypes) => keys(geographyTypes)
    .map(gt => ({
      label: gt,
      options: keys(geographyTypes[gt]).map(g => ({
        value: `${gt}.${g}`,
        label: g
      }))
    }))
)

// ----------------------------------------------
// selecting rainfall events data

export const selectRainfallEvents = (state) => state.rainfallEvents

export const selectFilteredRainfallEvents = createSelector(
  [selectRainfallEvents],
  (rainfallEvents) => {
    const maxHours = Number(rainfallEvents?.filters?.maxHours ?? 24)
    return (rainfallEvents?.list || []).filter((event) => (
      maxHours >= 24 ? true : event.hours <= maxHours
    ))
  }
)

export const selectEvent = (state, eventid) => (
  selectRainfallEvents(state).list.find((e) => e.eventid === eventid)
)

export const selectEventInverse = (state, eventid) => (
  selectRainfallEvents(state).list.filter((e) => e.eventid !== eventid)
)

export const selectSelectedEvent = (state) => (
  selectRainfallEvents(state).list.find(e => e.selected)
)

export const eventIsSelected = (state) => {
  const s = selectSelectedEvent(state)
  if (s === undefined) { return false }
  if (
    (s.startDt !== null && s.startDt !== undefined)
    &&
    (s.endDt !== null && s.endDt !== undefined)
  ) {
    return true
  }
  return false
}

export const selectEventStats = (state) => state.rainfallEvents.stats

export const selectLatestTimestamps = (state) => state.stats.latest

export const selectLatestlegacyRealtimeGaugeTS = (state) => selectLatestTimestamps(state)['realtime-gauge']

export const selectLatestlegacyRealtimeRadarTS = (state) => selectLatestTimestamps(state)['realtime-radar']

export const selectLatestlegacyGaugeTS = (state) => selectLatestTimestamps(state)['calibrated-gauge']

export const selectLatestlegacyGarrTS = (state) => selectLatestTimestamps(state)['calibrated-radar']

export const selectEarliestlegacyGauge5MinTS = (state) => (
  selectLatestTimestamps(state)['earliest-5min-calibrated-gauge']
)

export const selectLatestlegacyGauge5MinTS = (state) => (
  selectLatestTimestamps(state)['latest-5min-calibrated-gauge']
)

export const selectEarliestlegacyGarr5MinTS = (state) => (
  selectLatestTimestamps(state)['earliest-5min-calibrated-radar']
)

export const selectLatestlegacyGarr5MinTS = (state) => (
  selectLatestTimestamps(state)['latest-5min-calibrated-radar']
)
