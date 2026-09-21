// Worker-owned observations. Generators yield bounded batches to the scheduler.
import { unparse } from 'papaparse';
import { toDateTime } from '../store/utils/dateTime';
import {
  normalizeDownloadRow, parseDownloadTimestamp, formatExcelDateTimeInEastern, sanitizeSwmmIdentifier,
  getSwmmIntervalFromRollup, PREFERRED_FIELD_ORDER
} from '../components/sidebar/downloadTableUtils';

const ZONE = 'America/New_York';
const BATCH = 4096;
const numeric = value => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
const label = type => type[0].toUpperCase() + type.slice(1);
const intervals = ['5-minute', '15-minute', 'hourly', 'daily', 'monthly', 'yearly'];
const minutes = { '5-minute': 5, '15-minute': 15, hourly: 60 };

export function createResultsEngine() {
  const datasets = new Map();
  function entries(handles) {
    return Object.entries(handles).map(([type, handle]) => {
      const dataset = datasets.get(handle);
      if (!dataset) throw new Error('Detailed results are unavailable. Please rerun this query.');
      return { type, ...dataset };
    });
  }
  // Shared across sensors, but owned by a dataset so deletion releases all references.
  function timestamp(dataset, raw) {
    if (!dataset.timestamps.has(raw)) {
      const parts = typeof raw === 'string' ? raw.split('/') : [];
      let parsed = null;
      if (parts.length === 2) {
        const start = timestamp(dataset, parts[0].trim()).parsed;
        const end = timestamp(dataset, parts[1].trim()).parsed;
        parsed = start && end ? start : null;
      } else if (parts.length === 1) parsed = parseDownloadTimestamp(raw);
      dataset.timestamps.set(raw, { parsed, ms: parsed?.valueOf() ?? null });
    }
    return dataset.timestamps.get(raw);
  }
  function csvTimestamp(dataset, raw) {
    const stamp = timestamp(dataset, raw);
    if (!stamp.csv) stamp.csv = normalizeDownloadRow({ ts: raw }, value => {
      const entry = timestamp(dataset, value);
      if (entry.excel === undefined) entry.excel = entry.ms === null ? null : formatExcelDateTimeInEastern(new Date(entry.ms));
      return entry.excel;
    });
    return stamp.csv;
  }
  function csvRow(dataset, point, id, type) {
    const row = { ...point, id, type };
    const formatted = csvTimestamp(dataset, point.ts);
    if (!Object.hasOwn(formatted, 'ts')) delete row.ts;
    return { ...row, ...formatted };
  }
  function* ingest({ buffer, handle, sensor, contextType }) {
    const response = JSON.parse(new TextDecoder().decode(buffer));
    const envelope = { status: response.status, messages: response.messages || [], args: response.args || {}, meta: response.meta || {} };
    if (response.status !== 'finished' || response.data === null) return { ...envelope, data: null };
    const data = Array.isArray(response.data) ? response.data : [];
    const dataset = { series: [], timestamps: new Map(), observationTimes: new Set() };
    const grouped = new Map();
    let processed = 0;
    // Support the legacy historic5 rainfall field without flattening the dataset.
    for (const row of data) {
      const points = Array.isArray(row.data) ? row.data : [row];
      for (const original of points) {
        const id = Array.isArray(row.data) && !Object.hasOwn(original, 'rainfall') ? row.id : original.id ?? row.id;
        if (id == null) continue;
        const key = `${typeof id}:${id}`;
        if (!grouped.has(key)) grouped.set(key, { id, data: [], total: null, recordCount: 0, validCount: 0 });
        const series = grouped.get(key);
        const point = Object.hasOwn(original, 'rainfall') ? {
          ts: original.ts, val: original.rainfall,
          src: contextType === 'legacyGauge' ? 'G' : contextType === 'legacyGarr' ? null : original.src ?? null
        } : original;
        series.data.push(point);
        series.recordCount++;
        if (typeof point.val === 'number' && Number.isFinite(point.val) && point.val >= 0) {
          series.total = (series.total ?? 0) + point.val;
          series.validCount++;
        }
        dataset.observationTimes.add(point.ts);
        timestamp(dataset, point.ts);
        if (++processed % BATCH === 0) yield { processed };
      }
      // Empty canonical sensors still have a summary.
      if (row.id != null && row.id !== '' && Array.isArray(row.data) && !row.data.length) grouped.set(`${typeof row.id}:${row.id}`, { id: row.id, data: [], total: null, recordCount: 0, validCount: 0 });
    }
    dataset.series = [...grouped.values()];
    const summary = dataset.series.map(({ data: ignored, ...rest }) => ({ ...rest, missingCount: rest.recordCount - rest.validCount }));
    datasets.set(handle, dataset);
    return { ...envelope, data: summary, handle, sensor };
  }
  // Native end labels belong to the preceding accumulation period when coarsened.
  function bucketTime(stamp, interval, native) {
    if (interval === native || native === 'total') return stamp.ms;
    const ms = stamp.ms - (minutes[native] && native !== 'hourly' ? 1 : 0);
    if (minutes[interval]) return (Math.floor(ms / (minutes[interval] * 60000)) + 1) * minutes[interval] * 60000;
    const eastern = toDateTime(ms).tz(ZONE);
    const unit = interval === 'daily' ? 'day' : interval === 'monthly' ? 'month' : 'year';
    return eastern.startOf(unit).valueOf();
  }
  function* preview({ handles, mode, selected, range, rollup }) {
    const all = entries(handles);
    const native = rollup.toLowerCase();
    const start = Number.isFinite(range?.startMs) ? range.startMs : range?.start ? toDateTime(range.start).tz(ZONE, true).startOf('day').valueOf() : -Infinity;
    const end = Number.isFinite(range?.endMs) ? range.endMs : range?.end ? toDateTime(range.end).tz(ZONE, true).endOf('day').valueOf() : Infinity;
    const grid = new Map();
    let processed = 0;
    for (const dataset of all) for (const raw of dataset.observationTimes) {
      const stamp = timestamp(dataset, raw);
      if (stamp.ms !== null && stamp.ms >= start && stamp.ms <= end) grid.set(stamp.ms, stamp);
      if (++processed % BATCH === 0) yield { processed };
    }
    const times = [...grid.keys()].sort((a, b) => a - b);
    let interval = native;
    let bucketByTime;
    const candidates = native === 'total' ? ['total'] : intervals.slice(Math.max(0, intervals.indexOf(native)));
    for (const candidate of candidates) {
      bucketByTime = new Map();
      const buckets = new Set();
      for (const time of times) {
        const bucket = native === 'total' ? times[0] : bucketTime(grid.get(time), candidate, native);
        bucketByTime.set(time, bucket);
        buckets.add(bucket);
        if (++processed % BATCH === 0) yield { processed };
      }
      interval = candidate;
      if (buckets.size <= 1000) break;
    }
    if (new Set(bucketByTime.values()).size > 1000) throw new Error('Choose a shorter chart date range.');
    const rows = new Map();
    for (const time of new Set(bucketByTime.values())) rows.set(time, { timestampMs: time, coverage: {} });
    const series = [];
    const selectedSet = new Set(selected);
    for (const dataset of all) {
      const targets = mode === 'averageByType' ? [{ key: `avg:${dataset.type}`, label: `${label(dataset.type)} Average`, sensors: dataset.series }]
        : dataset.series.filter(s => selectedSet.has(`${dataset.type}:${s.id}`)).map(s => ({ key: `${dataset.type}:${s.id}`, label: `${label(dataset.type)} ${s.id}`, sensors: [s] }));
        const typeGrid = new Set();
        for (const s of dataset.series) for (const p of s.data) {
          const ms = timestamp(dataset, p.ts).ms;
          if (bucketByTime.has(ms)) typeGrid.add(ms);
          if (++processed % BATCH === 0) yield { processed };
        }

      for (const target of targets) {
        series.push({ key: target.key, label: target.label });
        // Average available sensors at each original timestamp BEFORE bucket summation.
        const readings = new Map();
        for (const s of target.sensors) for (const p of s.data) {
          const ms = timestamp(dataset, p.ts).ms;
          const value = numeric(p.val);
          if (bucketByTime.has(ms) && value !== null) {
            const item = readings.get(ms) || { sum: 0, count: 0 };
            item.sum += value; item.count++;
            readings.set(ms, item);
          }
          if (++processed % BATCH === 0) yield { processed };
        }
        for (const row of rows.values()) { row[target.key] = null; row.coverage[target.key] = { contributing: 0, expected: 0, timestamps: 0 }; }
        for (const ms of typeGrid) {
          const row = rows.get(bucketByTime.get(ms));
          const reading = readings.get(ms);
          const coverage = row.coverage[target.key];
          coverage.expected += target.sensors.length; coverage.timestamps++;
          if (reading) {
            row[target.key] = (row[target.key] ?? 0) + (mode === 'averageByType' ? reading.sum / reading.count : reading.sum);
            coverage.contributing += reading.count;
          }
        }
      }
    }
    const result = [...rows.values()].sort((a, b) => a.timestampMs - b.timestampMs);
    for (const row of result) for (const s of series) if (row[s.key] != null) row[s.key] = Number(row[s.key].toFixed(3));
    return { rows: result, series, interval, native, range: range || {} };
  }
  function* exportData({ handles, format, rollup }) {
    const all = entries(handles);
    let processed = 0;
    const total = all.reduce((n, d) => n + d.series.reduce((m, s) => m + s.data.length, 0), 0);
    const parts = [];
    if (format === 'csv') {
      const keys = new Set();
      for (const dataset of all) for (const s of dataset.series) for (const p of s.data) {
        for (const key of Object.keys(csvRow(dataset, p, s.id, dataset.type))) keys.add(key);
        if (++processed % BATCH === 0) yield { processed, total: total * 2 };
      }
      const fields = [...PREFERRED_FIELD_ORDER.filter(k => keys.has(k)), ...[...keys].filter(k => !PREFERRED_FIELD_ORDER.includes(k))];
      let chunk = [];
      const flush = () => {
        if (!chunk.length) return;
        parts.push((parts.length ? '\r\n' : '') + unparse({ fields, data: chunk }, { header: !parts.length }));
        chunk = [];
      };
      for (const dataset of all) for (const s of dataset.series) for (const p of s.data) {
        chunk.push(csvRow(dataset, p, s.id, dataset.type));
        if (++processed % BATCH === 0) { flush(); yield { processed, total: total * 2 }; }
      }
      flush();
      return { blob: new Blob(parts, { type: 'application/csv' }), filename: 'rainfall.csv' };
    }
    const ordered = [];
    for (const dataset of all) for (const s of dataset.series) {
      if (s.id == null || s.id === '') continue;
      const indices = [];
      for (let i = 0; i < s.data.length; i++) {
        const p = s.data[i];
        if (numeric(p.val) !== null && timestamp(dataset, p.ts).ms !== null) indices.push(i);
        if (++processed % BATCH === 0) yield { processed, total: total * 2 };
      }
      indices.sort((a, b) => timestamp(dataset, s.data[a].ts).ms - timestamp(dataset, s.data[b].ts).ms);
      if (indices.length) ordered.push({ dataset, s, indices, key: sanitizeSwmmIdentifier(`${dataset.type}_${s.id}`) });
    }
    ordered.sort((a, b) => a.dataset.type.localeCompare(b.dataset.type) || natural(a.s.id, b.s.id));
    parts.push(';;Rainfall export for EPA SWMM\n;;Generated by the 3RWW Rainfall app\n\n[RAINGAGES]\n;;Name Form Intvl SCF DataSource SourceName');
    if (!ordered.length) parts.push('\n;;No valid rainfall rows available.');
    for (const { key } of ordered) parts.push(`\nRG_${key} VOLUME ${getSwmmIntervalFromRollup(rollup)} 1.0 TIMESERIES TS_${key}`);
    parts.push('\n\n[TIMESERIES]\n;;Name Date Time Value');
    if (!ordered.length) parts.push('\n;;No valid rainfall rows available.');
    let lines = [];
    for (const { dataset, s, indices, key } of ordered) for (const i of indices) {
      const p = s.data[i];
      const stamp = timestamp(dataset, p.ts);
      stamp.swmm ??= stamp.parsed.format('MM/DD/YYYY HH:mm');
      lines.push(`\nTS_${key} ${stamp.swmm} ${Number(Number(p.val).toFixed(6))}`);
      if (++processed % BATCH === 0) { parts.push(lines.join('')); lines = []; yield { processed, total: total * 2 }; }
    }
    parts.push(lines.join(''));
    return { blob: new Blob(parts, { type: 'text/plain;charset=utf-8' }), filename: 'rainfall_swmm.inp' };
  }
  return {
    ingest, preview, export: exportData,
    dispose(handles) { for (const handle of handles) datasets.delete(handle); },
    inspect() { return { datasets: datasets.size, timestamps: [...datasets.values()].reduce((n, d) => n + d.timestamps.size, 0) }; }
  };
}
