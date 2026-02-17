import { createSlice } from '@reduxjs/toolkit';
import { initialState } from '../initialState';

const statsSlice = createSlice({
  name: 'stats',
  initialState: initialState.stats,
  reducers: {
    setLatestTimestamps: (state, action) => {
      state.latest = action.payload || {};
    }
  }
});

export const { setLatestTimestamps } = statsSlice.actions;

export default statsSlice.reducer;
