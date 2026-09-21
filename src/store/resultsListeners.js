import { isAnyOf } from '@reduxjs/toolkit';
import { saveAs } from 'file-saver';
import { requestRainfallDataSuccess, removeFetchHistoryItem } from './features/fetchKwargsSlice';
import {
  resultKey, historyItem, previewKey, preparePreview, generateExport,
  modalOpened, modalClosed, preferencesChanged, resultUpdated, resultRemoved,
  previewActivated, workerFailed, exportRequested, operationCanceled, saveRequested, exportSaved,
  makeSelectSensorSummaries
} from './features/resultsPresentationSlice';

export function registerResultsListeners(listener, extra) {
  const running = new Map();
  const selectSummaries = makeSelectSensorSummaries();
  const opKey = (arg, slot) => `${resultKey(arg)}:${slot}`;
  const cancel = (arg, slot) => { const key = opKey(arg, slot); running.get(key)?.abort(); running.delete(key); };
  const start = (api, thunk, arg, slot) => {
    const key = opKey(arg, slot);
    const promise = api.dispatch(thunk(arg));
    running.set(key, promise);
    promise.finally(() => { if (running.get(key) === promise) running.delete(key); });
  };
  const preview = (api, arg) => {
    const state = api.getState();
    const item = historyItem(state, arg);
    const ui = state.resultsPresentation.items[resultKey(arg)];
    if (!ui?.open || !item?.detailsAvailable) return;
    const params = { ...arg, revision: item.revision, mode: ui.mode, selected: ui.selected, range: ui.range, rollup: item.fetchKwargs.rollup };
    const key = previewKey(params);
    if (ui.operations.preview?.status === 'pending' && ui.operations.preview.key === key) return;
    cancel(arg, 'preview');
    if (state.resultsPresentation.cache[key]) { api.dispatch(previewActivated({ ...arg, key })); return; }
    // Abort dispatches its rejected action asynchronously; clear the old slot now.
    api.dispatch(operationCanceled({ ...arg, format: 'preview', internal: true }));
    start(api, preparePreview, params, 'preview');
  };
  function cleanup(api, arg) {
    for (const format of ['preview', 'csv', 'swmm']) cancel(arg, format);
    const ui = api.getOriginalState().resultsPresentation.items[resultKey(arg)];
    for (const op of Object.values(ui?.operations || {})) if (op.artifact) extra.results.release(op.artifact);
  }
  listener.startListening({ matcher: isAnyOf(modalOpened, preferencesChanged), effect: (action, api) => preview(api, action.payload) });
  listener.startListening({ actionCreator: modalClosed, effect: ({ payload }, api) => {
    cancel(payload, 'preview');
    api.dispatch(operationCanceled({ ...payload, format: 'preview', internal: true }));
  } });
  listener.startListening({ actionCreator: requestRainfallDataSuccess, effect: ({ payload }, api) => {
    const old = historyItem(api.getOriginalState(), payload);
    const item = historyItem(api.getState(), payload);
    if (!item) { extra.results.dispose(Object.values(payload.resultHandles || {})); return; }
    cleanup(api, payload);
    const retained = new Set(Object.values(item.resultHandles || {}));
    extra.results.dispose(Object.values(old?.resultHandles || {}).filter(h => !retained.has(h)));
    api.dispatch(resultUpdated({ contextType: payload.contextType, requestId: payload.requestId, sensors: selectSummaries(api.getState(), payload).map(s => s.key) }));
    preview(api, { contextType: payload.contextType, requestId: payload.requestId });
  } });
  listener.startListening({ actionCreator: removeFetchHistoryItem, effect: ({ payload }, api) => {
    const item = historyItem(api.getOriginalState(), payload);
    cleanup(api, payload);
    extra.results.dispose(Object.values(item?.resultHandles || {}));
    api.dispatch(resultRemoved(payload));
  } });
  listener.startListening({ actionCreator: exportRequested, effect: ({ payload }, api) => {
    const state = api.getState();
    const item = historyItem(state, payload);
    if (!item?.detailsAvailable) return;
    const op = state.resultsPresentation.items[resultKey(payload)]?.operations[payload.format];
    if (op?.status === 'pending' || op?.status === 'ready') return;
    start(api, generateExport, { ...payload, revision: item.revision, rollup: item.fetchKwargs.rollup }, payload.format);
  } });
  listener.startListening({ actionCreator: operationCanceled, effect: ({ payload }, api) => {
    if (!payload.internal) cancel(payload, payload.format);
    const op = api.getOriginalState().resultsPresentation.items[resultKey(payload)]?.operations[payload.format];
    if (op?.artifact) extra.results.release(op.artifact);
  } });
  const save = (api, arg, artifact) => {
    const resource = extra.results.artifact(artifact);
    if (!resource) return;
    try {
      (extra.saveFile || saveAs)(resource.blob, resource.filename, { autoBom: true });
      extra.results.release(artifact);
      api.dispatch(exportSaved({ ...arg, artifact }));
    } catch {
      // Keep the artifact and its originating result's Ready to save control.
    }
  };
  listener.startListening({ actionCreator: generateExport.fulfilled, effect: (action, api) => {
    const arg = action.meta.arg;
    const op = api.getState().resultsPresentation.items[resultKey(arg)]?.operations[arg.format];
    if (op?.operationId !== action.meta.requestId || historyItem(api.getState(), arg)?.revision !== arg.revision) {
      extra.results.release(action.payload.artifact); return;
    }
    save(api, arg, action.payload.artifact);
  } });
  listener.startListening({ actionCreator: saveRequested, effect: ({ payload }, api) => {
    const op = api.getState().resultsPresentation.items[resultKey(payload)]?.operations[payload.format];
    if (op?.artifact) save(api, payload, op.artifact);
  } });
  listener.startListening({ actionCreator: workerFailed, effect: () => {
    for (const op of running.values()) op.abort(); running.clear();
  } });
  return () => { for (const op of running.values()) op.abort(); running.clear(); };
}
