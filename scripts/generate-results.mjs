#!/usr/bin/env node
// Reuse captured responses by default. --run-missing authorizes one hosted call
// for each artwork that does not already have a normalized response on disk.
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { join } from 'node:path';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const runMissing = process.argv.includes('--run-missing');
const modeIndex = process.argv.indexOf('--mode');
const mode = modeIndex < 0 ? 'detection' : process.argv[modeIndex + 1];
if (!['detection', 'segmentation'].includes(mode)) throw new Error('--mode must be detection or segmentation.');
const captureDirectory = mode === 'segmentation' ? 'artifacts/segmentation' : 'artifacts/roboflow';
const resultsDirectory = mode === 'segmentation' ? 'public/results-segmentation' : 'public/results';
const artworks = JSON.parse(await readFile(join(root, 'public/artworks.json'), 'utf8'));
await mkdir(join(root, resultsDirectory), { recursive: true });

for (const artwork of artworks) {
  const rawPath = join(root, `${captureDirectory}/${artwork.id}.json`);
  const normalizedPath = join(root, `${captureDirectory}/${artwork.id}-normalized.json`);
  let result;
  try {
    result = JSON.parse(await readFile(normalizedPath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if (!runMissing) {
      throw new Error(`Missing captured response for ${artwork.id}. Use --run-missing with ROBOFLOW_API_KEY to run hosted inference.`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
    await run(process.execPath, [
      join(root, 'scripts/detect.mjs'), join(root, `public${artwork.image}`),
      '--artwork-id', String(artwork.id), '--raw-output', rawPath,
      '--output', normalizedPath, '--mode', mode,
    ], { cwd: root, env: process.env });
    result = JSON.parse(await readFile(normalizedPath, 'utf8'));
  }
  if (result.artworkId !== artwork.id
      || (result.inferenceMode ?? 'detection') !== mode
      || result.image.width !== artwork.width || result.image.height !== artwork.height
      || !Array.isArray(result.detections)) {
    throw new Error(`Captured response does not match artwork ${artwork.id}`);
  }
  const saved = { ...result, mode: 'saved' };
  // Polygon fixtures contain many points; keep those captures compact on disk.
  await writeFile(join(root, `${resultsDirectory}/${artwork.id}.json`), `${JSON.stringify(saved, null, mode === 'segmentation' ? undefined : 2)}\n`);
  const visible = saved.detections.filter(detection => detection.confidence >= 0.35);
  console.log(`${artwork.id}: ${saved.detections.length} ${mode} candidates at 0.10; ${visible.length} at 0.35; ${saved.durationMs} ms`);
}
