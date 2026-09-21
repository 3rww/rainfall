import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppStore } from './index';
import { createFakeResultsClient } from '../results/fakeClient';
import { requestRainfallData, requestRainfallDataSuccess, removeFetchHistoryItem, pickActiveResultItem } from './features/fetchKwargsSlice';
import { modalOpened, modalClosed, preferencesChanged, exportRequested, operationCanceled, resultKey, makeSelectResultPresentation, preparePreview, generateExport, previewKey } from './features/resultsPresentationSlice';
const stores = [];
afterEach(() => { for (const s of stores) s.teardown(); stores.length = 0; });
const arg = { contextType: 'legacyGauge', requestId: 'one' };
const getUi = (store, a = arg) => store.getState().resultsPresentation.items[resultKey(a)];
function setup(results = createFakeResultsClient(), saveFile = vi.fn()) {
  const actions = [];
  const store = createAppStore({ results, saveFile, middleware: [() => next => action => { actions.push(action); return next(action); }] });
  stores.push(store);
  return { store, results, actions, saveFile };
}
async function ingest(store, results, a = arg, handle = 'handle1', sensor = 'gauge') {
  const data = [{ id: '8', data: [{ ts: '2026-06-01T00:00:00-04:00', val: 0, src: 'G' }, { ts: '2026-06-01T00:15:00-04:00', val: null, src: 'N/D' }] }];
  const result = await results.run('ingest', { buffer: new TextEncoder().encode(JSON.stringify({ status: 'finished', data })).buffer, handle, sensor });
  store.dispatch(requestRainfallData({ ...a, sensor, fetchKwargs: { rollup: '15-minute', sensorLocations: { gauge: [], pixel: [] } }, status: 'pending', messages: [] }));
  store.dispatch(requestRainfallDataSuccess({ ...a, results: { [sensor]: result.data }, resultHandles: { [sensor]: handle }, processedKwargs: {}, status: 'finished', messages: [] }));
}
function controlledClient() {
  const base = createFakeResultsClient();
  const pending = [];
  return { ...base, pending, run(type, payload, options = {}) {
    if (type === 'ingest') return base.run(type, payload, options);
    return new Promise((resolve, reject) => {
      const task = { type, payload, options, resolve, reject };
      pending.push(task);
      options.signal?.addEventListener('abort', () => reject(new DOMException('Canceled', 'AbortError')), { once: true });
    });
  } };
}
describe('Redux results workflow', () => {
  it('opens with summaries, prepares only a preview, caches reopening and retains serializability', async () => {
    const { store, results, actions } = setup();
    const run = vi.spyOn(results, 'run');
    await ingest(store, results);
    store.dispatch(modalOpened(arg));
    await vi.waitFor(() => expect(getUi(store).operations.preview.status).toBe('succeeded'));
    store.dispatch(modalClosed(arg)); store.dispatch(modalOpened(arg));
    expect(run.mock.calls.map(c => c[0])).toEqual(['ingest', 'preview']);
    expect(store.getState().fetchKwargs.legacyGauge.history[0].results.gauge[0]).toMatchObject({ total: 0, missingCount: 1 });
    for (const action of actions) expect(JSON.parse(JSON.stringify(action))).toEqual(action);
    expect(JSON.stringify(actions)).not.toContain('"src":');
    expect(JSON.stringify(store.getState().fetchKwargs)).not.toContain('"data":');
  });
  it('deduplicates exports, keeps them running when closed, and saves without mounted components', async () => {
    const results = controlledClient();
    const { store, saveFile } = setup(results);
    await ingest(store, results);
    store.dispatch(modalOpened(arg));
    store.dispatch(modalOpened(arg));
    expect(results.pending.filter(p => p.type === 'preview')).toHaveLength(1);
    store.dispatch(exportRequested({ ...arg, format: 'csv' }));
    store.dispatch(exportRequested({ ...arg, format: 'csv' }));
    store.dispatch(modalClosed(arg));
    const exports = results.pending.filter(p => p.type === 'export');
    expect(exports).toHaveLength(1);
    expect(exports[0].options.signal.aborted).toBe(false);
    expect(results.pending[0].options.signal.aborted).toBe(true);
    results.artifact = () => ({ blob: new Blob(['data']), filename: 'rainfall.csv' });
    const release = vi.spyOn(results, 'release');
    exports[0].resolve({ artifact: 'a', filename: 'rainfall.csv' });
    await vi.waitFor(() => expect(saveFile).toHaveBeenCalledOnce());
    expect(release).toHaveBeenCalledWith('a');
    expect(getUi(store).operations.csv.status).toBe('saved');
  });
  it('scopes cancellation and progress to result, revision and operation', async () => {
    const results = controlledClient();
    const { store } = setup(results);
    const other = { ...arg, requestId: 'two' };
    await ingest(store, results); await ingest(store, results, other, 'handle2');
    store.dispatch(modalOpened(arg)); store.dispatch(modalOpened(other));
    store.dispatch(exportRequested({ ...arg, format: 'csv' }));
    store.dispatch(modalClosed(arg));
    expect(results.pending[0].options.signal.aborted).toBe(true);
    expect(results.pending[1].options.signal.aborted).toBe(false);
    expect(results.pending[2].options.signal.aborted).toBe(false);
    const select = makeSelectResultPresentation();
    const otherBefore = select(store.getState(), other);
    results.pending[2].options.onProgress({ processed: 1, total: 2 });
    expect(select(store.getState(), other)).toBe(otherBefore);
    store.dispatch(operationCanceled({ ...arg, format: 'csv' }));
    expect(results.pending[2].options.signal.aborted).toBe(true);
    expect(getUi(store, other).operations.csv).toBeUndefined();
  });
  it('replacement and deletion dispose observations/artifacts and reject stale replies', async () => {
    const results = controlledClient();
    const { store } = setup(results);
    const dispose = vi.spyOn(results, 'dispose');
    await ingest(store, results);
    store.dispatch(modalOpened(arg));
    const old = results.pending[0];
    await ingest(store, results, arg, 'replacement');
    expect(old.options.signal.aborted).toBe(true);
    expect(dispose).toHaveBeenCalledWith(['handle1']);
    old.resolve({ rows: [{ timestampMs: 1 }], series: [], interval: 'daily' });
    await Promise.resolve();
    expect(getUi(store).previewKey).toBeNull();
    store.dispatch(removeFetchHistoryItem(arg));
    expect(dispose).toHaveBeenCalledWith(['replacement']);
    expect(results.inspect().datasets).toBe(0);
    expect(getUi(store)).toBeUndefined();
  });
  it('marks worker data unavailable while retaining map summaries', async () => {
    const { store, results } = setup();
    await ingest(store, results); store.dispatch(modalOpened(arg));
    results.fail('Crashed');
    const item = store.getState().fetchKwargs.legacyGauge.history[0];
    expect(item.detailsAvailable).toBe(false);
    expect(item.results.gauge[0].total).toBe(0);
    expect(getUi(store).error).toMatch(/rerun/);
  });
  it('uses a global 16-entry LRU and invalidates all affected revision entries', async () => {
    const { store, results } = setup();
    await ingest(store, results);
    const keys = [];
    for (let i = 0; i < 17; i++) {
      const params = { ...arg, revision: 1, mode: 'averageByType', selected: [], range: { start: `2026-06-${String(i + 1).padStart(2, '0')}` }, rollup: '15-minute' };
      keys.push(previewKey(params));
      await store.dispatch(preparePreview(params));
    }
    expect(store.getState().resultsPresentation.lru).toHaveLength(16);
    expect(store.getState().resultsPresentation.cache[keys[0]]).toBeUndefined();
    await ingest(store, results, arg, 'replacement');
    expect(store.getState().resultsPresentation.lru).toHaveLength(0);
  });
  it('map payloads omit observations and processing does not update map state', async () => {
    const { store, results, actions } = setup();
    await ingest(store, results);
    store.dispatch(pickActiveResultItem(arg));
    const mapState = store.getState().mapStyle;
    store.dispatch(modalOpened(arg));
    await vi.waitFor(() => expect(getUi(store).operations.preview.status).toBe('succeeded'));
    expect(store.getState().mapStyle).toBe(mapState);
    const mapActions = actions.filter(a => a.type === 'mapStyle/setSourceDataBatch');
    expect(JSON.stringify(mapActions)).not.toContain('"src":');
  });
  it('failed exports can retry without fetching data and gesture failures retain a saveable handle', async () => {
    const results = controlledClient();
    const { store } = setup(results, () => { throw new Error('Gesture required'); });
    await ingest(store, results);
    store.dispatch(exportRequested({ ...arg, format: 'swmm' }));
    results.pending[0].reject(new Error('Export failed'));
    await vi.waitFor(() => expect(getUi(store).operations.swmm.status).toBe('failed'));
    store.dispatch(exportRequested({ ...arg, format: 'swmm' }));
    results.artifact = () => ({ blob: new Blob(), filename: 'test.inp' });
    results.pending[1].resolve({ artifact: 'retry', filename: 'test.inp' });
    await vi.waitFor(() => expect(getUi(store).operations.swmm.status).toBe('ready'));
    expect(getUi(store).operations.swmm.artifact).toBe('retry');
  });
});
it('partial sensor completion updates defaults in natural order and preserves explicit selections', async () => {
  const { store, results } = setup();
  await ingest(store, results, arg, 'pixel', 'pixel');
  expect(getUi(store).selected).toEqual(['pixel:8']);
  await ingest(store, results, arg, 'gauge');
  expect(getUi(store).selected).toEqual(['gauge:8', 'pixel:8']);
  store.dispatch(preferencesChanged({ ...arg, selected: [] }));
  await ingest(store, results, arg, 'replacement');
  expect(getUi(store).selected).toEqual([]);
});
