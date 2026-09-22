// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { unparse } from 'papaparse';
import { createResultsEngine } from './engine';
import { buildDownloadRowsAndFields, buildSwmmInpSnippet } from '../components/sidebar/downloadTableUtils';
const finish = iterator => { let step; do { step = iterator.next(); } while (!step.done); return step.value; };
const buffer = data => new TextEncoder().encode(JSON.stringify({ status: 'finished', data })).buffer;
const point = (ts, val, src = 'G', extra = {}) => ({ ts, val, src, ...extra });
function load(results) {
  const engine = createResultsEngine();
  const handles = {};
  const summaries = {};
  for (const [sensor, data] of Object.entries(results)) {
    handles[sensor] = sensor;
    summaries[sensor] = finish(engine.ingest({ buffer: buffer(data), handle: sensor, sensor })).data;
  }
  return { engine, handles, summaries };
}
describe('worker result ownership and exports', () => {
  const results = {
    pixel: [{ id: '100', data: [point('2025-11-02T01:15:00-05:00', 0, ['R', 'N/D'], { quality: 'quoted,"value"\nline' }), point('2025-03-09T03:00:00-04:00', null, 'N/D')] }],
    gauge: [{ id: '9A', data: [point('2025-11-02T01:15:00-04:00', 1.23456789), point('2025-10-01', 0.5), point('2025-10-01T00:00:00-04:00/2025-10-01T01:00:00-04:00', 0.2)] }, { id: '8', data: [point('invalid', null)] }]
  };
  it('returns only summaries, counts zero, retains nulls, and releases timestamps', () => {
    const { engine, summaries, handles } = load(results);
    expect(summaries.pixel[0]).toEqual({ id: '100', total: 0, recordCount: 2, validCount: 1, missingCount: 1 });
    expect(JSON.stringify(summaries)).not.toContain('"data":');
    expect(engine.inspect().timestamps).toBe(8);
    engine.dispose(Object.values(handles));
    expect(engine.inspect()).toEqual({ datasets: 0, timestamps: 0 });
  });
  it.each(['csv', 'swmm'])('%s is byte-equivalent to the original exporter', async format => {
    const { engine, handles } = load(results);
    const actual = finish(engine.export({ handles, format, rollup: '15-minute' }));
    const table = buildDownloadRowsAndFields(results);
    const expected = format === 'csv' ? unparse({ fields: table.fields, data: table.rows }) : buildSwmmInpSnippet(results, { rollup: '15-minute' });
    expect(await actual.blob.text()).toBe(expected);
  });
  it('caches distinct timestamps across sensors', () => {
    const data = Array.from({ length: 165 }, (_, id) => ({ id, data: [point('2026-06-01T00:00:00-04:00', id)] }));
    const { engine, handles } = load({ pixel: data });
    expect(engine.inspect().timestamps).toBe(1);
    finish(engine.preview({ handles, mode: 'averageByType', selected: [], rollup: '5-minute' }));
    finish(engine.export({ handles, format: 'csv', rollup: '5-minute' }));
    expect(engine.inspect().timestamps).toBe(1);
  });
});
describe('bounded rainfall previews', () => {
  it('averages at each timestamp then sums; null sensors do not dilute zero or rainfall', () => {
    const dates = Array.from({ length: 1001 }, (_, i) => new Date(Date.UTC(2026, 5, 1, 0, (i + 1) * 5)).toISOString());
    const { engine, handles } = load({ gauge: [
      { id: '1', data: dates.map((ts, i) => point(ts, i === 0 ? 2 : i === 1 ? 4 : null)) },
      { id: '2', data: dates.map((ts, i) => point(ts, i === 0 ? 0 : null)) }
    ] });
    const preview = finish(engine.preview({ handles, mode: 'averageByType', selected: [], rollup: '5-minute' }));
    expect(preview.interval).toBe('15-minute');
    expect(preview.rows.length).toBeLessThanOrEqual(1000);
    // 00:05 + 00:10 averages sum to 5, rather than mean(sensor totals) = 3.
    expect(preview.rows.filter(r => r['avg:gauge'] !== null).map(r => r['avg:gauge'])).toEqual([5]);
    expect(preview.rows[0].coverage['avg:gauge']).toEqual({ contributing: 3, expected: 6, timestamps: 3 });
    expect(preview.rows.at(-1)['avg:gauge']).toBeNull();
  });
  it('includes every selected sensor, keeps both offset-bearing fall-back instants and all-null totals', () => {
    const data = Array.from({ length: 12 }, (_, id) => ({ id, data: [point('2025-11-02T01:15:00-04:00', 0), point('2025-11-02T01:15:00-05:00', null)] }));
    const { engine, handles } = load({ pixel: data });
    const preview = finish(engine.preview({ handles, mode: 'perSensor', selected: data.map(s => `pixel:${s.id}`), rollup: '15-minute' }));
    expect(preview.series).toHaveLength(12);
    expect(preview.rows).toHaveLength(2);
    expect(preview.rows[1].timestampMs - preview.rows[0].timestampMs).toBe(3600000);
    expect(preview.rows[1]['pixel:0']).toBeNull();
    const total = load({ gauge: [{ id: '1', data: [point('2025-10-01T00:00:00-04:00/2025-11-01T00:00:00-04:00', null)] }] });
    expect(finish(total.engine.preview({ handles: total.handles, mode: 'averageByType', selected: [], rollup: 'Total' })).rows[0]['avg:gauge']).toBeNull();
  });
  it('filters chart dates in Eastern time without changing export data', async () => {
    const { engine, handles } = load({ gauge: [{ id: 1, data: [point('2026-06-01T00:00:00Z', 1), point('2026-06-01T12:00:00Z', 2)] }] });
    const preview = finish(engine.preview({ handles, mode: 'averageByType', selected: [], rollup: '15-minute', range: { start: '2026-06-01', end: '2026-06-01' } }));
    expect(preview.rows).toHaveLength(1);
    const csv = await finish(engine.export({ handles, format: 'csv', rollup: '15-minute' })).blob.text();
    expect(csv.split('\r\n')).toHaveLength(3);
  });
});

