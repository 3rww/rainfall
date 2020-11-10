import { has, isEmpty, keys, forEach, includes, startsWith } from 'lodash-es'

import { LYR_HIGHLIGHT_PREFIX } from './config'

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

export const selectSelectedSensors = (state, contextType) => {
  let selectedSensors = {}
  forEach(
    selectFetchKwargs(state, contextType).sensorLocations, 
    (sensors, sensorType) => {
      if (sensors.length > 0) {
        selectedSensors[sensorType] = sensors
      }
    }
  )
  return selectedSensors
}

export const selectFetchHistory = (state, contextType) => {
  return state.fetchKwargs[contextType].history
}

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

export const selectPickedSensors = (state, contextType, sensorLocationType) => {
  return state.fetchKwargs[contextType].active.sensorLocations[sensorLocationType]
}

export const selectAnyActiveFetches = (state) => {
  let i;
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
  return []
}

export const selectMapStyleSourceDataIDs = (state, name) => {
  let srcData = selectMapStyleSourceDataFeatures(state, name)
  if (!isEmpty(srcData)) {
    return srcData.features.map(f => f.id)
  }
  return []
}

export const selectPixelLookupsBasinsOnly = (state) => {
  if (has(state, ['refData', 'basinPixelLookup'])) {
    let basins = state.refData.basinPixelLookup
    return keys(basins)
      .filter(k => k !== "other")
      .map(k => ({ value: k, pixels: basins[k] }))
  } else {
    return []
  }
}

// export const selectPixelsForBasin = (state, basin) => {
//   if (has(state, ['refData', 'basinPixelLookup'])) {
//     return state.refData.basinPixelLookup[basin]
//   } else {
//     return []
//   }
// }

// ----------------------------------------------
// selecting rainfall events data

export const selectRainfallEvents = (state) => state.rainfallEvents

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


