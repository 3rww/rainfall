import { describe, expect, it } from 'vitest';

import { buildRequestKey, stableSerialize } from './requestKey';

describe('requestKey utils', () => {
  it('stableSerialize sorts object keys deterministically', () => {
    const left = {
      b: 2,
      a: 1,
      nested: {
        z: true,
        m: 'x'
      }
    };
    const right = {
      nested: {
        m: 'x',
        z: true
      },
      a: 1,
      b: 2
    };

    expect(stableSerialize(left)).toBe(stableSerialize(right));
  });

  it('buildRequestKey returns the same key for equivalent kwargs objects', () => {
    const kwargsA = {
      startDt: '2025-01-01T00:00:00Z',
      endDt: '2025-01-01T01:00:00Z',
      sensorLocations: {
        gauge: [{ value: '1', label: '1: Gauge' }],
        pixel: [],
        geographies: []
      },
      rollup: '15-minute',
      zerofill: true,
      f: 'sensor'
    };

    const kwargsB = {
      f: 'sensor',
      zerofill: true,
      rollup: '15-minute',
      sensorLocations: {
        geographies: [],
        pixel: [],
        gauge: [{ label: '1: Gauge', value: '1' }]
      },
      endDt: '2025-01-01T01:00:00Z',
      startDt: '2025-01-01T00:00:00Z'
    };

    expect(buildRequestKey(kwargsA)).toBe(buildRequestKey(kwargsB));
  });

  it('buildRequestKey changes when array order changes', () => {
    const kwargsA = {
      sensorLocations: {
        gauge: [{ value: '1' }, { value: '2' }]
      }
    };
    const kwargsB = {
      sensorLocations: {
        gauge: [{ value: '2' }, { value: '1' }]
      }
    };

    expect(buildRequestKey(kwargsA)).not.toBe(buildRequestKey(kwargsB));
  });
});

