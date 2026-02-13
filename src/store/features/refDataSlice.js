import { createSlice } from '@reduxjs/toolkit';
import { initialState } from '../initialState';

const refDataSlice = createSlice({
  name: 'refData',
  initialState: initialState.refData,
  reducers: {
    setLookups: (state, action) => {
      state.lookups = action.payload || {};
    },
    setRefLayerData: (state, action) => {
      const { sourceName, data } = action.payload || {};
      if (!sourceName) {
        return;
      }
      state[sourceName] = data;
    }
  }
});

export const { setLookups, setRefLayerData } = refDataSlice.actions;

export default refDataSlice.reducer;
