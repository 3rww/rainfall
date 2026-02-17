const serializePrimitive = (value) => {
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'number' && Number.isNaN(value)) {
    return 'NaN';
  }
  if (value === Infinity) {
    return 'Infinity';
  }
  if (value === -Infinity) {
    return '-Infinity';
  }
  return JSON.stringify(value);
};

export const stableSerialize = (value) => {
  if (
    value === null
    || value === undefined
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return serializePrimitive(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
  }

  return serializePrimitive(String(value));
};

const fnv1a32 = (input, seed = 0x811c9dc5) => {
  let hash = seed >>> 0;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

export const buildRequestKey = (kwargs) => {
  const serialized = stableSerialize(kwargs || {});
  return [
    fnv1a32(serialized, 0x811c9dc5),
    fnv1a32(serialized, 0x9e3779b9),
    fnv1a32(serialized, 0x85ebca6b),
    fnv1a32(serialized, 0xc2b2ae35)
  ].join('');
};

