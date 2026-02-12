import { createSlice } from '@reduxjs/toolkit';
import { initialState } from '../initialState';

const mapLegendSlice = createSlice({
  name: 'mapLegend',
  initialState: initialState.mapLegend,
  reducers: {}
});

export default mapLegendSlice.reducer;
