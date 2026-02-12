import { createAsyncThunk } from '@reduxjs/toolkit';

import {
  fetchJSON as legacyFetchJSON,
  initDataFetch as legacyInitDataFetch,
  fetchRainfallDataFromApiV2 as legacyFetchRainfallDataFromApiV2,
  pickDownload,
  deleteDownload,
  switchContext,
  pickSensorMiddleware,
  pickSensorByGeographyMiddleware
} from '../middleware';

export const fetchJSON = createAsyncThunk(
  'app/fetchJSON',
  async (payload, { dispatch }) => {
    await dispatch(legacyFetchJSON(payload));
    return true;
  }
);

export const initDataFetch = createAsyncThunk(
  'app/initDataFetch',
  async (payload, { dispatch }) => {
    await dispatch(legacyInitDataFetch(payload));
    return true;
  }
);

export const fetchRainfallDataFromApiV2 = createAsyncThunk(
  'app/fetchRainfallDataFromApiV2',
  async (payload, { dispatch }) => {
    await dispatch(legacyFetchRainfallDataFromApiV2(payload));
    return true;
  }
);

export {
  pickDownload,
  deleteDownload,
  switchContext,
  pickSensorMiddleware,
  pickSensorByGeographyMiddleware
};
