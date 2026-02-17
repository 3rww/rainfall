import axios from 'axios';
import { includes } from 'lodash-es';

import {
  API_POLL_MAX_ATTEMPTS,
  API_POLL_MAX_MS,
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
import { buildRequestKey } from '../utils/requestKey';
import { transformRainfallResults } from '../utils/transformers';

const pollingJobs = new Map();

const getPollingKey = ({ requestId, contextType, sensor }) => (
  `${contextType}:${requestId}:${sensor}`
);

const clearPollingJob = (pollKey) => {
  pollingJobs.delete(pollKey);
};

const abortPollingJob = (pollKey, reason = 'canceled') => {
  const pollingJob = pollingJobs.get(pollKey);
  if (!pollingJob) {
    return;
  }

  pollingJob.controller.abort(reason);
  pollingJobs.delete(pollKey);
};

const dispatchRequestFail = ({ dispatch, requestId, contextType, sensor, status, messages }) => {
  dispatch(requestRainfallDataFail({
    requestId,
    contextType,
    results: { [sensor]: false },
    status,
    messages
  }));
};

const pollRainfallApiV2 = async ({
  dispatch,
  requestId,
  sensor,
  contextType,
  url,
  params,
  pollKey,
  attempt = 1
}) => {
  const pollingJob = pollingJobs.get(pollKey);
  if (!pollingJob) {
    return;
  }

  const elapsedMs = Date.now() - pollingJob.startedAt;
  if (attempt > API_POLL_MAX_ATTEMPTS || elapsedMs > API_POLL_MAX_MS) {
    dispatchRequestFail({
      dispatch,
      requestId,
      contextType,
      sensor,
      status: 'timed_out',
      messages: [`Rainfall request timed out after ${Math.round(elapsedMs / 1000)} seconds.`]
    });
    abortPollingJob(pollKey, 'timed_out');
    return;
  }

  const requestOptions = {
    url,
    method: 'POST',
    signal: pollingJob.controller.signal
  };

  if (params !== false) {
    requestOptions.data = params;
  }

  try {
    const response = await axios(requestOptions);
    let apiResponse = response.data;

    if (includes(['queued', 'started'], apiResponse.status)) {
      const nextUrl = apiResponse?.meta?.jobUrl;
      if (!nextUrl) {
        dispatchRequestFail({
          dispatch,
          requestId,
          contextType,
          sensor,
          status: 'error',
          messages: ['Rainfall request returned queued/started without a follow-up job URL.']
        });
        clearPollingJob(pollKey);
        return;
      }

      setTimeout(() => {
        pollRainfallApiV2({
          dispatch,
          requestId,
          sensor,
          contextType,
          url: nextUrl,
          params: false,
          pollKey,
          attempt: attempt + 1
        });
      }, REQUEST_TIME_INTERVAL);
      return;
    }

    if (includes(['deferred', 'failed'], apiResponse.status)) {
      dispatchRequestFail({
        dispatch,
        requestId,
        contextType,
        sensor,
        status: apiResponse.status,
        messages: apiResponse.messages
      });
      clearPollingJob(pollKey);
      return;
    }

    if (apiResponse.status === 'finished') {
      try {
        if (apiResponse.data === null) {
          dispatchRequestFail({
            dispatch,
            requestId,
            contextType,
            sensor,
            status: 'error',
            messages: apiResponse.messages
          });
          clearPollingJob(pollKey);
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
        dispatchRequestFail({
          dispatch,
          requestId,
          contextType,
          sensor,
          status: 'error',
          messages: apiResponse.messages
        });
      }

      clearPollingJob(pollKey);
      return;
    }

    if (apiResponse.status === 'does not exist') {
      dispatchRequestFail({
        dispatch,
        requestId,
        contextType,
        sensor,
        status: apiResponse.status,
        messages: apiResponse.messages
      });
      clearPollingJob(pollKey);
      return;
    }

    dispatchRequestFail({
      dispatch,
      requestId,
      contextType,
      sensor,
      status: 'error',
      messages: [`Unexpected rainfall status "${apiResponse.status}" returned by API.`]
    });
    clearPollingJob(pollKey);
  } catch (error) {
    const aborted = pollingJob.controller.signal.aborted;

    if (aborted) {
      const abortReason = pollingJob.controller.signal.reason;
      if (abortReason !== 'timed_out') {
        dispatchRequestFail({
          dispatch,
          requestId,
          contextType,
          sensor,
          status: 'canceled',
          messages: ['Rainfall request was canceled.']
        });
      }
      clearPollingJob(pollKey);
      return;
    }

    dispatchRequestFail({
      dispatch,
      requestId,
      contextType,
      sensor,
      status: 'error',
      messages: ['An error occurred when trying to fetch the rainfall data.', `${error}`]
    });
    clearPollingJob(pollKey);
  }
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

  const requestId = buildRequestKey(kwargs);
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
      contextType,
      sensor: sensor[0],
      status: 'pending',
      messages: []
    }));

    const pollKey = getPollingKey({ requestId, contextType, sensor: sensor[0] });
    abortPollingJob(pollKey);
    pollingJobs.set(pollKey, {
      controller: new AbortController(),
      startedAt: Date.now()
    });

    pollRainfallApiV2({
      dispatch,
      requestId,
      sensor: sensor[0],
      contextType,
      url: `${API_URL_ROOT}v2/${sensor[0]}/${rainfallDataTypePath}/`,
      params: requestParams,
      pollKey,
      attempt: 1
    });
  });
};

export const cancelRainfallPolling = ({ requestId, contextType, sensor }) => {
  const pollKey = getPollingKey({ requestId, contextType, sensor });
  abortPollingJob(pollKey, 'canceled');
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
