import { CONTEXT_TYPES, RAINFALL_MIN_DATE, getIntervalOptionsForContext } from './config';
import { resolveAvailableBounds, isRangeWithinBounds } from './utils/dateBounds';
import { importRainfallQuery } from './features/fetchKwargsSlice';
import { highlightSensor } from './features/mapStyleSlice';
import { setQueryImportNotice, switchTab } from './features/progressSlice';
import { selectMapStyleSourceDataFeatures } from './selectors';
import { transformFeatureToOption } from './utils/transformers';

const contexts = new Set([CONTEXT_TYPES.legacyRealtime, CONTEXT_TYPES.legacyGauge, CONTEXT_TYPES.legacyGarr]);
function utc(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)) {
    throw new Error('Dates must be explicit UTC timestamps.');
  }
  const canonical = value.includes('.') ? value : value.replace('Z', '.000Z');
  if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== canonical) {
    throw new Error('The query contains an invalid date.');
  }
  return canonical;
}
function ids(values) {
  if (!Array.isArray(values) || values.some(id => typeof id !== 'string' || !id.trim() || /[,\x00-\x1f]/.test(id))) {
    throw new Error('The query contains invalid sensor IDs.');
  }
  return [...new Set(values)].sort();
}
export function validateShareState(payload) {
  if (payload?.v !== 2) throw new Error('This query link version is not supported.');
  const { c, rollup } = payload;
  if (!contexts.has(c)) throw new Error('The rainfall source is not supported.');
  if (!getIntervalOptionsForContext(c).includes(rollup)) throw new Error('The source does not support this interval.');
  const g = ids(payload.g), p = ids(payload.p);
  if (!(g.length + p.length) || (c === CONTEXT_TYPES.legacyGauge && p.length) || (c === CONTEXT_TYPES.legacyGarr && g.length)) {
    throw new Error('The sensor selection does not match the rainfall source.');
  }
  const startDt = utc(payload.startDt), endDt = utc(payload.endDt);
  if (startDt > endDt) throw new Error('The start date must not follow the end date.');
  return { v: 2, c, g, p, startDt, endDt, rollup };
}

export async function encodeShareState(payload) {
  let bytes = new TextEncoder().encode(JSON.stringify(validateShareState(payload)));
  if (typeof CompressionStream !== 'undefined') {
    bytes = new Uint8Array(await new Response(new Response(bytes).body.pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  }
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function decodeShareState(token) {
  if (!token || !/^[A-Za-z0-9_-]+$/.test(token)) throw new Error('The query link is malformed.');
  let payload;
  try {
    const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    let bytes = Uint8Array.from(atob(base64 + '='.repeat((4 - base64.length % 4) % 4)), c => c.charCodeAt(0));
    const parse = data => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data));
    try {
      payload = parse(bytes);
    } catch {
      if (typeof DecompressionStream === 'undefined') throw new Error('unsupported');
      bytes = new Uint8Array(await new Response(new Response(bytes).body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
      payload = parse(bytes);
    }
  } catch {
    throw new Error('The query link could not be decoded. Try a browser with compression support.');
  }
  return validateShareState(payload);
}

export function buildShareStateFromQuery(contextType, query) {
  return validateShareState({ v: 2, c: contextType,
    g: (query.sensorLocations.gauge || []).map(option => String(option.value)),
    p: (query.sensorLocations.pixel || []).map(option => String(option.value)),
    startDt: new Date(query.startDt).toISOString(), endDt: new Date(query.endDt).toISOString(), rollup: query.rollup });
}

export async function buildRainfallShareUrl(contextType, query, baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin)) {
  const token = await encodeShareState(buildShareStateFromQuery(contextType, query));
  const url = new URL(baseUrl);
  url.hash = `s=${token}`;
  return url.href;
}

// Validate everything before changing the form. Loading a link never submits a
// query, clamps its dates, or rewrites the address bar.
export async function hydrateShareStateToRedux({ dispatch, getState, hash = window.location.hash }) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (!params.has('s')) return false;
  try {
    if (params.getAll('s').length !== 1) throw new Error('The link contains multiple queries.');
    const query = await decodeShareState(params.get('s'));
    const state = getState();
    const latest = state.stats?.latest || {};
    const bounds = resolveAvailableBounds({ contextType: query.c, rollup: query.rollup,
      latest, rainfallMinDate: RAINFALL_MIN_DATE });
    const missingRealtimeAvailability = query.c === CONTEXT_TYPES.legacyRealtime && (
      (query.g.length > 0 && !Number.isFinite(Date.parse(latest['realtime-gauge'])))
      || (query.p.length > 0 && !Number.isFinite(Date.parse(latest['realtime-radar'])))
    );
    if (!bounds.available || missingRealtimeAvailability) throw new Error('Availability for this source could not be verified. Reload to try again.');
    if (!isRangeWithinBounds({ start: query.startDt, end: query.endDt, ...bounds })) {
      throw new Error('The requested dates are outside this source’s available data.');
    }
    let missing = 0;
    const sensorLocations = { geographies: [] };
    for (const [sensor, selected] of [['gauge', query.g], ['pixel', query.p]]) {
      const catalog = new Map(selectMapStyleSourceDataFeatures(state, sensor)
        .map(feature => [String(feature.properties.id), feature]));
      sensorLocations[sensor] = selected.map(id => {
        if (catalog.has(id)) return { ...transformFeatureToOption(catalog.get(id)), value: id };
        missing++;
        return { value: id, label: id };
      });
    }
    dispatch(importRainfallQuery({ ...query, contextType: query.c, sensorLocations }));
    dispatch(switchTab(query.c));
    for (const sensorLocationType of ['gauge', 'pixel']) {
      dispatch(highlightSensor({ contextType: query.c, sensorLocationType, selectedOptions: sensorLocations[sensorLocationType] }));
    }
    dispatch(setQueryImportNotice({ variant: missing ? 'warning' : 'info',
      message: `Query loaded. Review the selection, then click Get Rainfall Data.${missing
        ? ` ${missing} selected sensor(s) have no map location; their IDs are retained in the query.` : ''}` }));
  } catch (error) {
    dispatch(setQueryImportNotice({ variant: 'danger', message: `Could not import query: ${error.message} The form uses its normal defaults.` }));
  }
  return true;
}
