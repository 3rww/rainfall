import { createSlice } from '@reduxjs/toolkit';

export const playbackScaleMode = mode => mode === 'combined' ? 'cumulative' : mode;
export const playbackScale = playback => playback.scales[playbackScaleMode(playback.mode)];
export const PLAYBACK_FRAMES_PER_SECOND = 6;
export const PLAYBACK_SPEEDS = [0.5, 1, 2, 5, 10];

const initialState = {
  key: '', available: false, message: '', mode: 'total', playing: false,
  speed: 1, repeat: false, step: null,
  target: 0, generation: 0, timeline: [], appliedIndex: null, interval: null, status: 'idle',
  summary: { interval: [], cumulative: [] },
  scales: { total: 'breaks_050', interval: 'breaks_005', cumulative: 'breaks_050' }
};
const slice = createSlice({
  name: 'playback', initialState,
  reducers: {
    resetPlayback(state, { payload }) { return { ...initialState, scales: state.scales, speed: state.speed, repeat: state.repeat, generation: state.generation + 1, ...payload }; },
    changePlaybackMode(state, { payload }) {
      if (payload !== 'total' && !state.available) return;
      state.target = state.mode === 'total' ? 0 : state.appliedIndex ?? 0;
      state.mode = payload; state.playing = false; state.step = null; state.appliedIndex = null; state.interval = null;
      state.generation++; state.status = payload === 'total' ? 'idle' : 'loading';
    },
    seekPlayback(state, { payload }) {
      state.target = Math.max(0, Math.min(payload, state.timeline.length - 1));
      state.playing = false; state.step = null; state.generation++; state.status = 'loading';
    },
    stepPlayback(state, { payload }) {
      if (state.mode === 'total' || !state.timeline.length || ![-1, 1].includes(payload)) return;
      // Resolve a playing step against the runtime's displayed frame, which can
      // be ahead of Redux's throttled progress. Repeated paused clicks accumulate.
      if (state.step && state.status === 'loading') state.step.delta += payload;
      else state.step = { from: state.playing ? null : state.target, delta: payload };
      state.target = Math.max(0, Math.min(state.target + payload, state.timeline.length - 1));
      state.playing = false; state.generation++; state.status = 'loading';
    },
    togglePlayback(state) {
      if (state.timeline.length < 2 || state.mode === 'total') return;
      state.playing = !state.playing;
      state.step = null;
      if (state.playing && state.appliedIndex === state.timeline.length - 1) { state.target = 0; state.generation++; }
    },
    pausePlayback(state) { state.playing = false; state.step = null; },
    selectPlaybackSpeed(state, { payload }) { if (PLAYBACK_SPEEDS.includes(payload)) state.speed = payload; },
    togglePlaybackRepeat(state) { state.repeat = !state.repeat; },
    restartPlayback(state) {
      if (!state.playing || !state.repeat || state.timeline.length < 2) return;
      state.target = 0; state.step = null; state.generation++; state.status = 'loading';
    },
    playbackPrepared(state, { payload }) { if (payload.key === state.key) { state.timeline = payload.timeline; state.summary = payload.summary; } },
    playbackProgress(state, { payload }) {
      if (payload.key !== state.key || payload.generation !== state.generation) return;
      state.appliedIndex = payload.index; state.interval = payload.interval; state.status = payload.status;
      // During a seek the slider already represents the requested target.
      if (payload.index !== null && state.status === 'ready') state.target = payload.index;
      state.playing = payload.playing;
    },
    playbackError(state, { payload }) {
      state.mode = 'total'; state.playing = false; state.appliedIndex = null; state.interval = null;
      state.status = 'error'; state.message = payload; state.available = false;
    },
    selectPlaybackScale(state, { payload }) { state.scales[playbackScaleMode(state.mode)] = payload; }
  }
});
export const { resetPlayback, changePlaybackMode, seekPlayback, stepPlayback, togglePlayback, pausePlayback, selectPlaybackSpeed, togglePlaybackRepeat, restartPlayback, playbackPrepared, playbackProgress, playbackError, selectPlaybackScale } = slice.actions;
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
