import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { deflateSync, inflateSync } from 'node:zlib';
import { rootReducer } from './rootReducer';
import { initialState } from './initialState';
import { getIntervalOptionsForContext } from './config';
import { buildRainfallShareUrl, buildShareStateFromQuery, decodeShareState, encodeShareState, hydrateShareStateToRedux } from './urlShareState';
import fixtures from './fixtures/rainfallShareState.json';

const payload = { v: 2, c: 'legacyGarr', g: [], p: ['100'], rollup: '15-minute',
  startDt: '2025-10-01T04:00:00.000Z', endDt: '2025-10-01T05:00:00.000Z' };
const raw = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function fixture() {
  const state = structuredClone(initialState);
  state.stats.latest = { 'earliest-realtime-radar': '2025-01-01T00:00:00Z', 'earliest-realtime-gauge': '2025-01-01T00:00:00Z', 'realtime-radar': '2026-01-01T00:00:00Z', 'realtime-gauge': '2026-01-01T00:00:00Z' };
  for (const sensor of ['radar', 'gauge']) for (const resolution of ['5', '15']) {
    state.stats.latest[`earliest-${resolution}min-calibrated-${sensor}`] = '2025-01-01T00:00:00Z';
    state.stats.latest[`latest-${resolution}min-calibrated-${sensor}`] = '2026-01-01T00:00:00Z';
  }
  state.mapStyle.sources = Object.fromEntries(['pixel', 'gauge'].map(sensor => [sensor, {
    type: 'geojson', data: { type: 'FeatureCollection', features: [{ id: '100', properties: { id: '100', name: 'Known' } }] }
  }]));
  const actions = [];
  const store = configureStore({ reducer: rootReducer, preloadedState: state,
    middleware: getDefault => getDefault().concat(() => next => action => { actions.push(action); return next(action); }) });
  return { store, actions, hydrate: value => hydrateShareStateToRedux({ ...store, hash: `#s=${raw(value)}` }) };
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('version 2 URL contract', () => {
  for (const example of fixtures) it(`reads both shared contract fixtures: ${example.name}`, async () => {
    expect(await decodeShareState(example.compressed)).toEqual(example.payload);
    expect(await decodeShareState(example.fallback)).toEqual(example.payload);
    const encoded = await encodeShareState(example.payload);
    expect(JSON.parse(inflateSync(Buffer.from(encoded, 'base64url')))).toEqual(example.payload);
  });
  for (const c of ['legacyGauge', 'legacyGarr', 'legacyRealtime']) {
    for (const rollup of getIntervalOptionsForContext(c)) it(`hydrates ${c}/${rollup} including unknown IDs`, async () => {
      const { store, actions, hydrate } = fixture();
      const value = { ...payload, c, rollup, g: c !== 'legacyGarr' ? ['008', '100'] : [], p: c !== 'legacyGauge' ? ['100', 'missing'] : [] };
      expect(await decodeShareState(await encodeShareState(value))).toEqual(value);
      const beforeUrl = window.location.href;
      expect(await hydrate(value)).toBe(true);
      const state = store.getState();
      expect(state.progress.tab).toBe(c);
      expect(state.fetchKwargs[c].active).toMatchObject({ startDt: value.startDt, endDt: value.endDt, rollup });
      expect(state.fetchKwargs[c].active.sensorLocations.gauge.map(o => o.value)).toEqual(value.g);
      expect(state.fetchKwargs[c].active.sensorLocations.pixel.map(o => o.value)).toEqual(value.p);
      expect(state.progress.queryImportNotice.message).toContain('IDs are retained');
      expect(actions.some(a => a.type.includes('requestRainfall'))).toBe(false);
      expect(window.location.href).toBe(beforeUrl);
    });
  }
  it('round trips fallback without compression APIs', async () => {
    vi.stubGlobal('CompressionStream', undefined);
    vi.stubGlobal('DecompressionStream', undefined);
    expect(JSON.parse(Buffer.from(await encodeShareState(payload), 'base64url'))).toEqual(payload);
    expect(await decodeShareState(await encodeShareState(payload))).toEqual(payload);
  });
  it('compresses a large UTF-8 selection without truncation', async () => {
    const value = { ...payload, p: [...Array.from({ length: 10000 }, (_, i) => String(i)), 'é'].sort() };
    const encoded = await encodeShareState(value);
    expect(encoded.length).toBeLessThan(raw(value).length);
    expect(await decodeShareState(encoded)).toEqual(value);
  });
  it('preserves DST instants, milliseconds and equal start/end times under existing range rules', async () => {
    const { store, hydrate } = fixture();
    for (const [startDt, endDt] of [['2025-11-02T05:00:00.001Z', '2025-11-02T06:01:59.999Z'], ['2025-10-01T04:01:00.000Z', '2025-10-01T04:01:00.000Z']]) {
      await hydrate({ ...payload, startDt, endDt });
      expect(store.getState().fetchKwargs.legacyGarr.active).toMatchObject({ startDt, endDt });
    }
  });
  it.each([{ v: 1 }, { c: '__proto__' }, { rollup: '60' }, { c: 'legacyRealtime', rollup: '5-minute' },
    { g: ['8'] }, { p: [] }, { p: [8] }, { p: ['1,2'] }, { p: [''] },
    { startDt: '2025-02-30T00:00:00Z' }, { startDt: '2025-10-01T04:00:00' },
    { startDt: '2025-10-02T04:00:00Z' }, { endDt: '2027-01-01T00:00:00Z' }, { startDt: '2024-01-01T00:00:00Z' }
  ])('leaves defaults for invalid or unavailable selection %j', async changes => {
    const { store, hydrate } = fixture();
    const before = store.getState().fetchKwargs;
    await hydrate({ ...payload, ...changes });
    expect(store.getState().fetchKwargs).toBe(before);
    expect(store.getState().progress.queryImportNotice.variant).toBe('danger');
  });
  it('explains unavailable metadata, malformed, empty and duplicate tokens', async () => {
    const { store } = fixture();
    for (const hash of ['#s=', '#s=bad!', '#s=e30&s=e30', '#s=eA', `#s=${raw(payload)}`]) {
      await hydrateShareStateToRedux({ ...store, getState: () => ({ ...store.getState(), stats: { latest: {} } }), hash });
      expect(store.getState().progress.queryImportNotice.variant).toBe('danger');
    }
    expect(await hydrateShareStateToRedux({ ...store, hash: '#query=old' })).toBe(false);
    expect(await hydrateShareStateToRedux({ ...store, hash: '' })).toBe(false);
  });
  it('rejects realtime links when availability is missing for a selected sensor type', async () => {
    const { store } = fixture();
    const before = store.getState().fetchKwargs;
    await hydrateShareStateToRedux({ ...store,
      getState: () => ({ ...store.getState(), stats: { latest: { 'realtime-radar': '2026-01-01T00:00:00Z' } } }),
      hash: `#s=${raw({ ...payload, c: 'legacyRealtime', g: ['100'] })}` });
    expect(store.getState().fetchKwargs).toBe(before);
    expect(store.getState().progress.queryImportNotice.message).toContain('Availability');
  });
  it('uses the current origin and configured deployment base, excluding current search/hash', async () => {
    vi.stubEnv('BASE_URL', '/rainfall/');
    const snapshot = { ...payload, sensorLocations: { gauge: [], pixel: [{ value: '100' }] } };
    const url = new URL(await buildRainfallShareUrl(payload.c, snapshot));
    expect(url.origin).toBe(window.location.origin);
    expect(url.pathname).toBe('/rainfall/');
    expect(url.search).toBe('');
    expect(await decodeShareState(Buffer.from(' \n' + JSON.stringify(payload, null, 2)).toString('base64url'))).toEqual(payload);
  });
  it('decodes externally compressed JSON and builds a snapshot link using the deployment base', async () => {
    const snapshot = { startDt: payload.startDt, endDt: payload.endDt, rollup: payload.rollup,
      sensorLocations: { gauge: [], pixel: [{ value: '100', label: 'Pixel' }] } };
    expect(buildShareStateFromQuery(payload.c, snapshot)).toEqual(payload);
    const before = window.location.href;
    const url = new URL(await buildRainfallShareUrl(payload.c, snapshot, 'https://example.com/rainfall/'));
    expect(url.origin + url.pathname).toBe('https://example.com/rainfall/');
    expect(await decodeShareState(new URLSearchParams(url.hash.slice(1)).get('s'))).toEqual(payload);
    expect(window.location.href).toBe(before);
    expect(await decodeShareState(deflateSync(Buffer.from(JSON.stringify(payload))).toString('base64url'))).toEqual(payload);
  });
});
