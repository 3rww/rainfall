import playback from './features/playbackSlice';
import resultsPresentation from './features/resultsPresentationSlice';
import { combineReducers } from '@reduxjs/toolkit';

import progressReducer from './features/progressSlice';
import mapStyleReducer from './features/mapStyleSlice';
import fetchKwargsReducer from './features/fetchKwargsSlice';
import rainfallEventsReducer from './features/rainfallEventsSlice';
import globalConfigReducer from './features/globalConfigSlice';
import statsReducer from './features/statsSlice';
import refDataReducer from './features/refDataSlice';
import initMapReducer from './features/initMapSlice';
import mapLegendReducer from './features/mapLegendSlice';

export const rootReducer = combineReducers({
  resultsPresentation,
  playback,
  progress: progressReducer,
  globalConfig: globalConfigReducer,
  fetchKwargs: fetchKwargsReducer,
  rainfallEvents: rainfallEventsReducer,
  stats: statsReducer,
  refData: refDataReducer,
  initMap: initMapReducer,
  mapStyle: mapStyleReducer,
  mapLegend: mapLegendReducer
});
