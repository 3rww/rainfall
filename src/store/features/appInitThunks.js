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
import {
  appendRainfallEventsPage,
  completeRainfallEventsLoad,
  failRainfallEventsLoad,
  setRainfallEvents,
  startRainfallEventsLoad
} from './rainfallEventsSlice';
import { setLookups, setRefLayerData } from './refDataSlice';
import { setLatestTimestamps } from './statsSlice';

const MAX_EVENT_PAGE_REQUESTS = 250;

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

const normalizeEventsPagePayload = (payload) => {
  if (Array.isArray(payload)) {
    return {
      count: payload.length,
      next: null,
      results: payload
    };
  }

  return {
    count: Number.isFinite(payload?.count) ? Number(payload.count) : null,
    next: payload?.next || null,
    results: Array.isArray(payload?.results) ? payload.results : []
  };
};

export const fetchRainfallEventsPaginated = () => async (dispatch) => {
  dispatch(startRainfallEventsLoad());

  const visitedUrls = new Set();
  let nextUrl = EVENTS_API_URL;
  let pagesFetched = 0;

  while (nextUrl) {
    if (pagesFetched >= MAX_EVENT_PAGE_REQUESTS) {
      dispatch(failRainfallEventsLoad({
        error: `Rainfall events exceeded ${MAX_EVENT_PAGE_REQUESTS} pages; stopping load.`,
        nextPageUrl: nextUrl
      }));
      return false;
    }

    if (visitedUrls.has(nextUrl)) {
      dispatch(failRainfallEventsLoad({
        error: `Rainfall events pagination loop detected at "${nextUrl}".`,
        nextPageUrl: nextUrl
      }));
      return false;
    }

    visitedUrls.add(nextUrl);

    try {
      const response = await axios({
        url: nextUrl,
        method: 'GET'
      });

      const pagePayload = normalizeEventsPagePayload(response.data);
      const pageEvents = transformDataApiEventsJSON(pagePayload.results);
      dispatch(appendRainfallEventsPage({
        events: pageEvents,
        totalCount: pagePayload.count,
        nextPageUrl: pagePayload.next
      }));

      nextUrl = pagePayload.next;
      pagesFetched += 1;
    } catch (error) {
      dispatch(failRainfallEventsLoad({
        error: error?.message || 'An error occurred while loading rainfall events.',
        nextPageUrl: nextUrl
      }));
      return false;
    }
  }

  dispatch(completeRainfallEventsLoad());
  return true;
};

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
  let shouldLoadRainfallEvents = false;

  try {
    await fetchReferenceDatasets(dispatch);
    shouldLoadRainfallEvents = true;

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
    if (shouldLoadRainfallEvents) {
      dispatch(fetchRainfallEventsPaginated());
    }
  }
};
