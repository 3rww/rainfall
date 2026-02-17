import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const BASELINE_RAW_BYTES = 2879950;
const BASELINE_GZIP_BYTES = 845670;

const formatBytes = (bytes) => `${bytes.toLocaleString()} B (${(bytes / 1024).toFixed(2)} KiB)`;

const resolveTopMappedModules = async ({ jsPath, mapPath, topN = 12 }) => {
  let SourceMapConsumer = null;

  try {
    ({ SourceMapConsumer } = require('source-map-js'));
  } catch (error) {
    try {
      ({ SourceMapConsumer } = require('source-map'));
    } catch (innerError) {
      SourceMapConsumer = null;
    }
  }

  const mapRaw = fs.readFileSync(mapPath, 'utf8');
  const sourceMap = JSON.parse(mapRaw);

  if (!SourceMapConsumer) {
    const fallback = (sourceMap.sources || [])
      .map((source, index) => ({
        source,
        bytes: (sourceMap.sourcesContent && sourceMap.sourcesContent[index])
          ? Buffer.byteLength(sourceMap.sourcesContent[index], 'utf8')
          : 0
      }))
      .sort((left, right) => right.bytes - left.bytes)
      .slice(0, topN);

    return {
      via: 'sourcesContent-length-fallback',
      modules: fallback
    };
  }

  const jsCode = fs.readFileSync(jsPath, 'utf8');
  const lines = jsCode.split('\n');
  const lineOffsets = [0];
  for (let index = 0; index < lines.length; index += 1) {
    lineOffsets.push(lineOffsets[index] + lines[index].length + 1);
  }

  const offsetFor = (line, column) => lineOffsets[line - 1] + column;

  const consumer = await new SourceMapConsumer(sourceMap);
  const mappings = [];
  consumer.eachMapping((mapping) => {
    mappings.push(mapping);
  }, null, SourceMapConsumer.GENERATED_ORDER);

  const totals = new Map();
  for (let index = 0; index < mappings.length; index += 1) {
    const current = mappings[index];
    if (!current.source) {
      continue;
    }

    const start = offsetFor(current.generatedLine, current.generatedColumn);
    const end = (index + 1) < mappings.length
      ? offsetFor(mappings[index + 1].generatedLine, mappings[index + 1].generatedColumn)
      : jsCode.length;

    const span = Math.max(0, end - start);
    totals.set(current.source, (totals.get(current.source) || 0) + span);
  }

  if (typeof consumer.destroy === 'function') {
    consumer.destroy();
  }

  const modules = [...totals.entries()]
    .map(([source, bytes]) => ({ source, bytes }))
    .sort((left, right) => right.bytes - left.bytes)
    .slice(0, topN);

  return {
    via: 'source-map-mappings',
    modules
  };
};

const run = async () => {
  const assetsDir = path.resolve(process.cwd(), 'dist/assets');
  if (!fs.existsSync(assetsDir)) {
    throw new Error(`Missing assets directory: ${assetsDir}. Run a production build first.`);
  }

  const assetFiles = fs.readdirSync(assetsDir).filter((file) => /^index-.*\.js$/.test(file));
  if (assetFiles.length === 0) {
    throw new Error(`No index chunk found in ${assetsDir}.`);
  }

  assetFiles.sort();
  const indexChunk = assetFiles[assetFiles.length - 1];
  const jsPath = path.join(assetsDir, indexChunk);
  const jsBuffer = fs.readFileSync(jsPath);

  const rawBytes = jsBuffer.length;
  const gzipBytes = zlib.gzipSync(jsBuffer).length;
  const rawDelta = rawBytes - BASELINE_RAW_BYTES;
  const gzipDelta = gzipBytes - BASELINE_GZIP_BYTES;

  console.log(`Analyzing ${path.relative(process.cwd(), jsPath)}`);
  console.log(`Raw size  : ${formatBytes(rawBytes)}`);
  console.log(`Gzip size : ${formatBytes(gzipBytes)}`);
  console.log(`Raw delta : ${rawDelta >= 0 ? '+' : ''}${rawDelta.toLocaleString()} B vs baseline (${formatBytes(BASELINE_RAW_BYTES)})`);
  console.log(`Gzip delta: ${gzipDelta >= 0 ? '+' : ''}${gzipDelta.toLocaleString()} B vs baseline (${formatBytes(BASELINE_GZIP_BYTES)})`);

  console.log('Targets:');
  console.log(`- raw reduction >= 200 KiB: ${rawDelta <= -(200 * 1024) ? 'PASS' : 'FAIL'}`);
  console.log(`- gzip reduction >= 40 KiB: ${gzipDelta <= -(40 * 1024) ? 'PASS' : 'FAIL'}`);

  const mapPath = `${jsPath}.map`;
  if (!fs.existsSync(mapPath)) {
    console.log('No sourcemap found for index chunk. Re-run with `vite build --sourcemap` for module attribution.');
    return;
  }

  const result = await resolveTopMappedModules({ jsPath, mapPath });
  console.log(`Top mapped modules (via ${result.via}):`);
  result.modules.forEach((entry, index) => {
    console.log(`${`${index + 1}.`.padEnd(4)} ${(entry.bytes / 1024).toFixed(1).padStart(8)} KiB  ${entry.source}`);
  });
};

run().catch((error) => {
  console.error('[analyze-bundle] failed:', error.message);
  process.exitCode = 1;
});
