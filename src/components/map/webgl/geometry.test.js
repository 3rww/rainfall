import { describe, it, expect } from 'vitest';
import { buildGeometry, localMatrix, mercator } from './geometry';
import { sensorKey } from '../../../store/playbackController';
import { createBurstCohorts } from './bursts';
const ring = (x, y, size) => [[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]];
const polygon = { type: 'FeatureCollection', features: [{ id: 'same', geometry: { type: 'Polygon', coordinates: [ring(-80,40,0.04), ring(-79.99,40.01,0.01)] } }] };
const gauge = { type: 'FeatureCollection', features: [{ id: 'same', geometry: { type: 'Point', coordinates: [-80,40] } }] };
const indexes = new Map([[sensorKey('pixel','same'),0], [sensorKey('gauge','same'),1]]);
it('triangulates holes and MultiPolygons, keeping source-specific numeric indexes', () => {
  const geometry = buildGeometry(polygon, gauge, indexes);
  let area = 0;
  for (let i = 0; i < geometry.triangles.length; i += 3) {
    const [a,b,c] = [...geometry.triangles.slice(i,i+3)].map(index => geometry.vertices.slice(index*3,index*3+2));
    area += Math.abs((b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]))/2;
  }
  const rectArea = coords => { const a = mercator(coords[0]), b = mercator(coords[2]); return Math.abs((a[0]-b[0])*(a[1]-b[1])); };
  expect(area).toBeCloseTo(rectArea(polygon.features[0].geometry.coordinates[0])-rectArea(polygon.features[0].geometry.coordinates[1]), 13);
  expect(geometry.circles[2]).toBe(1); expect(geometry.rings[2]).toBe(0);
  const multi = structuredClone(polygon); multi.features[0].geometry = { type: 'MultiPolygon', coordinates: [polygon.features[0].geometry.coordinates, [ring(-80.1,40,0.01)]] };
  expect(buildGeometry(multi, gauge, indexes).triangles.length).toBeGreaterThan(geometry.triangles.length);
});
it('translates the camera in double precision before uploading the local matrix', () => {
  const m = [1e9,0,0,0, 0,1e9,0,0, 0,0,1,0, -1e9/3,-1e9/7,0,1];
  const local = localMatrix(m,[1/3,1/7]);
  expect(local[12]).toBeCloseTo(0,6); expect(local[13]).toBeCloseTo(0,6);
});
describe('GPU burst cohort state', () => {
  const timeline = Array.from({ length: 10 }, (_,i) => ({ startMs:i*1000,endMs:(i+1)*1000 }));
  const config = { key:'a',mode:'combined',generation:1,playing:true,timeline };
  const frame = (i,value,intervalValue=0.1) => ({ index:i,interval:timeline[i],values:[{source:'pixel',id:'same',value,intervalValue}] });
  it('accumulates skipped intervals, bounds overlap, suppresses duplicates and settles final rings', () => {
    let time=0; const bursts=createBurstCohorts(2,indexes,()=>time);
    const first=frame(0,0.1); bursts.apply(first,config); time=20; bursts.apply(frame(3,0.7),config);
    expect(bursts.summary().count).toBe(3); expect(bursts.amounts[2]).toBeCloseTo(0.6);
    const last=frame(9,1.3); for(let i=4;i<9;i++) { time+=20; bursts.apply(frame(i,i/10),config); }
    time+=20; bursts.apply(last,config); const count=bursts.inspect().emitted; bursts.apply(last,config);
    expect(bursts.inspect().emitted).toBe(count); expect(bursts.inspect().activeBursts).toBeLessThanOrEqual(4);
    bursts.update({...config,playing:false}); expect(bursts.staticRings).toBe(false);
    time+=500; expect(bursts.tick().settled).toBe(true); expect(bursts.staticRings).toBe(true);
    expect(bursts.amounts[0]).toBeCloseTo(0.1); expect(bursts.summary()).toBeNull();
  });
  it('pauses statically, resets on seeking, and makes missing/zero rings invisible', () => {
    const bursts=createBurstCohorts(2,indexes,()=>0);
    bursts.apply(frame(2,0.5),config); bursts.update({...config,playing:false});
    expect(bursts.staticRings).toBe(true);
    bursts.apply(frame(5,0.5,null),{...config,generation:2,playing:false});
    expect([...bursts.amounts]).toEqual(Array(8).fill(0));
    bursts.apply(frame(6,0.5,0),{...config,generation:3,playing:false}); expect(bursts.amounts[0]).toBe(0);
    bursts.apply(frame(7,0.5,0),{...config,generation:4}); expect(bursts.tick().active).toBe(false);
  });
});