it.each([
  ['2025-03-01T00:00:00-05:00', '2025-03-09T00:00:00-05:00', 23],
  ['2025-10-20T00:00:00-04:00', '2025-11-02T00:00:00-04:00', 25]
])('uses Eastern day boundaries through DST from %s', (start, target, expected) => {
  const epoch = Date.parse(start);
  const data = Array.from({ length: 1100 }, (_, i) => {
    const from = new Date(epoch + i * 3600000).toISOString();
    const to = new Date(epoch + (i + 1) * 3600000).toISOString();
    return point(`${from}/${to}`, 1);
  });
  const { engine, handles } = load({ gauge: [{ id: 1, data }] });
  const preview = finish(engine.preview({ handles, mode: 'averageByType', selected: [], rollup: 'Hourly' }));
  expect(preview.interval).toBe('daily');
  expect(preview.rows.find(r => r.timestampMs === Date.parse(target))['avg:gauge']).toBe(expected);
});

it('calendar daily observations aggregate to months without moving into the preceding day', () => {
  const data = Array.from({ length: 1001 }, (_, i) => point(new Date(Date.UTC(2023, 0, i + 1)).toISOString().slice(0, 10), 1));
  const { engine, handles } = load({ gauge: [{ id: 1, data }] });
  const preview = finish(engine.preview({ handles, mode: 'averageByType', selected: [], rollup: 'Daily' }));
  expect(preview.interval).toBe('monthly');
  expect(preview.rows[0]).toMatchObject({ timestampMs: Date.parse('2023-01-01T00:00:00-05:00'), 'avg:gauge': 31 });
});
it('keeps canonical sensor identity when an observation has an extra id field', () => {
  const { summaries } = load({ gauge: [{ id: '8', data: [point('2026-06-01T00:00:00Z', 1, 'G', { id: 'observation-id' })] }] });
  expect(summaries.gauge[0].id).toBe('8');
});
it('uses exact zoom instants rather than expanding them to Eastern calendar days', () => {
  const data = [point('2025-11-02T01:15:00-04:00', 1), point('2025-11-02T01:15:00-05:00', 2)];
  const { engine, handles } = load({ gauge: [{ id: 1, data }] });
  const preview = finish(engine.preview({ handles, mode: 'averageByType', selected: [], rollup: '15-minute', range: {
    startMs: Date.parse('2025-11-02T01:00:00-05:00'), endMs: Date.parse('2025-11-02T01:30:00-05:00')
  } }));
  expect(preview.rows).toHaveLength(1);
  expect(preview.rows[0]['avg:gauge']).toBe(2);
});

describe('columnar response shape (f=*_columnar)', () => {
  const toColumnar = rows => {
    if (!rows.length) return {};
    const fields = Object.keys(rows[0]);
    return Object.fromEntries(fields.map(field => [field, rows.map(row => row[field])]));
  };
  it('produces identical summaries to the row-of-dicts shape', () => {
    const rows = { pixel: [{ id: '100', data: [point('2025-11-02T01:15:00-05:00', 0), point('2025-11-02T01:30:00-05:00', null, 'N/D')] }] };
    const columnar = { pixel: rows.pixel.map(({ id, data }) => ({ id, data: toColumnar(data) })) };
    expect(load(columnar).summaries).toEqual(load(rows).summaries);
  });
  it('treats an empty columnar group the same as an empty row-of-dicts group', () => {
    const rows = { pixel: [{ id: '100', data: [] }] };
    const columnar = { pixel: [{ id: '100', data: {} }] };
    expect(load(columnar).summaries).toEqual(load(rows).summaries);
  });
});

