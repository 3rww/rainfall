// Deterministic, generated in the test runner, never stored in the app or repository.
export function largeRainfall(sensorCount = 165, observationCount = 8929) {
  const timestamps = Array.from({ length: observationCount }, (_, i) => new Date(Date.UTC(2026, 4, 31, 3, 45) + i * 300000).toISOString());
  return Array.from({ length: sensorCount }, (_, sensor) => ({
    id: String(100 + sensor),
    data: timestamps.map((ts, i) => ({ ts, val: i % 31 === 0 ? null : i % 7 === 0 ? Number(((sensor + i) % 100 / 1000).toFixed(3)) : 0, src: i % 31 === 0 ? 'N/D' : i % 47 === 0 ? 'R, G' : 'R' }))
  }));
}
