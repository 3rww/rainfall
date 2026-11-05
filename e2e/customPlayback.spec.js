import { test, expect } from '@playwright/test';
import { openResult, ready, state, selectMode, selectScale } from './helpers/playback';
import { rainfallGeometry } from './helpers/largeRainfall';
const data = [0.125, 0.375, null, 0, 0.2].map((val, i) => ({ ts: new Date(Date.UTC(2025,8,30,12,i*5)).toISOString(), val }));
const fixture = [{ id: '100', data }];
async function sample(page, coordinates) {
  return page.evaluate(points => new Promise(resolve => {
    const map = window.__RAINFALL_MAP__, canvas = map.getCanvas();
    map.once('render', () => {
      const gl = canvas.getContext('webgl2'), ratio = canvas.width / canvas.clientWidth;
      const pixels = points.map(coordinate => { const point = map.project(coordinate), rgba = new Uint8Array(4); gl.readPixels(Math.round(point.x * ratio), canvas.height - Math.round(point.y * ratio), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba); return [...rgba]; });
      resolve({ pixels, error: gl.getError() });
    }); map.triggerRepaint();
  }), coordinates);
}
for (const dpr of [1,2]) test.describe(`canvas DPR ${dpr}`, () => {
  test.use({ deviceScaleFactor: dpr });
  test('custom colors, missing/zero, holes and pitched gauges match native canvas', async ({ page }, info) => {
    test.setTimeout(90000);
    const geometry = rainfallGeometry(1);
    geometry.features[0].geometry.coordinates.push([[-79.9985,40.4215],[-79.9975,40.4215],[-79.9975,40.4225],[-79.9985,40.4225],[-79.9985,40.4215]]);
    const output = {};
    for (const backend of ['native', 'custom']) {
      await openResult(page, fixture, '5-minute', { mixed:true, geometry, backend });
      await selectMode(page,'interval'); await ready(page);
      if (backend === 'custom') expect(await page.evaluate(() => window.__APP_STORE__.playbackRuntime.inspect().backend)).toBe('custom');
      output[backend] = [];
      for (const camera of [
        {center:[-79.993,40.435],zoom:13,bearing:0,pitch:0},
        {center:[-79.993,40.435],zoom:13,bearing:37,pitch:45},
        {center:[-79.999,40.421],zoom:18,bearing:27,pitch:40}
      ]) {
        await page.evaluate(camera => window.__RAINFALL_MAP__.jumpTo(camera),camera);
        const points = camera.zoom === 18 ? [[-79.999,40.421]] : [[-79.999,40.421],[-79.998,40.422],[-79.986,40.448]];
        const result = await sample(page,points); expect(result.error).toBe(0);
        output[backend].push(result.pixels);
        await page.screenshot({path:info.outputPath(`${backend}-${camera.zoom}-${camera.pitch}.png`)});
      }
      await page.evaluate(() => window.__RAINFALL_MAP__.jumpTo({center:[-79.999,40.421],zoom:14,bearing:0,pitch:0}));
      for (const index of [2,3]) {
        await page.evaluate(index => window.__APP_STORE__.dispatch({type:'playback/seekPlayback',payload:index}),index); await ready(page);
        output[backend].push((await sample(page,[[-79.999,40.421]])).pixels);
      }
    }
    for(let i=0;i<output.native.length;i++) for(let j=0;j<output.native[i].length;j++) for(let c=0;c<4;c++) expect(Math.abs(output.custom[i][j][c]-output.native[i][j][c])).toBeLessThanOrEqual(5);
    expect(output.custom[0][0]).not.toEqual(output.custom[0][1]); // hole has no rainfall fill
    expect(output.custom[3]).not.toEqual(output.custom[4]); // missing differs from measured zero
    await info.attach('canvas-pixels.json',{body:JSON.stringify(output),contentType:'application/json'});
  });
});
test('custom playback restores styles and contexts, retains interaction, and releases GPU resources', async ({ page },info) => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await openResult(page,fixture,'5-minute',{mixed:true,backend:'custom'});
  await selectMode(page,'combined'); await ready(page);
  await page.evaluate(() => {
    const map=window.__RAINFALL_MAP__;
    window.rainfallWrites={state:0,source:0,paint:0};
    const state=map.setFeatureState.bind(map),paint=map.setPaintProperty.bind(map);
    map.setFeatureState=(target,value)=>{ if('rainfall' in value || target.source==='rainfall-interval-bursts') window.rainfallWrites.state++; return state(target,value); };
    map.setPaintProperty=(...args)=>{ window.rainfallWrites.paint++; return paint(...args); };
    for(const id of ['pixel','gauge']) {const source=map.getSource(id),original=source.setData.bind(source);source.setData=(...args)=>{window.rainfallWrites.source++;return original(...args);};}
    map.jumpTo({center:[-79.998,40.422],zoom:14});
  });
  await page.getByRole('button',{name:'Play playback'}).click();
  await expect.poll(async()=>(await state(page)).frame?.index).toBe(4);
  await expect.poll(()=>page.evaluate(()=>window.__APP_STORE__.playbackRuntime.inspect().animated)).toBe(false);
  expect(await page.evaluate(()=>window.rainfallWrites)).toEqual({state:0,source:0,paint:0});
  const before=await page.evaluate(()=>window.__APP_STORE__.playbackRuntime.inspect());
  expect(before).toMatchObject({backend:'custom',geometryBuilds:1,buffers:5,textures:2,programs:1});
  await selectScale(page,'10 in.');
  expect((await page.evaluate(()=>window.__APP_STORE__.playbackRuntime.inspect())).valueUploads).toBe(before.valueUploads);
  await page.evaluate(()=>{const map=window.__RAINFALL_MAP__;map.setStyle(map.getStyle(),{diff:false});});
  await page.waitForFunction(()=>window.__RAINFALL_MAP__.getLayer('rainfall-webgl-bursts') && window.__RAINFALL_MAP__.isStyleLoaded());
  const restored=await page.evaluate(()=>window.__APP_STORE__.playbackRuntime.inspect());
  expect(restored.emitted).toBe(before.emitted); expect(restored.geometryBuilds).toBe(1);
  await page.evaluate(()=>{const map=window.__RAINFALL_MAP__,lngLat={lng:-79.998,lat:40.422};map.fire('mousemove',{point:map.project(lngLat),lngLat});});
  await expect(page.locator('.tooltip-body').filter({hasText:'Cumulative rainfall: 0.700'})).toBeVisible();
  await page.evaluate(()=>{const map=window.__RAINFALL_MAP__;window.loss=map.getCanvas().getContext('webgl2').getExtension('WEBGL_lose_context');window.loss.loseContext();});
  await expect.poll(()=>page.evaluate(()=>window.__APP_STORE__.playbackRuntime.inspect().contextLost)).toBe(true);
  await page.evaluate(()=>window.loss.restoreContext());
  await expect.poll(()=>page.evaluate(()=>window.__APP_STORE__.playbackRuntime.inspect().contextLost)).toBe(false);
  expect((await state(page)).playing).toBe(false); expect((await state(page)).frame.index).toBe(4);
  expect((await sample(page,[[-79.998,40.422]])).error).toBe(0);
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByRole('slider',{name:'Rainfall timestep'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('custom-mobile.png')});
  await selectMode(page,'total');
  expect(await page.evaluate(()=>window.__APP_STORE__.playbackRuntime.inspect())).toMatchObject({buffers:0,textures:0,programs:0});
  expect(await page.evaluate(()=>window.__RAINFALL_MAP__.getLayoutProperty('pixel-results','visibility'))).toBe('visible');
  expect(errors).toEqual([]);
});
test('unsupported projection and shader initialization failure use native fallback', async({page})=>{
  await page.addInitScript(()=>{const original=WebGL2RenderingContext.prototype.getShaderParameter;WebGL2RenderingContext.prototype.getShaderParameter=function(shader,p){if(p===this.COMPILE_STATUS && this.getShaderSource(shader)?.includes('sampler2D rainfall'))return false;return original.call(this,shader,p);};});
  await openResult(page,fixture,'5-minute',{backend:'custom'});await selectMode(page,'interval');await ready(page);
  expect(await page.evaluate(()=>window.__APP_STORE__.playbackRuntime.inspect())).toMatchObject({backend:'native',requestedBackend:'custom'});
  expect(await page.evaluate(()=>window.__APP_STORE__.playbackRuntime.inspect().fallbackReason)).toContain('shader');
  expect(await page.evaluate(()=>window.__RAINFALL_MAP__.getFeatureState({source:'pixel',id:'100'}).rainfall)).toBe(0.125);
});

