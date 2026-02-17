import { createSlice } from '@reduxjs/toolkit';
import { initialState } from '../initialState';

const initMapSlice = createSlice({
  name: 'initMap',
  initialState: initialState.initMap,
  reducers: {}
});

export default initMapSlice.reducer;
