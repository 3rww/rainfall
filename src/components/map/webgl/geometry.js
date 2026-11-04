import earcut from 'earcut';
import { buildBurstPoints } from '../intervalBursts';
import { sensorKey } from '../../../store/playbackController';

export const mercator = ([lng, lat]) => [(lng + 180) / 360,
  (1 - Math.log(Math.tan(Math.PI / 4 + Math.max(-85.051129, Math.min(85.051129, lat)) * Math.PI / 360)) / Math.PI) / 2];

// Double precision translation is applied before converting the camera matrix to Float32.
export function localMatrix(matrix, origin) {
  const result = new Float32Array(matrix);
  for (let row = 0; row < 4; row++) result[12 + row] = matrix[12 + row] + matrix[row] * origin[0] + matrix[4 + row] * origin[1];
  return result;
}
export function buildGeometry(pixel, gauge, indexes) {
  const origin = mercator([-80, 40.5]), vertices = [], triangles = [], circles = [], rings = [];
  const radarIds = new Set();
  for (const feature of pixel?.features || []) {
    const index = indexes.get(sensorKey('pixel', feature.id));
    if (index === undefined) continue;
    radarIds.add(String(feature.id));
    const polygons = feature.geometry?.type === 'Polygon' ? [feature.geometry.coordinates]
      : feature.geometry?.type === 'MultiPolygon' ? feature.geometry.coordinates : [];
    for (const polygon of polygons) {
      const points = [], holes = [], base = vertices.length / 3;
      polygon.forEach((ring, r) => {
        if (r) holes.push(points.length / 2);
        for (const coordinate of ring) {
          const [x, y] = mercator(coordinate), lx = x - origin[0], ly = y - origin[1];
          points.push(lx, ly); vertices.push(lx, ly, index);
        }
      });
      triangles.push(...earcut(points, holes, 2).map(i => base + i));
    }
  }
  const points = buildBurstPoints(pixel, radarIds);
  for (const feature of points.features) {
    const [x, y] = mercator(feature.geometry.coordinates);
    rings.push(x - origin[0], y - origin[1], indexes.get(sensorKey('pixel', feature.id)), feature.properties.cellWidthAtZoom0 / 512);
  }
  for (const feature of gauge?.features || []) {
    const index = indexes.get(sensorKey('gauge', feature.id));
    if (index === undefined || feature.geometry?.type !== 'Point') continue;
    const [x, y] = mercator(feature.geometry.coordinates);
    circles.push(x - origin[0], y - origin[1], index, 0);
  }
  return { origin, vertices: new Float32Array(vertices), triangles: new Uint32Array(triangles),
    circles: new Float32Array(circles), rings: new Float32Array(rings), points: points.features.length };
}
