import { keys } from 'lodash-es';

import { SENSOR_TYPES } from '../config';
import { selectFetchHistory, selectFetchKwargs } from '../selectors';
import { switchTab } from './progressSlice';
import { highlightSensor, resetLayerSrcs } from './mapStyleSlice';
import { applyActiveResultToMap } from './downloadThunks';

const buildCleanSourceDataByName = (state) => {
  const sourceDataByName = {};

  keys(SENSOR_TYPES).forEach((sensorType) => {
    const referenceGeojson = state.refData?.[sensorType]?.data;
    if (!referenceGeojson) {
      return;
    }

    sourceDataByName[sensorType] = referenceGeojson;
  });

  return sourceDataByName;
};

export const switchContext = (contextType) => (dispatch, getState) => {
  dispatch(switchTab(contextType));

  const state = getState();
  const activeHistoryItem = selectFetchHistory(state, contextType).find((item) => item.isActive === true);

  if (!activeHistoryItem) {
    dispatch(resetLayerSrcs({
      lyrSrcNames: keys(SENSOR_TYPES),
      sourceDataByName: buildCleanSourceDataByName(state)
    }));

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
    return;
  }

  dispatch(applyActiveResultToMap({
    requestId: activeHistoryItem.requestId,
    contextType
  }));
};
