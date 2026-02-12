import { createSlice } from '@reduxjs/toolkit';
import { initialState } from '../initialState';

const refDataSlice = createSlice({
  name: 'refData',
  initialState: initialState.refData,
  reducers: {}
});

export default refDataSlice.reducer;
