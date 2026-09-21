import { createAction, createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit';

export const resultKey = ({ contextType, requestId }) => JSON.stringify([contextType, requestId]);
export const historyItem = (state, arg) => state.fetchKwargs[arg.contextType]?.history.find(i => i.requestId === arg.requestId);
export const workerFailed = createAction('results/workerFailed');
export const exportRequested = createAction('results/exportRequested');
export const operationCanceled = createAction('results/operationCanceled');
export const saveRequested = createAction('results/saveRequested');
const empty = Object.freeze({});
const presentation = (state, arg) => state.resultsPresentation.items[resultKey(arg)];
const currentRevision = (state, arg) => historyItem(state, arg)?.revision === arg.revision;
export const previewKey = arg => JSON.stringify([resultKey(arg), arg.revision, arg.mode, arg.selected, arg.range, arg.rollup]);
const slot = arg => arg.format || 'preview';

function operation(type) {
  return createAsyncThunk(`results/${type}`, async (arg, api) => {
    const item = historyItem(api.getState(), arg);
    if (!item?.detailsAvailable || item.revision !== arg.revision) throw new Error('Detailed results are unavailable. Please rerun this query.');
    return api.extra.results.run(type, { ...arg, handles: item.resultHandles }, {
      signal: api.signal,
      onProgress: progress => api.dispatch(operationProgress({ ...arg, operationId: api.requestId, progress }))
    });
  }, {
    condition: (arg, { getState }) => {
      const state = getState();
      if (!currentRevision(state, arg)) return false;
      const existing = presentation(state, arg)?.operations?.[slot(arg)];
      return !(existing?.status === 'pending' && existing.revision === arg.revision);
    }
  });
}
export const preparePreview = operation('preview');
export const generateExport = operation('export');
const ensure = (state, arg) => state.items[resultKey(arg)] ||= { open: false, mode: 'averageByType', selected: [], selectionCustomized: false, range: {}, operations: {}, previewKey: null };
const removeCache = (state, key) => {
  state.lru = state.lru.filter(k => {
    if (state.cache[k]?.owner !== key) return true;
    delete state.cache[k]; return false;
  });
};
const slice = createSlice({
  name: 'results', initialState: { items: {}, cache: {}, lru: [] },
  reducers: {
    modalOpened(state, { payload }) { const item = ensure(state, payload); item.open = true; },
    modalClosed(state, { payload }) { ensure(state, payload).open = false; },
    preferencesChanged(state, { payload }) {
      const item = ensure(state, payload);
      if (payload.mode) item.mode = payload.mode;
      if (payload.selected) { item.selected = [...new Set(payload.selected)].sort(); item.selectionCustomized = true; }
      if (payload.range) item.range = payload.range;
    },
    resultUpdated(state, { payload }) {
      const item = ensure(state, payload);
      removeCache(state, resultKey(payload));
      item.operations = {}; item.previewKey = null; item.error = null;
      const available = new Set(payload.sensors);
      item.selected = item.selectionCustomized ? item.selected.filter(k => available.has(k)) : payload.sensors.slice(0, 10);
    },
    resultRemoved(state, { payload }) { const key = resultKey(payload); removeCache(state, key); delete state.items[key]; },
    previewActivated(state, { payload }) {
      const item = ensure(state, payload);
      item.previewKey = payload.key;
      // A cached preview replaces any aborted in-flight operation immediately.
      item.operations.preview = { ...item.operations.preview, operationId: null, status: 'succeeded', key: payload.key, error: null, progress: { done: true } };
      state.lru = state.lru.filter(k => k !== payload.key);
      state.lru.push(payload.key);
    },
    operationProgress(state, { payload }) {
      const op = state.items[resultKey(payload)]?.operations[slot(payload)];
      if (op?.operationId === payload.operationId) op.progress = payload.progress;
    },
    exportSaved(state, { payload }) {
      const op = state.items[resultKey(payload)]?.operations[payload.format];
      if (op?.artifact === payload.artifact) { op.status = 'saved'; delete op.artifact; }
    }
  },
  extraReducers(builder) {
    for (const thunk of [preparePreview, generateExport]) {
      builder.addCase(thunk.pending, (state, action) => {
        const { arg, requestId } = action.meta;
        ensure(state, arg).operations[slot(arg)] = { operationId: requestId, revision: arg.revision, key: thunk === preparePreview ? previewKey(arg) : null, status: 'pending', progress: {} };
      });
      builder.addCase(thunk.rejected, (state, action) => {
        const { arg, requestId } = action.meta;
        const op = state.items[resultKey(arg)]?.operations[slot(arg)];
        if (op?.operationId !== requestId) return;
        op.status = action.meta.aborted ? 'canceled' : 'failed';
        op.error = action.meta.aborted ? null : action.error.message;
      });
    }
    builder.addCase(preparePreview.fulfilled, (state, action) => {
      const { arg, requestId } = action.meta;
      const item = state.items[resultKey(arg)];
      if (item?.operations.preview?.operationId !== requestId) return;
      const key = previewKey(arg);
      item.operations.preview.status = 'succeeded';
      item.previewKey = key;
      state.cache[key] = { owner: resultKey(arg), data: action.payload };
      state.lru = state.lru.filter(k => k !== key); state.lru.push(key);
      while (state.lru.length > 16) delete state.cache[state.lru.shift()];
    });
    builder.addCase(generateExport.fulfilled, (state, action) => {
      const op = state.items[resultKey(action.meta.arg)]?.operations[action.meta.arg.format];
      if (op?.operationId !== action.meta.requestId) return;
      Object.assign(op, action.payload, { status: 'ready' });
    });
    builder.addCase(operationCanceled, (state, { payload }) => {
      const op = state.items[resultKey(payload)]?.operations[payload.format];
      if (op) { op.status = 'canceled'; op.operationId = null; delete op.artifact; }
    });
    builder.addCase(workerFailed, (state, action) => {
      state.cache = {}; state.lru = [];
      for (const item of Object.values(state.items)) {
        item.previewKey = null; item.error = `${action.payload} Please rerun the query.`;
        for (const op of Object.values(item.operations)) { op.status = 'failed'; op.operationId = null; op.error = item.error; delete op.artifact; }
      }
    });
  }
});
export const { modalOpened, modalClosed, preferencesChanged, resultUpdated, resultRemoved, previewActivated, operationProgress, exportSaved } = slice.actions;
export default slice.reducer;
export const makeSelectResultPresentation = () => createSelector(
  [presentation, (state, arg) => state.resultsPresentation.cache[presentation(state, arg)?.previewKey]?.data],
  (item, preview) => ({ ...(item || empty), preview })
);
export const makeSelectSensorSummaries = () => createSelector(
  [(state, arg) => historyItem(state, arg)?.results],
  results => Object.entries(results || {}).flatMap(([type, sensors]) => sensors.map(s => ({ ...s, type, key: `${type}:${s.id}` })))
    .sort((a, b) => a.type.localeCompare(b.type) || String(a.id).localeCompare(String(b.id), undefined, { numeric: true }))
);
