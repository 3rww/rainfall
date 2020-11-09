import {createAction} from '@reduxjs/toolkit';
import { create } from 'lodash-es';

// --------------------------------------------------------
// Map State
export const mapLoaded = createAction('MAP_LOADED')
export const setStyle = createAction('SET_STYLE')
export const addLayers = createAction('LOAD_REF_LAYERS')
export const setLayerStyle = createAction('SET_LAYER_STYLE')

// --------------------------------------------------------
// Context
export const switchTab = createAction('SWITCH_TAB')

// --------------------------------------------------------
// Feedback
export const asyncAction = createAction('ASYNC_START')
export const asyncActionSuccess = createAction('ASYNC_SUCCESS')
export const asyncActionFail = createAction('ASYNC_FAIL')

export const isFetching = createAction('FETCHING')
export const startThinking = createAction('THINKING_1')
export const stopThinking = createAction('THINKING_0')

// --------------------------------------------------------
// Rainfall data retrieval parameters 

export const calcEventStats = createAction('CALC_EVENT_STATS')
// get rainfall date/times and metadata for an event
export const pickRainfallEvent = createAction('PICK_EVENT')
// pick date/time range for rainfall
export const pickRainfallDateTimeRange = createAction('PICK_DATETIME_RANGE')
// pick a sensor (or param used to select sensors, e.g., basins)
export const pickSensor = createAction('PICK_SENSOR')
// pick the interval
export const pickInterval = createAction('PICK_INTERVAL')
// set the active result (used for displaying results on the map)
export const setActiveResultItem = createAction('PICK_ACTIVE_RESULT')

// --------------------------------------------------------
// Rainfall data retrieval 

// rainfall data request status, successfully, received, or failed
export const requestRainfallData = createAction('GETTING_RAINFALL')
export const requestRainfallDataInvalid = createAction('GETTING_RAINFALL_INVALID')
export const requestRainfallDataSuccess = createAction('GETTING_RAINFALL_SUCCESS')
export const requestRainfallDataFail = createAction('GETTING_RAINFALL_FAIL')

// filter rainfall events
export const filterEventByHours = createAction('FILTER_EVENT_BY_HOUR')

// --------------------------------------------------------
// Map Animation 
export const startRainfallAnimation = createAction('START_ANIMATION')
export const stopRainfallAnimation = createAction('STOP_ANIMATION')
export const restartRainfallAnimation = createAction('RESTART_ANIMATION')
// export const fasterRainfallAnimation = createAction('SPEED_UP_ANIMATION')
// export const slowerRainfallAnimation = createAction('SLOW_DOWN_ANIMATION')


// --------------------------------------------------------
// misc
export const setState = createAction('SET_STATE')