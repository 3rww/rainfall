import { createSlice } from '@reduxjs/toolkit';
import { initialState } from '../initialState';

const normalizeMessage = (messages) => {
  if (Array.isArray(messages) && messages.length > 0) {
    return `${messages[0]}`;
  }
  if (typeof messages === 'string') {
    return messages;
  }
  return null;
};

const uniquePush = (array, value) => {
  if (!Array.isArray(array)) {
    return [value];
  }
  if (!array.includes(value)) {
    array.push(value);
  }
  return array;
};

const removeValue = (array, value) => {
  if (!Array.isArray(array)) {
    return [];
  }
  return array.filter((item) => item !== value);
};

const resolveLifecycleAfterUpdate = (fetchItem, terminalStatus = null) => {
  const completedCount = Array.isArray(fetchItem.completedSensors) ? fetchItem.completedSensors.length : 0;
  const failedCount = Array.isArray(fetchItem.failedSensors) ? fetchItem.failedSensors.length : 0;

  if (fetchItem.isFetching > 0) {
    if (completedCount > 0 || failedCount > 0) {
      return 'partial';
    }
    return 'pending';
  }

  if (terminalStatus === 'timed_out') {
    return 'timed_out';
  }
  if (terminalStatus === 'canceled') {
    return 'canceled';
  }
  if (completedCount > 0 && failedCount > 0) {
    return 'partial';
  }
  if (failedCount > 0) {
    return 'failed';
  }
  if (completedCount > 0) {
    return 'succeeded';
  }
  return 'idle';
};

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
      const { contextType, requestId, fetchKwargs, status, messages, sensor } = action.payload;
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
          messages,
          lifecycle: 'pending',
          pendingSensors: sensor ? [sensor] : [],
          completedSensors: [],
          failedSensors: [],
          lastError: null
        });
        return;
      }

      currentItem.isFetching += 1;
      if (sensor) {
        currentItem.pendingSensors = uniquePush(currentItem.pendingSensors, sensor);
      }
      currentItem.lifecycle = resolveLifecycleAfterUpdate(currentItem);
    },
    requestRainfallDataSuccess: (state, action) => {
      const { contextType, requestId, results, processedKwargs, status, messages } = action.payload;

      findHistoryItemsByRequestId(state, requestId, contextType).forEach((fetchItem) => {
        fetchItem.isFetching -= 1;
        fetchItem.results = { ...results, ...fetchItem.results };
        fetchItem.processedKwargs = processedKwargs;
        fetchItem.status = status;
        fetchItem.messages = messages;

        const completedSensors = Object.keys(results || {});
        completedSensors.forEach((sensor) => {
          fetchItem.pendingSensors = removeValue(fetchItem.pendingSensors, sensor);
          fetchItem.completedSensors = uniquePush(fetchItem.completedSensors, sensor);
          fetchItem.failedSensors = removeValue(fetchItem.failedSensors, sensor);
        });

        fetchItem.lastError = null;
        fetchItem.lifecycle = resolveLifecycleAfterUpdate(fetchItem, status);
      });
    },
    requestRainfallDataFail: (state, action) => {
      const { contextType, requestId, status, messages, results } = action.payload;
      const [fetchItem] = findHistoryItemsByRequestId(state, requestId, contextType);
      if (!fetchItem) {
        return;
      }

      fetchItem.isFetching -= 1;
      fetchItem.status = status;
      fetchItem.messages = messages;

       const failedSensors = Object.keys(results || {});
       failedSensors.forEach((sensor) => {
        fetchItem.pendingSensors = removeValue(fetchItem.pendingSensors, sensor);
        fetchItem.failedSensors = uniquePush(fetchItem.failedSensors, sensor);
      });

      fetchItem.lastError = normalizeMessage(messages);
      fetchItem.lifecycle = resolveLifecycleAfterUpdate(fetchItem, status);
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
