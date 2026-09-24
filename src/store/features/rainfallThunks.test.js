import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppStore } from '../index';
import { createFakeResultsClient } from '../../results/fakeClient';
import axios from 'axios';
import { initialState } from '../initialState';
import { rootReducer } from '../rootReducer';
import { RAINFALL_RESPONSE_FORMAT } from '../config';
import { fetchRainfallDataFromApiV2, pickRainfallEvent } from './rainfallThunks';

vi.mock('axios');
afterEach(() => vi.resetAllMocks());
const makeStore = (context, sensor, rollup, available = true) => {
  const state = structuredClone(initialState);
  state.stats.latest = available ? {
    'earliest-15min-calibrated-gauge': '2025-01-01T00:00:00Z',
    'latest-15min-calibrated-gauge': '2026-01-01T00:00:00Z',
    'earliest-15min-calibrated-radar': '2025-01-01T00:00:00Z',
    'latest-15min-calibrated-radar': '2026-01-01T00:00:00Z'
  } : {};
  if (available) {
    for (const sensor of ['gauge', 'radar']) {
      state.stats.latest[`earliest-5min-calibrated-${sensor}`] = '2025-01-01T00:00:00Z';
      state.stats.latest[`latest-5min-calibrated-${sensor}`] = '2026-01-01T00:00:00Z';
    }
  }
  Object.assign(state.fetchKwargs[context].active, { startDt: '2025-02-01T00:00:00Z', endDt: '2025-02-02T00:00:00Z', rollup });
  state.fetchKwargs[context].active.sensorLocations[sensor] = [{ value: '9A', label: '9A' }];
  state.rainfallEvents.list = [{ eventid: 'wide', startDt: '2020-01-01T00:00:00Z', endDt: '2030-01-01T00:00:00Z' }];
  return createAppStore({ preloadedState: state, results: createFakeResultsClient() });
};

