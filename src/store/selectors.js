import { has, isEmpty, keys } from 'lodash-es'

export const selectEvent = (state, eventid) => (
  state.rainfallEvents.list.find((e) => e.eventid === eventid)
)

export const selectEventInverse = (state, eventid) => (
  state.rainfallEvents.list.filter((e) => e.eventid !== eventid)
)

export const selectFetchKwargs = (state) => state.fetchKwargs

export const selectFetchById = (state, requestId) => (
  state.fetchHistory.find(f => f.requestId == requestId)
)

export const selectFetchesById = (state, requestId) => (
  state.fetchHistory.filter(f => f.requestId == requestId)
)

export const selectFetchesByIdInverse = (state, requestId) => (
  state.fetchHistory.filter(f => f.requestId !== requestId)
)

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
      .map(k => ({value: k, pixels: basins[k]}))
  } else {
    return []
  }
}

export const selectSelectedEvent = (state) => state.fetchKwargs.selectedEvent

export const selectRainfallEvents = (state) => state.rainfallEvents

export const selectFetchKwargsKeys = (state) => {
  return [...keys(state.fetchKwargs).map(k => k)]
}

export const selectEventStats = (state) => state.rainfallEvents.stats

// export const selectPixelsForBasin = (state, basin) => {
//   if (has(state, ['refData', 'basinPixelLookup'])) {
//     return state.refData.basinPixelLookup[basin]
//   } else {
//     return []
//   }
// }

export const selectPickedSensors = (state, sensorLocationType) => {
  return state.fetchKwargs.sensorLocations[sensorLocationType]
  // let d = state.fetchKwargs.sensorLocations[sensorLocationType]
  // if (sensorLocationType == 'basin') {
  //   if (d.length > 0) {
  //     return d[0]
  //   } else { return null}
  // } else {
  //   return d
  // }
}

export const selectActiveFetches = (state) => {
  return state.fetchHistory.filter(fh => fh.isFetching)
}