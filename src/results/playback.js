import { parseDownloadTimestamp, formatExcelDateTimeInEastern } from '../components/sidebar/downloadTableUtils';

export const validRainfall = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function playbackInterval(raw, rollup) {
  if (typeof raw !== 'string') return null;
  const parts = raw.split('/');
  const start = parseDownloadTimestamp(parts[0].trim());
  if (!start?.isValid()) return null;
  let startMs = start.valueOf();
  let endMs = startMs;
  let label;
  if (parts.length === 2) {
    const end = parseDownloadTimestamp(parts[1].trim());
    if (!end?.isValid()) return null;
    endMs = end.valueOf();
  } else if (rollup === '5-minute' || rollup === '15-minute') {
    startMs -= (rollup === '5-minute' ? 5 : 15) * 60000;
  } else if (rollup === 'daily') {
    // Reparse the next calendar date so DST days retain their actual length.
    endMs = parseDownloadTimestamp(start.add(1, 'day').format('YYYY-MM-DD')).valueOf();
    label = `${start.format('YYYY-MM-DD')} (Eastern)`;
  }
  label ||= `${formatExcelDateTimeInEastern(new Date(startMs))} – ${formatExcelDateTimeInEastern(new Date(endMs))}`;
  return { key: `${startMs}/${endMs}`, startMs, endMs, label };
}

// Sparse indexes and prefix sums stay in the worker. No dense sensor × time matrix.
export function createPlaybackEngine(entries) {
  const sessions = new Map();
  function* preparePlayback({ handles, rollup, session }) {
    const intervals = new Map();
    const parsedIntervals = new Map();
    const sensors = [];
    let processed = 0;
    for (const dataset of entries(handles)) {
      for (const series of dataset.series) {
        const readings = new Map();
        for (const point of series.data) {
          if (!parsedIntervals.has(point.ts)) parsedIntervals.set(point.ts, playbackInterval(point.ts, rollup.toLowerCase()));
          const interval = parsedIntervals.get(point.ts);
          if (interval) {
            intervals.set(interval.key, interval);
            const previous = readings.get(interval.key) ?? null;
            readings.set(interval.key, validRainfall(point.val) ? (previous ?? 0) + point.val : previous);
          }
          if (++processed % 4096 === 0) yield { processed };
        }
        sensors.push({ source: dataset.type, id: String(series.id), readings });
      }
    }
    const timeline = [...intervals.values()].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
    const positions = new Map(timeline.map((entry, index) => [entry.key, index]));
    for (const sensor of sensors) {
      sensor.points = [...sensor.readings].map(([key, value]) => ({ index: positions.get(key), value })).sort((a, b) => a.index - b.index);
      let sum = null;
      for (const point of sensor.points) {
        if (point.value !== null) sum = (sum ?? 0) + point.value;
        point.sum = sum;
        if (++processed % 4096 === 0) yield { processed };
      }
      delete sensor.readings;
    }
    // All-sensor average per interval, and its running total, for the toolbar sparkline.
    const intervalTotal = new Float64Array(timeline.length);
    const intervalCount = new Int32Array(timeline.length);
    for (const sensor of sensors) {
      for (const point of sensor.points) {
        if (point.value === null) continue;
        intervalTotal[point.index] += point.value;
        intervalCount[point.index]++;
        if (++processed % 4096 === 0) yield { processed };
      }
    }
    const interval = new Array(timeline.length);
    const cumulative = new Array(timeline.length);
    let runningSum = null;
    for (let index = 0; index < timeline.length; index++) {
      const value = intervalCount[index] > 0 ? intervalTotal[index] / intervalCount[index] : null;
      interval[index] = value;
      if (value !== null) runningSum = (runningSum ?? 0) + value;
      cumulative[index] = runningSum;
    }
    sessions.set(session, { handles: Object.values(handles), sensors, timeline });
    return { session, timeline, sensors: sensors.map(({ source, id }) => ({ source, id })), summary: { interval, cumulative } };
  }
  function* playbackFrame({ session, index, mode }) {
    const data = sessions.get(session);
    if (!data) throw new Error('Detailed results are unavailable. Please rerun this query.');
    if (!data.timeline[index]) throw new Error('Playback frame is unavailable.');
    const values = [];
    for (const sensor of data.sensors) {
      let low = 0, high = sensor.points.length;
      while (low < high) {
        const mid = (low + high) >>> 1;
        if (sensor.points[mid].index <= index) low = mid + 1;
        else high = mid;
      }
      const point = sensor.points[low - 1];
      const value = mode === 'cumulative' ? point?.sum ?? null : point?.index === index ? point.value : null;
      values.push({ source: sensor.source, id: sensor.id, value });
      if (values.length % 4096 === 0) yield { processed: values.length };
    }
    return { index, interval: data.timeline[index], values };
  }
  function* releasePlayback({ session }) { sessions.delete(session); return null; }
  return {
    preparePlayback, playbackFrame, releasePlayback,
    dispose(handles) { for (const [key, session] of sessions) if (session.handles.some(h => handles.includes(h))) sessions.delete(key); },
    size: () => sessions.size
  };
}
