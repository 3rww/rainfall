import { createSlice } from '@reduxjs/toolkit';
import { initialState } from '../initialState';
import { pickRainfallDateTimeRange } from './fetchKwargsSlice';
import { toValidDateTime } from '../utils/dateTime';

const getEventDedupeKey = (event) => (
  `${event?.eventid ?? ''}|${event?.startDt ?? ''}|${event?.endDt ?? ''}`
);

const applyStatsFromEvents = (state) => {
  const eventsData = state.list;
  if (!Array.isArray(eventsData) || eventsData.length === 0) {
    state.stats.latest = null;
    state.stats.longest = null;
    state.stats.maxDate = null;
    return;
  }

  const eventLatest = eventsData.map((event) => event.endDt).sort()[eventsData.length - 1];
  state.stats.latest = eventLatest;
  state.stats.longest = Math.max(...eventsData.map((event) => event.hours));
  const maxDate = toValidDateTime(eventLatest);
  state.stats.maxDate = maxDate ? maxDate.endOf('month').format() : null;
};

const mergeEvents = (existingEvents = [], incomingEvents = []) => {
  const mergedByKey = new Map();

  existingEvents.forEach((event) => {
    const key = getEventDedupeKey(event);
    mergedByKey.set(key, event);
  });

  incomingEvents.forEach((event) => {
    const key = getEventDedupeKey(event);
    const existing = mergedByKey.get(key);

    if (existing) {
      mergedByKey.set(key, { ...existing, ...event, selected: !!existing.selected });
      return;
    }

    mergedByKey.set(key, event);
  });

  return [...mergedByKey.values()];
};

const rainfallEventsSlice = createSlice({
  name: 'rainfallEvents',
  initialState: initialState.rainfallEvents,
  reducers: {
    setRainfallEvents: (state, action) => {
      state.list = Array.isArray(action.payload) ? action.payload : [];
      state.loadStatus = 'succeeded';
      state.error = null;
      state.totalCount = state.list.length;
      state.loadedCount = state.list.length;
      state.loadedPages = state.list.length > 0 ? 1 : 0;
      state.nextPageUrl = null;
      applyStatsFromEvents(state);
    },
    startRainfallEventsLoad: (state) => {
      state.list = [];
      state.loadStatus = 'loading';
      state.error = null;
      state.totalCount = null;
      state.loadedCount = 0;
      state.loadedPages = 0;
      state.nextPageUrl = null;
      applyStatsFromEvents(state);
    },
    appendRainfallEventsPage: (state, action) => {
      const incomingEvents = Array.isArray(action.payload?.events) ? action.payload.events : [];
      state.list = mergeEvents(state.list, incomingEvents);
      state.loadStatus = 'loading';
      state.error = null;
      state.totalCount = Number.isFinite(action.payload?.totalCount)
        ? Number(action.payload.totalCount)
        : state.totalCount;
      state.loadedCount = state.list.length;
      state.loadedPages += 1;
      state.nextPageUrl = action.payload?.nextPageUrl || null;
      applyStatsFromEvents(state);
    },
    completeRainfallEventsLoad: (state) => {
      state.loadStatus = 'succeeded';
      state.error = null;
      if (state.totalCount === null) {
        state.totalCount = state.list.length;
      }
      state.loadedCount = state.list.length;
      state.nextPageUrl = null;
      applyStatsFromEvents(state);
    },
    failRainfallEventsLoad: (state, action) => {
      state.loadStatus = 'failed';
      state.error = action.payload?.error ? `${action.payload.error}` : 'Unable to load rainfall events.';
      state.loadedCount = state.list.length;
      if (action.payload?.nextPageUrl !== undefined) {
        state.nextPageUrl = action.payload.nextPageUrl;
      }
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
      applyStatsFromEvents(state);
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
  startRainfallEventsLoad,
  appendRainfallEventsPage,
  completeRainfallEventsLoad,
  failRainfallEventsLoad,
  pickRainfallEvent,
  clearSelectedRainfallEvents,
  calcEventStats,
  filterEventByHours
} = rainfallEventsSlice.actions;

export default rainfallEventsSlice.reducer;
