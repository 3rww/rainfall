import { cloneDeep, get, keys } from 'lodash-es';

import { SENSOR_TYPES } from '../config';
import {
  selectFetchHistory,
  selectFetchHistoryItemById,
  selectFetchKwargs
} from '../selectors';
import {
  pickActiveResultItem,
  removeFetchHistoryItem
} from './fetchKwargsSlice';
import {
  highlightSensor,
  resetLayerSrcs,
  setSourceDataBatch
} from './mapStyleSlice';
import { joinTabletoGeojson } from '../utils/transformers';

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

export const applyActiveResultToMap = ({ contextType, requestId }) => (dispatch, getState) => {
  dispatch(pickActiveResultItem({ contextType, requestId }));

  const state = getState();
  const fetchHistoryItem = selectFetchHistoryItemById(state, requestId, contextType);
  if (!fetchHistoryItem) {
    return;
  }

  const sourceDataByName = buildSourceDataByName(state, fetchHistoryItem.results || {});
  dispatch(setSourceDataBatch({ sourceDataByName }));
};

export const pickDownload = (payload) => {
  const { contextType, ...fetchHistoryItem } = payload;

  return (dispatch) => {
    if (!fetchHistoryItem.isActive) {
      dispatch(applyActiveResultToMap({
        contextType,
        requestId: fetchHistoryItem.requestId
      }));
    }
  };
};

export const deleteDownload = (payload) => {
  const { contextType, requestId } = payload;

  return (dispatch, getState) => {
    const state = getState();
    const fetchHistoryItem = selectFetchHistoryItemById(state, requestId, contextType);

    if (!fetchHistoryItem) {
      return;
    }

    const wasActive = fetchHistoryItem.isActive === true;

    dispatch(removeFetchHistoryItem({ contextType, requestId }));

    if (!wasActive) {
      return;
    }

    const updatedState = getState();
    const updatedHistory = selectFetchHistory(updatedState, contextType);

    if (updatedHistory.length > 0) {
      const newestHistoryItem = updatedHistory[updatedHistory.length - 1];
      dispatch(applyActiveResultToMap({
        requestId: newestHistoryItem.requestId,
        contextType
      }));
      return;
    }

    const sourceDataByName = buildSourceDataByName(updatedState);
    dispatch(resetLayerSrcs({
      lyrSrcNames: keys(SENSOR_TYPES),
      sourceDataByName
    }));

    const activeKwargs = selectFetchKwargs(updatedState, contextType);
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
};
