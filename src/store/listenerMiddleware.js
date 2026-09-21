import { createListenerMiddleware, createSelector } from '@reduxjs/toolkit';
import { get, keys } from 'lodash-es';

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

const EMPTY_RESULTS = {};
const buildSourceDataByName = createSelector(
  [state => state.refData, (_state, results = EMPTY_RESULTS) => results],
  (refData, resultsBySensor) => {
  const sourceDataByName = {};

  keys(SENSOR_TYPES).forEach((sensorType) => {
    const referenceGeojson = get(refData, [sensorType, 'data']);
    if (!referenceGeojson) {
      return;
    }

    if (resultsBySensor && resultsBySensor[sensorType]) {
      sourceDataByName[sensorType] = joinTabletoGeojson(
        referenceGeojson,
        resultsBySensor[sensorType].map(({ id, total, recordCount, validCount, missingCount }) => ({ id, total, ...(recordCount !== undefined ? { recordCount, validCount, missingCount } : {}) })),
        'properties.id',
        'id',
        false
      );
      return;
    }

    sourceDataByName[sensorType] = referenceGeojson;
  });

  return sourceDataByName;
});

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

export function createRainfallListeners(extra) {
const listenerMiddleware = createListenerMiddleware({ extra });

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
      listenerApi.dispatch(cancelRainfallPolling({ requestId, contextType, sensor }));
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

return listenerMiddleware;
}
export default createRainfallListeners();
