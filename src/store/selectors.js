import { has, isEmpty, keys, forEach } from 'lodash-es'

export const selectEvent = (state, eventid) => (
  state.rainfallEvents.list.find((e) => e.eventid === eventid)
)

export const selectEventInverse = (state, eventid) => (
  state.rainfallEvents.list.filter((e) => e.eventid !== eventid)
)

export const selectFetchKwargs = (state, rainfallDataType) => state.fetchKwargs[rainfallDataType]

export const selectFetchHistory = (state, rainfallDataType) => state.fetchHistory[rainfallDataType]

export const selectFetchHistoryItemById = (state, requestId) => {
  let i;
  forEach(state.fetchHistory, (historyList, rainfallDataType) => {
    let f = historyList.find(f => f.requestId == requestId)
    if (f !== undefined) { i = f }
  })
  return i
}

export const selectFetchHistoryItemsById = (state, requestId) => {
  let i = [];
  forEach(state.fetchHistory, (historyList) => {
    i = i.concat(historyList.filter(f => f.requestId == requestId))
  })
  return i
}

export const selectFetchHistoryItemsByIdInverse = (state, requestId) => {
  let i = [];
  forEach(state.fetchHistory, (historyList) => {
    i = i.concat(historyList.filter(f => f.requestId !== requestId))
  })
  return i
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

export const selectRainfallEvents = (state) => state.rainfallEvents

export const selectSelectedEvent = (state) => selectRainfallEvents(state).list.find(e => e.selected)

export const selectFetchKwargsKeys = (state) => {
  return [...keys(state.fetchKwargs).map(k => k)]
}

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

// export const selectPixelsForBasin = (state, basin) => {
//   if (has(state, ['refData', 'basinPixelLookup'])) {
//     return state.refData.basinPixelLookup[basin]
//   } else {
//     return []
//   }
// }

export const selectPickedSensors = (state, rainfallDataType, sensorLocationType) => {
  return state.fetchKwargs[rainfallDataType].sensorLocations[sensorLocationType]
}

export const selectActiveFetches = (state) => {
  return state.fetchHistory.filter(fh => fh.isFetching)
}

export const selectContext = (state) => {
  return state.progress.tab
}