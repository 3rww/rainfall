import { createSlice } from '@reduxjs/toolkit';
import { initialState } from '../initialState';
import { pickRainfallDateTimeRange } from './fetchKwargsSlice';
import { toValidDateTime } from '../utils/dateTime';

const rainfallEventsSlice = createSlice({
  name: 'rainfallEvents',
  initialState: initialState.rainfallEvents,
  reducers: {
    setRainfallEvents: (state, action) => {
      state.list = Array.isArray(action.payload) ? action.payload : [];
    },
    pickRainfallEvent: (state, action) => {
      const { eventid } = action.payload || {};
      state.list.forEach((event) => {
        event.selected = event.eventid === eventid;
      });
    },
    clearSelectedRainfallEvents: (state) => {
      state.list.forEach((event) => {
        event.selected = false;
      });
    },
    calcEventStats: (state) => {
      const eventsData = state.list;
      if (!Array.isArray(eventsData) || eventsData.length === 0) {
        return;
      }

      const eventLatest = eventsData.map((event) => event.endDt).sort()[eventsData.length - 1];
      state.stats.latest = eventLatest;
      state.stats.longest = Math.max(...eventsData.map((event) => event.hours));
      const maxDate = toValidDateTime(eventLatest);
      state.stats.maxDate = maxDate ? maxDate.endOf('month').format() : null;
    },
    filterEventByHours: (state, action) => {
      state.filters.maxHours = Number(action.payload?.maxHours ?? state.filters.maxHours);
    }
  },
  extraReducers: (builder) => {
    builder.addCase(pickRainfallDateTimeRange, (state) => {
      state.list
        .filter((event) => event.selected)
        .forEach((event) => {
          event.selected = false;
        });
    });
  }
});

export const {
  setRainfallEvents,
  pickRainfallEvent,
  clearSelectedRainfallEvents,
  calcEventStats,
  filterEventByHours
} = rainfallEventsSlice.actions;

export default rainfallEventsSlice.reducer;
