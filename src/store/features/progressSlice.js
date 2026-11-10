import { createSlice } from '@reduxjs/toolkit';
import { initialState } from '../initialState';

const progressSlice = createSlice({
  name: 'progress',
  initialState: initialState.progress,
  reducers: {
    setQueryImportNotice: (state, action) => {
      state.queryImportNotice = action.payload;
    },
    switchTab: (state, action) => {
      state.tab = action.payload;
    },
    setFetching: (state, action) => {
      state.isFetching = !!action.payload;
    },
    startThinking: (state, action) => {
      if (action.payload !== undefined) {
        state.messages.push(action.payload);
      }
      state.isThinking += 1;
    },
    stopThinking: (state, action) => {
      if (action.payload !== undefined) {
        state.messages.push(action.payload);
      }
      state.isThinking -= 1;
    },
    mapLoaded: (state, action) => {
      if (!state.mapLoaded) {
        state.mapLoaded = action.payload === undefined ? true : !!action.payload;
      }
    },
    setInitialStyleLoaded: (state, action) => {
      state.initialStyleLoaded = action.payload === undefined ? true : !!action.payload;
    }
  }
});

export const {
  setQueryImportNotice,
  switchTab,
  setFetching,
  startThinking,
  stopThinking,
  mapLoaded,
  setInitialStyleLoaded
} = progressSlice.actions;

export default progressSlice.reducer;
