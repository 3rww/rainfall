import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import axios from 'axios';
import { initialState } from '../initialState';
import { rootReducer } from '../rootReducer';
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
  return configureStore({ reducer: rootReducer, preloadedState: state });
};

describe('historic requests', () => {
  for (const [context, sensor] of [['legacyGauge', 'gauge'], ['legacyGarr', 'pixel']]) {
    for (const rollup of ['15-minute', 'Hourly', 'Daily', 'Total', '5-minute']) {
      it(`${context} ${rollup} uses its parquet endpoint and canonical results`, async () => {
        const store = makeStore(context, sensor, rollup);
        const data = [{ id: '9A', data: [{ ts: '2025-02-01T00:00:00Z', val: null, src: 'N/D' }] }];
        axios.mockResolvedValue({ data: { status: 'finished', data, args: {}, messages: [] } });
        store.dispatch(fetchRainfallDataFromApiV2({ contextType: context, rainfallDataType: 'historic' }));
        await vi.waitFor(() => expect(store.getState().fetchKwargs[context].history[0]?.results?.[sensor]?.[0]?.total).toBeNull());
        const request = axios.mock.calls[0][0];
        expect(request.url).toContain(`/v2/${sensor}/${rollup === '5-minute' ? 'historic5' : 'historic15'}/`);
        expect(request.data.f).toBe('sensor');
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
