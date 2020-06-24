import {createAction} from '@reduxjs/toolkit';

// Mapbox map loading -------------------------------------
export const mapLoaded = createAction('MAP_LOADED')
export const setStyle = createAction('SET_STYLE')
export const addLayers = createAction('LOAD_REF_LAYERS')

// JSON data retrieval ------------------------------------
export const requestJson = createAction('GET_JSON')
export const requestJsonSuccess = createAction('GET_JSON_SUCCESS')
export const requestJsonFail = createAction('GET_JSON_FAIL')

// Rainfall data retrieval parameters ---------------------

// get rainfall date/times and metadata for an event
export const pickRainfallEvent = createAction('PICK_EVENT')
export const pickRainfallDateTimeRange = createAction('PICK_DATETIME_RANGE')
// pick a sensor (or param used to select sensors, e.g., basins)
export const pickSensor = createAction('PICK_SENSOR')
// pick the interval
export const pickInterval = createAction('PICK_INTERVAL')

// pick a rainfall data download (set params and set as active on the map)
export const pickDownload = createAction('PICK_DOWNLOAD')

// Rainfall data retrieval --------------------------------

// rainfall data request status, successfully, received, or failed
export const requestRainfallData = createAction('GETTING_RAINFALL')
export const requestRainfallDataInvalid = createAction('GETTING_RAINFALL_INVALID')
export const requestRainfallDataSuccess = createAction('GETTING_RAINFALL_SUCCESS')
export const requestRainfallDataFail = createAction('GETTING_RAINFALL_FAIL')

// filter rainfall events
export const filterEventByHours = createAction('FILTER_EVENT_BY_HOUR')

// Map Animation ------------------------------------------
export const startRainfallAnimation = createAction('START_ANIMATION')
export const stopRainfallAnimation = createAction('STOP_ANIMATION')
export const restartRainfallAnimation = createAction('RESTART_ANIMATION')
// export const fasterRainfallAnimation = createAction('SPEED_UP_ANIMATION')
// export const slowerRainfallAnimation = createAction('SLOW_DOWN_ANIMATION')



