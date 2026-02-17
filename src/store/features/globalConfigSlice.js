import { createSlice } from '@reduxjs/toolkit';
import { initialState } from '../initialState';

const globalConfigSlice = createSlice({
  name: 'globalConfig',
  initialState: initialState.globalConfig,
  reducers: {
    setGlobalConfig: (_state, action) => action.payload || {}
  }
});

export const { setGlobalConfig } = globalConfigSlice.actions;

export default globalConfigSlice.reducer;
