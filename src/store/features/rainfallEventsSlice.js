import { createSlice } from '@reduxjs/toolkit';
import { initialState } from '../initialState';

const rainfallEventsSlice = createSlice({
  name: 'rainfallEvents',
  initialState: initialState.rainfallEvents,
  reducers: {}
});

export default rainfallEventsSlice.reducer;
