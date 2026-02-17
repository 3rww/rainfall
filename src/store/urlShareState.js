import { pickSensor } from "./features/fetchKwargsSlice";
import { highlightSensor } from "./features/mapStyleSlice";
import { switchTab } from "./features/progressSlice";
import { CONTEXT_TYPES, ENABLE_SHARE_STATE } from "./config";
import { selectMapStyleSourceDataFeatures } from "./selectors";
import { transformFeatureToOption } from "./utils/transformers";

const SHARE_STATE_HASH_KEY = "s";
const LEGACY_QUERY_PARAM_KEY = "state";
const SHARE_STATE_VERSION = 1;

const VALID_CONTEXTS = new Set([
  CONTEXT_TYPES.legacyRealtime,
  CONTEXT_TYPES.legacyGauge,
  CONTEXT_TYPES.legacyGarr
]);

let syncUnsubscribe = null;
let syncQueue = Promise.resolve();
let lastSyncedToken = null;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const canUseWindow = () => (
  typeof window !== "undefined"
  && typeof window.location !== "undefined"
  && typeof window.history !== "undefined"
);

const normalizeIds = (ids) => {
  if (!Array.isArray(ids)) {
    return [];
  }

  return [...new Set(
    ids
      .map((id) => ((id === null || id === undefined) ? "" : `${id}`.trim()))
      .filter((id) => id !== "")
  )].sort();
};

const parseJson = (value) => {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const normalizeShareState = (payload) => {
  if (payload === null || typeof payload !== "object") {
    return null;
  }

  const context = payload.c ?? payload.context;
  if (!VALID_CONTEXTS.has(context)) {
    return null;
  }

  let gaugeIds = normalizeIds(payload.g ?? payload.gauge ?? []);
  let pixelIds = normalizeIds(payload.p ?? payload.pixel ?? []);

  if (context === CONTEXT_TYPES.legacyGauge) {
    pixelIds = [];
  }

  if (context === CONTEXT_TYPES.legacyGarr) {
    gaugeIds = [];
  }

  return {
    v: SHARE_STATE_VERSION,
    c: context,
    g: gaugeIds,
    p: pixelIds
  };
};

const toBase64 = (bytes) => {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};

const fromBase64 = (base64) => {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }

  const binary = atob(base64);
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }
  return output;
};

const toBase64Url = (base64) => (
  base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
);

const fromBase64Url = (base64url) => {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padSize = (4 - (base64.length % 4)) % 4;
  return `${base64}${"=".repeat(padSize)}`;
};

const compressBytes = async (bytes) => {
  if (typeof CompressionStream === "undefined") {
    return bytes;
  }

  const stream = new CompressionStream("deflate");
  const writer = stream.writable.getWriter();
  writer.write(bytes);
  writer.close();

  const compressed = await new Response(stream.readable).arrayBuffer();
  return new Uint8Array(compressed);
};

const decompressBytes = async (bytes) => {
  if (typeof DecompressionStream === "undefined") {
    return bytes;
  }

  const stream = new DecompressionStream("deflate");
  const writer = stream.writable.getWriter();
  writer.write(bytes);
  writer.close();

  const decompressed = await new Response(stream.readable).arrayBuffer();
  return new Uint8Array(decompressed);
};

const getShareTokenFromHash = () => {
  if (!canUseWindow()) {
    return null;
  }
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  return hashParams.get(SHARE_STATE_HASH_KEY);
};

