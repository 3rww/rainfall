import { createSlice } from '@reduxjs/toolkit';
import { initialState } from '../initialState';

const progressSlice = createSlice({
  name: 'progress',
  initialState: initialState.progress,
  reducers: {}
});

export default progressSlice.reducer;