test('custom playback falls back on projection changes and pauses when hidden',async({page})=>{
  const frames=Array.from({length:101},(_,i)=>({ts:new Date(Date.UTC(2025,8,30,12)+i*300000).toISOString(),val:0.1}));
  await openResult(page,[{id:'100',data:frames}],'5-minute',{backend:'custom'});await selectMode(page,'combined');await ready(page);
  await page.getByRole('button',{name:'Play playback'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__APP_STORE__.playbackRuntime.inspect().emitted)).toBeGreaterThan(1);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect.poll(async()=>(await state(page)).playing).toBe(false);
  expect(await page.evaluate(()=>window.__APP_STORE__.playbackRuntime.inspect())).toMatchObject({animated:false,staticRings:true});
  await page.evaluate(()=>{delete document.hidden;window.__RAINFALL_MAP__.setProjection('globe');});
  await expect.poll(()=>page.evaluate(()=>window.__APP_STORE__.playbackRuntime.inspect().backend)).toBe('native');
  expect(await page.evaluate(()=>window.__APP_STORE__.playbackRuntime.inspect().fallbackReason)).toContain('Mercator');
});

test('failed custom context restoration falls back with the last frame paused',async({page})=>{
  await openResult(page,fixture,'5-minute',{backend:'custom'});await selectMode(page,'interval');await ready(page);
  await page.evaluate(()=>{
    const map=window.__RAINFALL_MAP__,gl=map.getCanvas().getContext('webgl2');
    window.loss=gl.getExtension('WEBGL_lose_context');window.loss.loseContext();
  });
  await expect.poll(()=>page.evaluate(()=>window.__APP_STORE__.playbackRuntime.inspect().contextLost)).toBe(true);
  await page.evaluate(()=>{
    const original=WebGL2RenderingContext.prototype.getShaderParameter;
    WebGL2RenderingContext.prototype.getShaderParameter=function(shader,p){if(p===this.COMPILE_STATUS&&this.getShaderSource(shader)?.includes('sampler2D rainfall'))return false;return original.call(this,shader,p);};
    window.loss.restoreContext();
  });
  await expect.poll(()=>page.evaluate(()=>window.__APP_STORE__.playbackRuntime.inspect().backend)).toBe('native');
  expect((await state(page)).playing).toBe(false);expect((await state(page)).frame.index).toBe(0);
  await expect.poll(()=>page.evaluate(()=>window.__RAINFALL_MAP__.getFeatureState({source:'pixel',id:'100'}).rainfall)).toBe(0.125);
});

