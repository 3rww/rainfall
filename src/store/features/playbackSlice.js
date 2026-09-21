import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  key: '', available: false, message: '', mode: 'total', playing: false,
  target: 0, generation: 0, timeline: [], frame: null, pending: null, status: 'idle',
  scales: { total: 'breaks_050', interval: 'breaks_005', cumulative: 'breaks_050' }
};
const slice = createSlice({
  name: 'playback', initialState,
  reducers: {
    resetPlayback(state, { payload }) { return { ...initialState, scales: state.scales, generation: state.generation + 1, ...payload }; },
    changePlaybackMode(state, { payload }) {
      if (payload !== 'total' && !state.available) return;
      state.target = state.mode === 'total' ? 0 : state.frame?.index ?? 0;
      state.mode = payload; state.playing = false; state.pending = null; state.frame = null;
      state.generation++; state.status = payload === 'total' ? 'idle' : 'loading';
    },
    seekPlayback(state, { payload }) {
      state.target = Math.max(0, Math.min(payload, state.timeline.length - 1));
      state.playing = false; state.generation++; state.pending = null; state.status = 'loading';
    },
    togglePlayback(state) {
      if (state.timeline.length < 2 || state.mode === 'total') return;
      state.playing = !state.playing;
      if (state.playing && state.frame?.index === state.timeline.length - 1) { state.target = 0; state.generation++; }
    },
    pausePlayback(state) { state.playing = false; },
    advancePlayback(state, { payload }) {
      if (!state.playing || !state.frame || state.pending) return;
      state.target = Math.min(Math.max(state.frame.index + 1, payload ?? 0), state.timeline.length - 1);
      state.status = 'loading';
    },
    playbackPrepared(state, { payload }) { if (payload.key === state.key) state.timeline = payload.timeline; },
    playbackFrameReady(state, { payload }) {
      if (payload.key === state.key && payload.generation === state.generation && payload.mode === state.mode && payload.frame.index === state.target) state.pending = payload;
    },
    playbackFrameApplied(state, { payload }) {
      if (state.pending?.token !== payload) return;
      state.frame = state.pending.frame; state.pending = null; state.status = 'ready';
      if (state.frame.index === state.timeline.length - 1) state.playing = false;
    },
    playbackError(state, { payload }) {
      state.mode = 'total'; state.playing = false; state.pending = null; state.frame = null;
      state.status = 'error'; state.message = payload; state.available = false;
    },
    selectPlaybackScale(state, { payload }) { state.scales[state.mode] = payload; }
  }
});
export const { resetPlayback, changePlaybackMode, seekPlayback, togglePlayback, pausePlayback, advancePlayback, playbackPrepared, playbackFrameReady, playbackFrameApplied, playbackError, selectPlaybackScale } = slice.actions;
export default slice.reducer;

export function activePlaybackResult(state) {
  return state.fetchKwargs[state.progress.tab]?.history?.find(item => item.isActive);
}
export function playbackAvailability(item) {
  if (!item) return 'Query rainfall to enable playback.';
  if (item.isFetching > 0) return 'Playback will be available when this query finishes.';
  if (item.fetchKwargs?.rollup?.toLowerCase() === 'total') return 'Choose a timestep interval to enable playback.';
  if (!item.detailsAvailable) return 'Detailed results are unavailable. Please rerun this query.';
  return '';
}
