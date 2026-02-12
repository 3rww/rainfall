import { createSlice } from '@reduxjs/toolkit';
import { initialState } from '../initialState';

const globalConfigSlice = createSlice({
  name: 'globalConfig',
  initialState: initialState.globalConfig,
  reducers: {}
});

export default globalConfigSlice.reducer;
