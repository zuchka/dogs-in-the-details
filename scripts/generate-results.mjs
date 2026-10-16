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
const artworks = JSON.parse(await readFile(join(root, 'public/artworks.json'), 'utf8'));
await mkdir(join(root, 'public/results'), { recursive: true });

for (const artwork of artworks) {
  const rawPath = join(root, `artifacts/roboflow/${artwork.id}.json`);
  const normalizedPath = join(root, `artifacts/roboflow/${artwork.id}-normalized.json`);
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
      '--output', normalizedPath,
    ], { cwd: root, env: process.env });
    result = JSON.parse(await readFile(normalizedPath, 'utf8'));
  }
  if (result.artworkId !== artwork.id
      || result.image.width !== artwork.width || result.image.height !== artwork.height
      || !Array.isArray(result.detections)) {
    throw new Error(`Captured response does not match artwork ${artwork.id}`);
  }
  const saved = { ...result, mode: 'saved' };
  await writeFile(join(root, `public/results/${artwork.id}.json`), `${JSON.stringify(saved, null, 2)}\n`);
  const visible = saved.detections.filter(detection => detection.confidence >= 0.35);
  console.log(`${artwork.id}: ${saved.detections.length} boxes at 0.10; ${visible.length} at 0.35; ${saved.durationMs} ms`);
}