describe('historic requests', () => {
  for (const [context, sensor] of [['legacyGauge', 'gauge'], ['legacyGarr', 'pixel']]) {
    for (const rollup of ['15-minute', 'Hourly', 'Daily', 'Total', '5-minute']) {
      it(`${context} ${rollup} uses its parquet endpoint and canonical results`, async () => {
        const store = makeStore(context, sensor, rollup);
        const data = [{ id: '9A', data: [{ ts: '2025-02-01T00:00:00Z', val: null, src: 'N/D' }] }];
        axios.mockResolvedValue({ data: new TextEncoder().encode(JSON.stringify({ status: 'finished', data, args: {}, messages: [] })).buffer });
        store.dispatch(fetchRainfallDataFromApiV2({ contextType: context, rainfallDataType: 'historic' }));
        await vi.waitFor(() => expect(store.getState().fetchKwargs[context].history[0]?.results?.[sensor]?.[0]?.total).toBeNull());
        const request = axios.mock.calls[0][0];
        expect(request.url).toContain(`/v2/${sensor}/${rollup === '5-minute' ? 'historic5' : 'historic15'}/`);
        expect(request.data.f).toBe(RAINFALL_RESPONSE_FORMAT);
        expect(request.data.delivery).toBe('artifact');
        expect(request.data[`${sensor}s`]).toBe('9A');
        expect(request.data.rollup).toBe(rollup);
      });
    }
  }
  it.each(['5-minute', '15-minute', 'Total'])('does not submit %s when parquet bounds are missing', (rollup) => {
    const store = makeStore('legacyGauge', 'gauge', rollup, false);
    store.dispatch(fetchRainfallDataFromApiV2({ contextType: 'legacyGauge', rainfallDataType: 'historic' }));
    expect(axios).not.toHaveBeenCalled();
  });
  it('clamps event ranges against parquet metadata immediately', () => {
    const store = makeStore('legacyGauge', 'gauge', 'Total');
    store.dispatch(pickRainfallEvent({ contextType: 'legacyGauge', eventid: 'wide' }));
    const active = store.getState().fetchKwargs.legacyGauge.active;
    expect(active.startDt).toBe('2025-01-01T00:00:00.000Z');
    expect(active.endDt).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('binary polling envelopes', () => {
  it('fetches a completed artifact and ingests its original envelope', async () => {
    const store = makeStore('legacyGauge', 'gauge', '15-minute');
    const encode = value => new TextEncoder().encode(JSON.stringify(value)).buffer;
    axios
      .mockResolvedValueOnce({ data: encode({ status: 'finished', data: null, meta: { artifactUrl: 'https://example.test/result.json.gz' } }) })
      .mockResolvedValueOnce({ data: encode({ status: 'finished', data: [{ id: '9A', data: [{ ts: '2026-01-01T00:00:00Z', val: 1.5, src: 'G' }] }], args: {}, messages: [] }) });

    store.dispatch(fetchRainfallDataFromApiV2({ contextType: 'legacyGauge', rainfallDataType: 'historic' }));

    await vi.waitFor(() => expect(store.getState().fetchKwargs.legacyGauge.history[0]?.results?.gauge?.[0]?.total).toBe(1.5));
    expect(axios).toHaveBeenCalledTimes(2);
    expect(axios.mock.calls[1][0]).toMatchObject({
      url: 'https://example.test/result.json.gz',
      method: 'GET',
      responseType: 'arraybuffer'
    });
    store.teardown();
  });

  it('repolls once for a fresh artifact URL after a download failure', async () => {
    const store = makeStore('legacyGauge', 'gauge', '15-minute');
    const encode = value => new TextEncoder().encode(JSON.stringify(value)).buffer;
    axios
      .mockResolvedValueOnce({ data: encode({ status: 'finished', data: null, meta: { artifactUrl: 'https://example.test/expired' } }) })
      .mockRejectedValueOnce(new Error('expired'))
      .mockResolvedValueOnce({ data: encode({ status: 'finished', data: null, meta: { artifactUrl: 'https://example.test/fresh' } }) })
      .mockResolvedValueOnce({ data: encode({ status: 'finished', data: [{ id: '9A', data: [{ ts: '2026-01-01T00:00:00Z', val: 2, src: 'G' }] }], args: {}, messages: [] }) });

    store.dispatch(fetchRainfallDataFromApiV2({ contextType: 'legacyGauge', rainfallDataType: 'historic' }));

    await vi.waitFor(() => expect(store.getState().fetchKwargs.legacyGauge.history[0]?.results?.gauge?.[0]?.total).toBe(2));
    expect(axios.mock.calls.map(([request]) => [request.method, request.url])).toEqual([
      ['POST', expect.stringContaining('/v2/gauge/historic15/')],
      ['GET', 'https://example.test/expired'],
      ['POST', expect.stringContaining('/v2/gauge/historic15/')],
      ['GET', 'https://example.test/fresh']
    ]);
    store.teardown();
  });

  it('falls back to inline artifact streaming when direct S3 delivery is blocked', async () => {
    const store = makeStore('legacyGauge', 'gauge', '15-minute');
    const encode = value => new TextEncoder().encode(JSON.stringify(value)).buffer;
    const completed = { status: 'finished', data: [{ id: '9A', data: [{ ts: '2026-01-01T00:00:00Z', val: 3, src: 'G' }] }], args: {}, messages: [] };
    axios
      .mockResolvedValueOnce({ data: encode({ status: 'finished', data: null, meta: { artifactUrl: 'https://example.test/blocked', inlineUrl: '/inline/' } }) })
      .mockRejectedValueOnce(new Error('cors'))
      .mockResolvedValueOnce({ data: encode({ status: 'finished', data: null, meta: { artifactUrl: 'https://example.test/fresh-but-blocked', inlineUrl: '/inline/' } }) })
      .mockRejectedValueOnce(new Error('cors'))
      .mockResolvedValueOnce({ data: encode(completed) });

    store.dispatch(fetchRainfallDataFromApiV2({ contextType: 'legacyGauge', rainfallDataType: 'historic' }));

    await vi.waitFor(() => expect(store.getState().fetchKwargs.legacyGauge.history[0]?.results?.gauge?.[0]?.total).toBe(3));
    expect(axios.mock.calls.at(-1)[0]).toMatchObject({
      url: '/inline/', method: 'GET', responseType: 'arraybuffer'
    });
    store.teardown();
  });

  it.each([
    [{ status: 'queued', meta: {} }, 'error'],
    [{ status: 'does not exist', messages: ['Missing job'] }, 'does not exist'],
    [{ status: 'failed', messages: ['Failed job'] }, 'failed'],
    [{ status: 'finished', data: null, messages: ['No data'] }, 'error']
  ])('preserves failure status for %j', async (envelope, expected) => {
    const store = makeStore('legacyGauge', 'gauge', '15-minute');
    axios.mockResolvedValue({ data: new TextEncoder().encode(JSON.stringify(envelope)).buffer });
    store.dispatch(fetchRainfallDataFromApiV2({ contextType: 'legacyGauge', rainfallDataType: 'historic' }));
    await vi.waitFor(() => expect(store.getState().fetchKwargs.legacyGauge.history[0]?.status).toBe(expected));
    expect(axios.mock.calls[0][0].responseType).toBe('arraybuffer');
    store.teardown();
  });
  it('ignores a replaced response that arrives after the latest query completed', async () => {
    const store = makeStore('legacyGauge', 'gauge', '15-minute');
    let oldResolve;
    axios.mockImplementationOnce(() => new Promise(resolve => { oldResolve = resolve; }));
    const response = val => ({ data: new TextEncoder().encode(JSON.stringify({ status: 'finished', data: [{ id: '9A', data: [{ ts: '2026-01-01T00:00:00Z', val, src: 'G' }] }] })).buffer });
    axios.mockResolvedValue(response(2));
    const request = { contextType: 'legacyGauge', rainfallDataType: 'historic' };
    store.dispatch(fetchRainfallDataFromApiV2(request));
    store.dispatch(fetchRainfallDataFromApiV2(request));
    await vi.waitFor(() => expect(store.getState().fetchKwargs.legacyGauge.history[0]?.results.gauge[0].total).toBe(2));
    oldResolve(response(99)); await Promise.resolve(); await Promise.resolve();
    expect(store.getState().fetchKwargs.legacyGauge.history[0].results.gauge[0].total).toBe(2);
    expect(store.getState().fetchKwargs.legacyGauge.history[0].isFetching).toBe(0);
    store.teardown();
  });
});
