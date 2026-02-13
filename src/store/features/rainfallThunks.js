import axios from 'axios';
import { MD5 } from 'object-hash';
import { includes } from 'lodash-es';

import {
  API_URL_ROOT,
  REQUEST_TIME_INTERVAL,
  getRainfallDataTypePath,
  shouldIncludeRollupParam
} from '../config';
import {
  selectEvent,
  selectFetchHistoryItemById,
  selectFetchKwargs
} from '../selectors';
import {
  requestRainfallData,
  requestRainfallDataFail,
  requestRainfallDataSuccess,
  pickRainfallDateTimeRange
} from './fetchKwargsSlice';
import { pickRainfallEvent as pickRainfallEventAction } from './rainfallEventsSlice';
import { applyActiveResultToMap } from './downloadThunks';
import { transformRainfallResults } from '../utils/transformers';

const pollRainfallApiV2 = ({ dispatch, requestId, sensor, contextType, url, params }) => {
  const requestOptions = {
    url,
    method: 'POST'
  };

  if (params !== false) {
    requestOptions.data = params;
  }

  axios(requestOptions)
    .then((response) => {
      let apiResponse = response.data;

      if (includes(['queued', 'started'], apiResponse.status)) {
        setTimeout(() => {
          pollRainfallApiV2({
            dispatch,
            requestId,
            sensor,
            contextType,
            url: apiResponse.meta.jobUrl,
            params: false
          });
        }, REQUEST_TIME_INTERVAL);
        return;
      }

      if (includes(['deferred', 'failed'], apiResponse.status)) {
        dispatch(requestRainfallDataFail({
          requestId,
          contextType,
          results: { [sensor]: false },
          status: apiResponse.status,
          messages: apiResponse.messages
        }));
        return;
      }

      if (apiResponse.status === 'finished') {
        try {
          if (apiResponse.data === null) {
            dispatch(requestRainfallDataFail({
              requestId,
              contextType,
              results: { [sensor]: false },
              status: 'error',
              messages: apiResponse.messages
            }));
            return;
          }

          apiResponse = transformRainfallResults(apiResponse, { contextType, sensor });

          dispatch(requestRainfallDataSuccess({
            requestId,
            contextType,
            results: { [sensor]: apiResponse.data },
            processedKwargs: apiResponse.args,
            status: apiResponse.status,
            messages: apiResponse.messages
          }));

          dispatch(applyActiveResultToMap({ requestId, contextType }));
        } catch (error) {
          dispatch(requestRainfallDataFail({
            requestId,
            contextType,
            results: { [sensor]: false },
            status: 'error',
            messages: apiResponse.messages
          }));
        }

        return;
      }

      if (apiResponse.status === 'does not exist') {
        dispatch(requestRainfallDataFail({
          requestId,
          contextType,
          results: { [sensor]: false },
          status: apiResponse.status,
          messages: apiResponse.messages
        }));
      }
    }, (error) => {
      dispatch(requestRainfallDataFail({
        requestId,
        contextType,
        results: { [sensor]: false },
        status: 'error',
        messages: ['An error occurred when trying to fetch the rainfall data.', error]
      }));
    })
    .catch((error) => {
      dispatch(requestRainfallDataFail({
        requestId,
        contextType,
        results: { [sensor]: false },
        status: 'error',
        messages: ['An error occurred when trying to fetch the rainfall data.', error]
      }));
    });
};

export const fetchRainfallDataFromApiV2 = (payload) => (dispatch, getState) => {
  const { contextType, rainfallDataType } = payload;
  const state = getState();
  const kwargs = selectFetchKwargs(state, contextType);

  const rainfallDataTypePath = getRainfallDataTypePath({
    contextType,
    rainfallDataType,
    rollup: kwargs.rollup
  });

  const includeRollupParam = shouldIncludeRollupParam({
    contextType,
    rainfallDataType,
    rollup: kwargs.rollup
  });

  const requestId = MD5(kwargs);
  const matchingRequest = selectFetchHistoryItemById(state, requestId, contextType);

  if (matchingRequest && matchingRequest.isActive === false) {
    dispatch(applyActiveResultToMap({
      requestId: matchingRequest.requestId,
      contextType
    }));
  }

  const requestSensors = ['gauge', 'basin'];

  requestSensors.forEach((sensorType) => {
    const sensor = sensorType === 'basin' ? ['pixel', 'pixels'] : ['gauge', 'gauges'];

    if (kwargs.sensorLocations[sensor[0]].length === 0) {
      return;
    }

    const requestParams = {
      start_dt: kwargs.startDt,
      end_dt: kwargs.endDt,
      f: kwargs.f
    };

    if (includeRollupParam) {
      requestParams.rollup = kwargs.rollup;
    }

    requestParams[sensor[1]] = kwargs.sensorLocations[sensor[0]].map((option) => option.value).join(',');

    dispatch(requestRainfallData({
      fetchKwargs: kwargs,
      requestId,
      contextType
    }));

    pollRainfallApiV2({
      dispatch,
      requestId,
      sensor: sensor[0],
      contextType,
      url: `${API_URL_ROOT}v2/${sensor[0]}/${rainfallDataTypePath}/`,
      params: requestParams
    });
  });
};

export const pickRainfallEvent = ({ eventid, contextType }) => (dispatch, getState) => {
  dispatch(pickRainfallEventAction({ eventid }));

  const rainfallEvent = selectEvent(getState(), eventid);
  if (!rainfallEvent) {
    return;
  }

  dispatch(pickRainfallDateTimeRange({
    contextType,
    startDt: rainfallEvent.startDt,
    endDt: rainfallEvent.endDt
  }));
};
