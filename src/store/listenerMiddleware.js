import { createListenerMiddleware } from '@reduxjs/toolkit';
import { cloneDeep, get, keys } from 'lodash-es';

import { SENSOR_TYPES } from './config';
import {
  selectFetchHistory,
  selectFetchHistoryItemById,
  selectFetchKwargs
} from './selectors';
import { switchTab } from './features/progressSlice';
import {
  pickActiveResultItem,
  removeFetchHistoryItem
} from './features/fetchKwargsSlice';
import {
  highlightSensor,
  resetLayerSrcs,
  setSourceDataBatch
} from './features/mapStyleSlice';
import { joinTabletoGeojson } from './utils/transformers';
import { cancelRainfallPolling } from './features/rainfallThunks';

const buildSourceDataByName = (state, resultsBySensor = {}) => {
  const sourceDataByName = {};

  keys(SENSOR_TYPES).forEach((sensorType) => {
    const referenceGeojson = cloneDeep(get(state, ['refData', sensorType, 'data']));
    if (!referenceGeojson) {
      return;
    }

    if (resultsBySensor && resultsBySensor[sensorType]) {
      sourceDataByName[sensorType] = joinTabletoGeojson(
        cloneDeep(referenceGeojson),
        resultsBySensor[sensorType],
        'properties.id',
        'id',
        false
      );
      return;
    }

    sourceDataByName[sensorType] = referenceGeojson;
  });

  return sourceDataByName;
};

const reapplySelectedHighlights = ({ dispatch, state, contextType }) => {
  const activeKwargs = selectFetchKwargs(state, contextType);
  keys(SENSOR_TYPES).forEach((sensorLocationType) => {
    const selectedOptions = activeKwargs?.sensorLocations?.[sensorLocationType] || [];
    if (selectedOptions.length > 0) {
      dispatch(highlightSensor({
        contextType,
        sensorLocationType,
        selectedOptions
      }));
    }
  });
};

const listenerMiddleware = createListenerMiddleware();

listenerMiddleware.startListening({
  actionCreator: switchTab,
  effect: async (action, listenerApi) => {
    const contextType = action.payload;
    const state = listenerApi.getState();

    const activeHistoryItem = selectFetchHistory(state, contextType)
      .find((item) => item.isActive === true);

    if (!activeHistoryItem) {
      listenerApi.dispatch(resetLayerSrcs({
        lyrSrcNames: keys(SENSOR_TYPES),
        sourceDataByName: buildSourceDataByName(state)
      }));

      reapplySelectedHighlights({
        dispatch: listenerApi.dispatch,
        state,
        contextType
      });
      return;
    }

    listenerApi.dispatch(pickActiveResultItem({
      contextType,
      requestId: activeHistoryItem.requestId
    }));
  }
});

listenerMiddleware.startListening({
  actionCreator: pickActiveResultItem,
  effect: async (action, listenerApi) => {
    const { contextType, requestId } = action.payload;
    const state = listenerApi.getState();
    const fetchHistoryItem = selectFetchHistoryItemById(state, requestId, contextType);

    if (!fetchHistoryItem) {
      return;
    }

    const sourceDataByName = buildSourceDataByName(state, fetchHistoryItem.results || {});
    listenerApi.dispatch(setSourceDataBatch({ sourceDataByName }));
  }
});

listenerMiddleware.startListening({
  actionCreator: removeFetchHistoryItem,
  effect: async (action, listenerApi) => {
    const { contextType, requestId } = action.payload;

    const originalState = listenerApi.getOriginalState();
    const removedItem = selectFetchHistoryItemById(originalState, requestId, contextType);

    if (!removedItem) {
      return;
    }

    const sensorsToCancel = new Set([
      ...Object.keys(removedItem.results || {}),
      ...(removedItem.pendingSensors || []),
      ...(removedItem.completedSensors || []),
      ...(removedItem.failedSensors || [])
    ]);

    sensorsToCancel.forEach((sensor) => {
      cancelRainfallPolling({ requestId, contextType, sensor });
    });

    if (removedItem.isActive !== true) {
      return;
    }

    const state = listenerApi.getState();
    const updatedHistory = selectFetchHistory(state, contextType);

    if (updatedHistory.length > 0) {
      const newestHistoryItem = updatedHistory[updatedHistory.length - 1];
      listenerApi.dispatch(pickActiveResultItem({
        requestId: newestHistoryItem.requestId,
        contextType
      }));
      return;
    }

    listenerApi.dispatch(resetLayerSrcs({
      lyrSrcNames: keys(SENSOR_TYPES),
      sourceDataByName: buildSourceDataByName(state)
    }));

    reapplySelectedHighlights({
      dispatch: listenerApi.dispatch,
      state,
      contextType
    });
  }
});

export default listenerMiddleware;
