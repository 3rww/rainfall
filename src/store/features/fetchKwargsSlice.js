import { createSlice } from '@reduxjs/toolkit';
import { initialState } from '../initialState';

const findHistoryItemsByRequestId = (state, requestId, contextType) => {
  if (contextType) {
    return (state[contextType]?.history || []).filter((item) => item.requestId === requestId);
  }

  return Object.values(state).flatMap((contextData) => (
    (contextData?.history || []).filter((item) => item.requestId === requestId)
  ));
};

const fetchKwargsSlice = createSlice({
  name: 'fetchKwargs',
  initialState: initialState.fetchKwargs,
  reducers: {
    pickRainfallDateTimeRange: (state, action) => {
      const { contextType, startDt, endDt } = action.payload;
      if (!state[contextType]) {
        return;
      }

      state[contextType].active.startDt = startDt;
      state[contextType].active.endDt = endDt;
    },
    pickSensor: (state, action) => {
      const { contextType, sensorLocationType, selectedOptions } = action.payload;
      if (!state[contextType]) {
        return;
      }

      state[contextType].active.sensorLocations[sensorLocationType] = Array.isArray(selectedOptions)
        ? selectedOptions.filter((option) => option !== null)
        : [];
    },
    pickInterval: (state, action) => {
      const { contextType, rollup } = action.payload;
      if (!state[contextType]) {
        return;
      }

      state[contextType].active.rollup = rollup;
    },
    requestRainfallData: (state, action) => {
      const { contextType, requestId, fetchKwargs, status, messages } = action.payload;
      const context = state[contextType];
      if (!context) {
        return;
      }

      const currentItem = context.history.find((item) => item.requestId === requestId);
      if (!currentItem) {
        context.history.push({
          fetchKwargs,
          requestId,
          isFetching: 1,
          isActive: false,
          results: false,
          status,
          messages
        });
        return;
      }

      currentItem.isFetching += 1;
    },
    requestRainfallDataSuccess: (state, action) => {
      const { contextType, requestId, results, processedKwargs, status, messages } = action.payload;

      findHistoryItemsByRequestId(state, requestId, contextType).forEach((fetchItem) => {
        fetchItem.isFetching -= 1;
        fetchItem.results = { ...results, ...fetchItem.results };
        fetchItem.processedKwargs = processedKwargs;
        fetchItem.status = status;
        fetchItem.messages = messages;
      });
    },
    requestRainfallDataFail: (state, action) => {
      const { contextType, requestId, status, messages } = action.payload;
      const [fetchItem] = findHistoryItemsByRequestId(state, requestId, contextType);
      if (!fetchItem) {
        return;
      }

      fetchItem.isFetching -= 1;
      fetchItem.status = status;
      fetchItem.messages = messages;
    },
    pickActiveResultItem: (state, action) => {
      const { contextType, requestId } = action.payload;
      const context = state[contextType];
      if (!context) {
        return;
      }

      const activeItem = context.history.find((item) => item.requestId === requestId);
      if (!activeItem) {
        return;
      }

      context.history.forEach((item) => {
        item.isActive = item.requestId === requestId;
      });
    },
    removeFetchHistoryItem: (state, action) => {
      const { contextType, requestId } = action.payload;
      const context = state[contextType];
      if (!context) {
        return;
      }

      context.history = context.history.filter((item) => item.requestId !== requestId);
    }
  }
});

export const {
  pickRainfallDateTimeRange,
  pickSensor,
  pickInterval,
  requestRainfallData,
  requestRainfallDataSuccess,
  requestRainfallDataFail,
  pickActiveResultItem,
  removeFetchHistoryItem
} = fetchKwargsSlice.actions;

export default fetchKwargsSlice.reducer;
