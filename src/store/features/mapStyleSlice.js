import { createSlice } from '@reduxjs/toolkit';
import { initialState } from '../initialState';

const mapStyleSlice = createSlice({
  name: 'mapStyle',
  initialState: initialState.mapStyle,
  reducers: {}
});

export default mapStyleSlice.reducer;
