import { createSlice } from '@reduxjs/toolkit';
import { initialState } from '../initialState';

const fetchKwargsSlice = createSlice({
  name: 'fetchKwargs',
  initialState: initialState.fetchKwargs,
  reducers: {}
});

export default fetchKwargsSlice.reducer;