for(const pitch of [0,45]) test(`static burst and gauge canvas patches match native at pitch ${pitch}`,async({page},info)=>{
  test.setTimeout(60000);
  const patches={};
  for(const backend of ['native','custom']){
    await openResult(page,fixture,'5-minute',{mixed:true,backend});await selectMode(page,'combined');await ready(page);
    patches[backend]=[];
    for(const center of [[-79.998,40.422],[-79.986,40.448]]){
      await page.evaluate(({center,pitch})=>window.__RAINFALL_MAP__.jumpTo({center,zoom:14,bearing:37,pitch}),{center,pitch});
      const patch=await page.evaluate(()=>new Promise(resolve=>{
        const map=window.__RAINFALL_MAP__,canvas=map.getCanvas();
        let draws=0;const read=()=>{if(++draws<2||!map.areTilesLoaded()){map.triggerRepaint();return;}map.off('render',read);const gl=canvas.getContext('webgl2'),rgba=new Uint8Array(96*96*4);gl.readPixels(Math.round(canvas.width/2)-48,Math.round(canvas.height/2)-48,96,96,gl.RGBA,gl.UNSIGNED_BYTE,rgba);resolve([...rgba]);};map.on('render',read);map.triggerRepaint();
      }));
      patches[backend].push(patch);
      await page.screenshot({path:info.outputPath(`${backend}-${center[0]}-${pitch}.png`)});
    }
  }
  const differences=patches.native.map((patch,index)=>patch.reduce((sum,value,i)=>sum+Math.abs(value-patches.custom[index][i]),0)/patch.length);
  await info.attach('patch-comparison.json',{body:JSON.stringify({meanAbsoluteChannelDifference:differences}),contentType:'application/json'});
  for(const difference of differences)expect(difference).toBeLessThan(5);
  // Both patches must contain actual drawing, rather than matching empty canvases.
  for(const patch of patches.custom)expect(new Set(patch).size).toBeGreaterThan(15);
});

test('custom stays the default with a globe basemap and wet frames retain bounded cohorts', async ({ page }) => {
  const wet = [{ id: '100', data: Array.from({ length: 101 }, (_, i) => ({
    ts: new Date(Date.UTC(2025, 8, 30, 12, i * 5)).toISOString(), val: 0.1
  })) }];
  await openResult(page, wet, '5-minute', { backend: '', style: { projection: { name: 'globe' } } });
  expect(new URL(page.url()).searchParams.has('playbackRenderer')).toBe(false);
  await selectMode(page, 'combined'); await ready(page);
  expect(await page.evaluate(() => window.__RAINFALL_MAP__.getProjection().name)).toBe('mercator');
  await page.getByRole('button', { name: 'Play playback' }).click();
  await page.waitForFunction(() => window.__APP_STORE__.playbackRuntime.inspect().activeBursts >= 2);
  expect(await page.evaluate(() => window.__APP_STORE__.playbackRuntime.inspect().activeBursts)).toBeLessThanOrEqual(4);
  await page.getByRole('button', { name: 'Pause playback' }).click();
  await expect.poll(() => page.evaluate(() => window.__APP_STORE__.playbackRuntime.inspect().staticRings)).toBe(true);
  expect(await page.evaluate(() => window.__APP_STORE__.playbackRuntime.inspect())).toMatchObject({
    backend: 'custom', activeBursts: 0, geometryBuilds: 1, buffers: 5, textures: 2, programs: 1
  });
});