const writeShareTokenToHash = (token) => {
  if (!canUseWindow()) {
    return;
  }

  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  if (token && token.length > 0) {
    hashParams.set(SHARE_STATE_HASH_KEY, token);
  } else {
    hashParams.delete(SHARE_STATE_HASH_KEY);
  }

  const searchParams = new URLSearchParams(window.location.search);
  searchParams.delete(LEGACY_QUERY_PARAM_KEY);

  const nextSearch = searchParams.toString();
  const nextHash = hashParams.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${nextHash ? `#${nextHash}` : ""}`;

  window.history.replaceState(window.history.state, "", nextUrl);
};

const mapSensorIdsToOptions = (state, sensorType, sensorIds) => {
  if (!Array.isArray(sensorIds) || sensorIds.length === 0) {
    return [];
  }

  const byId = new Map(
    selectMapStyleSourceDataFeatures(state, sensorType)
      .map((feature) => [`${feature?.properties?.id ?? feature?.id}`, feature])
  );

  return sensorIds
    .map((id) => byId.get(`${id}`))
    .filter((feature) => feature !== undefined)
    .map((feature) => transformFeatureToOption(feature));
};

const readLegacyShareStateFromQuery = () => {
  if (!canUseWindow()) {
    return null;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const rawLegacyState = searchParams.get(LEGACY_QUERY_PARAM_KEY);
  if (!rawLegacyState) {
    return null;
  }

  const parsed = parseJson(rawLegacyState);
  return normalizeShareState(parsed);
};

export const buildShareStateFromStore = (state) => {
  const context = state?.progress?.tab;

  if (!VALID_CONTEXTS.has(context)) {
    return {
      v: SHARE_STATE_VERSION,
      c: CONTEXT_TYPES.legacyRealtime,
      g: [],
      p: []
    };
  }

  const active = state?.fetchKwargs?.[context]?.active ?? {};
  const sensorLocations = active.sensorLocations ?? {};

  const normalized = normalizeShareState({
    c: context,
    g: (sensorLocations.gauge ?? []).map((option) => option?.value),
    p: (sensorLocations.pixel ?? []).map((option) => option?.value)
  });

  return normalized ?? {
    v: SHARE_STATE_VERSION,
    c: CONTEXT_TYPES.legacyRealtime,
    g: [],
    p: []
  };
};

export const encodeShareState = async (shareState) => {
  const normalized = normalizeShareState(shareState);
  if (!normalized) {
    return "";
  }

  const payload = textEncoder.encode(JSON.stringify(normalized));
  const compressed = await compressBytes(payload);
  return toBase64Url(toBase64(compressed));
};

export const decodeShareState = async (token) => {
  if (!token || typeof token !== "string") {
    return null;
  }

  let rawBytes;
  try {
    rawBytes = fromBase64(fromBase64Url(token));
  } catch (error) {
    return null;
  }

  const candidates = [];
  try {
    const directCandidate = textDecoder.decode(rawBytes);
    candidates.push(directCandidate);
  } catch (error) {
    // No-op
  }

  try {
    const inflated = await decompressBytes(rawBytes);
    const inflatedCandidate = textDecoder.decode(inflated);
    if (!candidates.includes(inflatedCandidate)) {
      candidates.unshift(inflatedCandidate);
    }
  } catch (error) {
    // No-op
  }

  for (const candidate of candidates) {
    const parsed = parseJson(candidate);
    const normalized = normalizeShareState(parsed);
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

export const readShareStateFromHash = async () => {
  const token = getShareTokenFromHash();
  return decodeShareState(token);
};

export const writeShareStateToHash = async (shareState) => {
  if (!ENABLE_SHARE_STATE) {
    return "";
  }

  const token = await encodeShareState(shareState);
  writeShareTokenToHash(token);
  return token;
};

export const hydrateShareStateToRedux = async ({ dispatch, getState }) => {
  if (!ENABLE_SHARE_STATE) {
    return false;
  }

  if (typeof dispatch !== "function" || typeof getState !== "function") {
    return false;
  }

  let shareState = await readShareStateFromHash();
  if (!shareState) {
    shareState = readLegacyShareStateFromQuery();
  }

  if (!shareState) {
    return false;
  }

  const contextType = shareState.c;
  dispatch(switchTab(contextType));

  const nextState = getState();
  const selectedGauges = mapSensorIdsToOptions(nextState, "gauge", shareState.g);
  const selectedPixels = mapSensorIdsToOptions(nextState, "pixel", shareState.p);

  const gaugePayload = {
    contextType,
    sensorLocationType: "gauge",
    selectedOptions: selectedGauges
  };
  const pixelPayload = {
    contextType,
    sensorLocationType: "pixel",
    selectedOptions: selectedPixels
  };

  dispatch(pickSensor(gaugePayload));
  dispatch(highlightSensor(gaugePayload));
  dispatch(pickSensor(pixelPayload));
  dispatch(highlightSensor(pixelPayload));

  const canonical = buildShareStateFromStore(getState());
  const token = await writeShareStateToHash(canonical);
  lastSyncedToken = token;
  return true;
};

export const startShareStateSync = (store) => {
  if (!ENABLE_SHARE_STATE) {
    return () => {};
  }

  if (syncUnsubscribe !== null) {
    return syncUnsubscribe;
  }

  if (!store || typeof store.subscribe !== "function" || typeof store.getState !== "function") {
    return () => {};
  }

  const enqueueSync = () => {
    if (!canUseWindow()) {
      return;
    }

    syncQueue = syncQueue
      .then(async () => {
        const nextShareState = buildShareStateFromStore(store.getState());
        const nextToken = await encodeShareState(nextShareState);

        if (nextToken === lastSyncedToken) {
          return;
        }

        writeShareTokenToHash(nextToken);
        lastSyncedToken = nextToken;
      })
      .catch((error) => {
        console.warn("[urlShareState] failed to sync share state", error);
      });
  };

  const unsubscribe = store.subscribe(enqueueSync);
  syncUnsubscribe = () => {
    unsubscribe();
    syncUnsubscribe = null;
    syncQueue = Promise.resolve();
    lastSyncedToken = null;
  };

  enqueueSync();

  return syncUnsubscribe;
};

export const stopShareStateSync = () => {
  if (syncUnsubscribe !== null) {
    syncUnsubscribe();
  }
};
