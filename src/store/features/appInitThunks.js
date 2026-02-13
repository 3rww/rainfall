import axios from 'axios';

import {
  BREAKS_050,
  CONTEXT_TYPES,
  ENABLE_SHARE_STATE,
  EVENTS_API_URL,
  GLOBAL_CONFIG_URL,
  MAP_LAYERS,
  RAINFALL_MIN_DATE,
  RAINFALL_TYPES,
  TIMESTAMPS_API_URL,
  URL_GARRD_GEOJSON,
  URL_GAUGE_GEOJSON,
  URL_GEOGRAPHY_LOOKUP
} from '../config';
import { selectFetchKwargs } from '../selectors';
import {
  clampDateTimeRange,
  resolveAvailableBounds
} from '../utils/dateBounds';
import { nowDateTime } from '../utils/dateTime';
import {
  transformDataApiEventsJSON,
  transformRainfallGaugesToMapboxSourceObject,
  transformRainfallPixelsToMapboxSourceObject
} from '../utils/transformers';
import {
  hydrateShareStateToRedux,
  startShareStateSync
} from '../urlShareState';
import { pickRainfallDateTimeRange } from './fetchKwargsSlice';
import { setGlobalConfig } from './globalConfigSlice';
import { addLayers, applyColorStretch, setSourceData } from './mapStyleSlice';
import { setFetching, startThinking, stopThinking } from './progressSlice';
import { setRainfallEvents } from './rainfallEventsSlice';
import { setLookups, setRefLayerData } from './refDataSlice';
import { setLatestTimestamps } from './statsSlice';

const applyPathUpdate = ({ dispatch, data, pathArray, keepACopy }) => {
  const [rootKey, key1, key2] = pathArray || [];

  if (rootKey === 'globalConfig') {
    dispatch(setGlobalConfig(data));
    return;
  }

  if (rootKey === 'rainfallEvents' && key1 === 'list') {
    dispatch(setRainfallEvents(data));
    return;
  }

  if (rootKey === 'stats' && key1 === 'latest') {
    dispatch(setLatestTimestamps(data));
    return;
  }

  if (rootKey === 'refData' && key1 === 'lookups') {
    dispatch(setLookups(data));
    return;
  }

  if (rootKey === 'mapStyle' && key1 === 'sources' && key2) {
    dispatch(setSourceData({ sourceName: key2, data }));
    if (keepACopy === true) {
      dispatch(setRefLayerData({ sourceName: key2, data }));
    }
    return;
  }

  console.warn('[appInitThunks] unsupported fetch path:', pathArray);
};

export const fetchJSON = (payload) => async (dispatch) => {
  const { url, pathArray, transformer, keepACopy } = payload;

  dispatch(startThinking(`getting data from "${url}"`));

  try {
    const response = await axios({
      url,
      method: 'GET'
    });

    const data = transformer ? transformer(response.data) : response.data;
    applyPathUpdate({ dispatch, data, pathArray, keepACopy });
    return true;
  } catch (error) {
    console.log('An error occurred.', error);
    return false;
  } finally {
    dispatch(stopThinking(`data from "${url}" loaded to ${pathArray.join('.')}`));
  }
};

const fetchReferenceDatasets = (dispatch) => Promise.all([
  dispatch(fetchJSON({
    url: GLOBAL_CONFIG_URL,
    pathArray: ['globalConfig'],
    transformer: false,
    keepACopy: false
  })),
  dispatch(fetchJSON({
    url: EVENTS_API_URL,
    pathArray: ['rainfallEvents', 'list'],
    transformer: transformDataApiEventsJSON,
    keepACopy: false
  })),
  dispatch(fetchJSON({
    url: TIMESTAMPS_API_URL,
    pathArray: ['stats', 'latest'],
    transformer: false,
    keepACopy: false
  })),
  dispatch(fetchJSON({
    url: URL_GEOGRAPHY_LOOKUP,
    pathArray: ['refData', 'lookups'],
    transformer: false,
    keepACopy: false
  })),
  dispatch(fetchJSON({
    url: URL_GAUGE_GEOJSON,
    pathArray: ['mapStyle', 'sources', 'gauge'],
    transformer: transformRainfallGaugesToMapboxSourceObject,
    keepACopy: true
  })),
  dispatch(fetchJSON({
    url: URL_GARRD_GEOJSON,
    pathArray: ['mapStyle', 'sources', 'pixel'],
    transformer: transformRainfallPixelsToMapboxSourceObject,
    keepACopy: true
  }))
]);

const applyDefaultDateRanges = ({ dispatch, getState }) => {
  const state = getState();
  const latest = state?.stats?.latest || {};
  const now = nowDateTime().toISOString();

  const dispatchDefaultRange = ({ contextType, rainfallDataType, lookbackAmount, lookbackUnit }) => {
    const activeKwargs = selectFetchKwargs(state, contextType);
    const bounds = resolveAvailableBounds({
      contextType,
      rainfallDataType,
      rollup: activeKwargs.rollup,
      latest,
      rainfallMinDate: RAINFALL_MIN_DATE,
      now
    });

    const clamped = clampDateTimeRange({
      start: bounds.max.clone().subtract(lookbackAmount, lookbackUnit),
      end: bounds.max,
      min: bounds.min,
      max: bounds.max
    });

    dispatch(pickRainfallDateTimeRange({
      contextType,
      startDt: clamped.start.toISOString(),
      endDt: clamped.end.toISOString()
    }));
  };

  dispatchDefaultRange({
    contextType: CONTEXT_TYPES.legacyRealtime,
    rainfallDataType: RAINFALL_TYPES.realtime,
    lookbackAmount: 2,
    lookbackUnit: 'hour'
  });

  dispatchDefaultRange({
    contextType: CONTEXT_TYPES.legacyGauge,
    rainfallDataType: RAINFALL_TYPES.historic,
    lookbackAmount: 1,
    lookbackUnit: 'month'
  });

  dispatchDefaultRange({
    contextType: CONTEXT_TYPES.legacyGarr,
    rainfallDataType: RAINFALL_TYPES.historic,
    lookbackAmount: 1,
    lookbackUnit: 'month'
  });
};

export const initDataFetch = (payload = {}) => async (dispatch, getState) => {
  dispatch(startThinking('Loading reference data and map layers'));
  dispatch(setFetching(true));

  try {
    await fetchReferenceDatasets(dispatch);

    dispatch(addLayers(MAP_LAYERS));
    dispatch(applyColorStretch({ breaks: BREAKS_050 }));

    applyDefaultDateRanges({ dispatch, getState });

    if (ENABLE_SHARE_STATE) {
      await hydrateShareStateToRedux({ dispatch, getState });

      const subscribe = payload?.subscribe;
      if (typeof subscribe === 'function') {
        startShareStateSync({ subscribe, getState });
      }
    }
  } finally {
    dispatch(setFetching(false));
    dispatch(stopThinking('Initial data load complete.'));
  }
};
