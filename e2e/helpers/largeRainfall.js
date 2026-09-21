// Deterministic, generated in the test runner, never stored in the app or repository.
export function largeRainfall(sensorCount = 165, observationCount = 8929) {
  const timestamps = Array.from({ length: observationCount }, (_, i) => new Date(Date.UTC(2026, 4, 31, 3, 45) + i * 300000).toISOString());
  return Array.from({ length: sensorCount }, (_, sensor) => ({
    id: String(100 + sensor),
    data: timestamps.map((ts, i) => ({ ts, val: i % 31 === 0 ? null : i % 7 === 0 ? Number(((sensor + i) % 100 / 1000).toFixed(3)) : 0, src: i % 31 === 0 ? 'N/D' : i % 47 === 0 ? 'R, G' : 'R' }))
  }));
}

export function rainfallGeometry(count) {
  return { type: 'FeatureCollection', features: Array.from({ length: count }, (_, i) => {
    const x = -80 + (i % 15) * 0.005, y = 40.42 + Math.floor(i / 15) * 0.005;
    return { type: 'Feature', id: String(100 + i), properties: { pixel_id: String(100 + i) }, geometry: { type: 'Polygon', coordinates: [[[x, y], [x + 0.004, y], [x + 0.004, y + 0.004], [x, y + 0.004], [x, y]]] } };
  }) };
}
