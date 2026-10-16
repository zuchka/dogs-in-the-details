#!/usr/bin/env node
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { CONFIDENCE_FLOOR, MODEL_ID, MODEL_NAME, SEGMENTATION_MODEL_ID, SEGMENTATION_MODEL_NAME, normalizeDetections } from '../worker/detections.ts';

const args = process.argv.slice(2);
const imagePath = args.shift();
const options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!['--artwork-id', '--output', '--raw-output', '--mode'].includes(args[i]) || !args[i + 1]) {
    console.error('Usage: node scripts/detect.mjs IMAGE --artwork-id ID [--mode detection|segmentation] [--output FILE] [--raw-output FILE]');
    process.exit(1);
  }
  options[args[i]] = args[i + 1];
}

async function save(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

try {
  const inferenceMode = options['--mode'] ?? 'detection';
  if (!['detection', 'segmentation'].includes(inferenceMode)) throw new Error('--mode must be detection or segmentation.');
  const artworkId = Number(options['--artwork-id']);
  if (!imagePath || !Number.isSafeInteger(artworkId) || artworkId <= 0) {
    throw new Error('Provide a local image and a positive --artwork-id. Run with Node 22.18 or later.');
  }
  const apiKey = process.env.ROBOFLOW_API_KEY?.trim();
  if (!apiKey) throw new Error('Set ROBOFLOW_API_KEY in your environment; do not put it in the command line.');
  if ((await stat(imagePath)).size > 8 * 1024 * 1024) throw new Error('Image exceeds this demo’s 8 MB limit.');
  const image = await readFile(imagePath);
  const started = Date.now();
  const modelId = inferenceMode === 'segmentation' ? SEGMENTATION_MODEL_ID : MODEL_ID;
  const modelName = inferenceMode === 'segmentation' ? SEGMENTATION_MODEL_NAME : MODEL_NAME;
  const url = new URL(`https://serverless.roboflow.com/${modelId}`);
  url.search = new URLSearchParams({
    confidence: String(CONFIDENCE_FLOOR), overlap: '0.5', max_detections: '100',
    disable_active_learning: 'true',
  }).toString();
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: image.toString('base64'),
    signal: AbortSignal.timeout(55_000),
  });
  if (!response.ok) throw new Error(`Roboflow returned HTTP ${response.status}; check credentials, quota, and model access.`);
  const raw = await response.json();
  const result = {
    artworkId, inferenceMode, model: modelName, generatedAt: new Date().toISOString(), mode: 'live',
    durationMs: Date.now() - started, ...normalizeDetections(raw),
  };
  if (options['--raw-output']) await save(options['--raw-output'], raw);
  if (options['--output']) await save(options['--output'], result);
  else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  console.error(error?.name === 'TimeoutError' ? 'Roboflow did not respond within 55 seconds.' : error.message);
  process.exitCode = 1;
}
