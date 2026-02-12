import { createSlice } from '@reduxjs/toolkit';
import { initialState } from '../initialState';

const statsSlice = createSlice({
  name: 'stats',
  initialState: initialState.stats,
  reducers: {}
});

export default statsSlice.reducer;
