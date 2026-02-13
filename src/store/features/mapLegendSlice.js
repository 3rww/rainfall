import { createSlice } from '@reduxjs/toolkit';
import { initialState } from '../initialState';
import { applyColorStretch } from './mapStyleSlice';
import { buildRainfallColorStyleExp } from '../utils/mb';

const mapLegendSlice = createSlice({
  name: 'mapLegend',
  initialState: initialState.mapLegend,
  reducers: {
    setLegendContent: (state, action) => {
      state.content = Array.isArray(action.payload) ? action.payload : [];
    }
  },
  extraReducers: (builder) => {
    builder.addCase(applyColorStretch, (state, action) => {
      const { breaks } = action.payload || {};
      const { legendContent } = buildRainfallColorStyleExp('total', breaks);
      state.content = Array.isArray(legendContent) ? legendContent : [];
    });
  }
});

export const { setLegendContent } = mapLegendSlice.actions;

export default mapLegendSlice.reducer;
