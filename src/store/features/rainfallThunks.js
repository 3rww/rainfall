import axios from 'axios';
import { includes } from 'lodash-es';

import {
  API_POLL_MAX_ATTEMPTS,
  API_POLL_MAX_MS,
  API_URL_ROOT,
  REQUEST_TIME_INTERVAL,
  RAINFALL_MIN_DATE,
  getRainfallDataTypePath
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
import { resolveAvailableBounds, clampDateTimeRange } from '../utils/dateBounds';
import { buildRequestKey } from '../utils/requestKey';
import { nanoid } from '@reduxjs/toolkit';

const getPollingKey = ({ requestId, contextType, sensor }) => JSON.stringify([contextType, requestId, sensor]);
const abortPollingJob = (jobs, key, reason = 'canceled') => {
  const job = jobs?.get(key);
  if (!job) return;
  job.controller.abort(reason); clearTimeout(job.timer); jobs.delete(key);
};
const pollRainfallApiV2 = async ({ dispatch, getState, extra, requestId, sensor, contextType, url, params, pollKey, job, attempt = 1 }) => {
  const jobs = extra.pollingJobs;
  const current = () => jobs.get(pollKey) === job && Boolean(selectFetchHistoryItemById(getState(), requestId, contextType));
  if (!current()) return;
  const fail = (status, messages) => {
    if (current()) dispatch(requestRainfallDataFail({ requestId, contextType, results: { [sensor]: false }, status, messages }));
  };
  try {
    if (attempt > API_POLL_MAX_ATTEMPTS || Date.now() - job.startedAt > API_POLL_MAX_MS) {
      fail('timed_out', ['Rainfall request timed out.']); abortPollingJob(jobs, pollKey, 'timed_out'); return;
    }
    const response = await axios({ url, method: 'POST', signal: job.controller.signal, responseType: 'arraybuffer', ...(params !== false ? { data: params } : {}) });
    if (!current()) return;
    let apiResponse = await extra.results.run('ingest', { buffer: response.data, handle: job.handle, sensor, contextType }, { signal: job.controller.signal });
    if (!current()) { extra.results.dispose([job.handle]); return; }
    if (includes(['queued', 'started'], apiResponse.status)) {
      const nextUrl = apiResponse.meta?.jobUrl;
      if (!nextUrl) { fail('error', ['Rainfall request returned queued/started without a follow-up job URL.']); jobs.delete(pollKey); return; }
      job.timer = setTimeout(() => pollRainfallApiV2({ dispatch, getState, extra, requestId, sensor, contextType, url: nextUrl, params: false, pollKey, job, attempt: attempt + 1 }), REQUEST_TIME_INTERVAL);
      return;
    }
    if (apiResponse.status === 'finished' && apiResponse.meta?.artifactUrl) {
      let artifact;
      try {
        artifact = await axios({ url: apiResponse.meta.artifactUrl, method: 'GET', signal: job.controller.signal, responseType: 'arraybuffer' });
      } catch (error) {
        if (job.controller.signal.aborted) throw error;
        const refreshUrl = apiResponse.meta.jobUrl || url;
        const refreshed = await axios({ url: refreshUrl, method: 'POST', signal: job.controller.signal, responseType: 'arraybuffer' });
        const refreshedStatus = await extra.results.run('ingest', { buffer: refreshed.data, handle: job.handle, sensor, contextType }, { signal: job.controller.signal });
        const refreshedUrl = refreshedStatus.meta?.artifactUrl;
        if (!refreshedUrl) throw error;
        try {
          artifact = await axios({ url: refreshedUrl, method: 'GET', signal: job.controller.signal, responseType: 'arraybuffer' });
        } catch (refreshedError) {
          if (job.controller.signal.aborted) throw refreshedError;
          const inlineUrl = refreshedStatus.meta?.inlineUrl || apiResponse.meta.inlineUrl;
          if (!inlineUrl) throw refreshedError;
          artifact = await axios({ url: inlineUrl, method: 'GET', signal: job.controller.signal, responseType: 'arraybuffer' });
        }
      }
      if (!current()) return;
      apiResponse = await extra.results.run('ingest', { buffer: artifact.data, handle: job.handle, sensor, contextType }, { signal: job.controller.signal });
      if (!current()) { extra.results.dispose([job.handle]); return; }
    }
    if (apiResponse.status === 'finished' && apiResponse.data !== null) {
      dispatch(requestRainfallDataSuccess({ requestId, contextType, results: { [sensor]: apiResponse.data }, resultHandles: { [sensor]: apiResponse.handle }, processedKwargs: apiResponse.args, status: apiResponse.status, messages: apiResponse.messages }));
      dispatch(applyActiveResultToMap({ requestId, contextType }));
    } else fail(apiResponse.status === 'finished' ? 'error' : apiResponse.status, apiResponse.messages);
    jobs.delete(pollKey);
  } catch (error) {
    if (!current()) return;
    fail(job.controller.signal.aborted ? 'canceled' : 'error', ['An error occurred when trying to fetch the rainfall data.', String(error)]);
    extra.results.dispose([job.handle]); jobs.delete(pollKey);
  }
};

export const fetchRainfallDataFromApiV2 = (payload) => (dispatch, getState, extra) => {
  const { contextType, rainfallDataType } = payload;
  const state = getState();
  const kwargs = selectFetchKwargs(state, contextType);
  const bounds = resolveAvailableBounds({
    contextType,
    rollup: kwargs.rollup,
    latest: state.stats?.latest,
    rainfallMinDate: RAINFALL_MIN_DATE
  });
  if (!bounds.available) return;

  const rainfallDataTypePath = getRainfallDataTypePath({
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
      f: kwargs.f,
      rollup: kwargs.rollup,
      delivery: 'artifact'
    };

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
    abortPollingJob(extra.pollingJobs, pollKey);
    extra.pollingJobs.set(pollKey, {
      handle: nanoid(),
      controller: new AbortController(),
      startedAt: Date.now()
    });

    pollRainfallApiV2({
      dispatch, getState, extra, job: extra.pollingJobs.get(pollKey),
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

export const cancelRainfallPolling = ({ requestId, contextType, sensor }) => (_dispatch, _getState, extra) => {
  const pollKey = getPollingKey({ requestId, contextType, sensor });
  abortPollingJob(extra?.pollingJobs, pollKey, 'canceled');
};

export const pickRainfallEvent = ({ eventid, contextType }) => (dispatch, getState) => {
  dispatch(pickRainfallEventAction({ eventid }));

  const rainfallEvent = selectEvent(getState(), eventid);
  if (!rainfallEvent) {
    return;
  }

  const state = getState();
  const kwargs = selectFetchKwargs(state, contextType);
  const bounds = resolveAvailableBounds({
    contextType,
    rollup: kwargs.rollup,
    latest: state.stats?.latest,
    rainfallMinDate: RAINFALL_MIN_DATE
  });
  if (!bounds.available) return;
  const range = clampDateTimeRange({ start: rainfallEvent.startDt, end: rainfallEvent.endDt, ...bounds });
  dispatch(pickRainfallDateTimeRange({
    contextType,
    startDt: range.start.toISOString(),
    endDt: range.end.toISOString()
  }));
};
