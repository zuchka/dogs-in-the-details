import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { inspectImage, InvalidImage, MAX_IMAGE_BYTES } from '../worker/image-input.ts';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64');

function webp(width: number, height: number, extended = false): Buffer {
  // Structural header fixtures: pixel decoding belongs to the inference provider.
  const chunk = Buffer.alloc(18);
  chunk.write('VP8 ', 0);
  chunk.writeUInt32LE(10, 4);
  chunk.set([0x9d, 0x01, 0x2a], 11);
  chunk.writeUInt16LE(width, 14);
  chunk.writeUInt16LE(height, 16);
  const vp8x = Buffer.alloc(18);
  vp8x.write('VP8X', 0);
  vp8x.writeUInt32LE(10, 4);
  vp8x.writeUIntLE(width - 1, 12, 3);
  vp8x.writeUIntLE(height - 1, 15, 3);
  const body = Buffer.concat(extended ? [vp8x, chunk] : [chunk]);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0);
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8);
  return Buffer.concat([header, body]);
}

test('validates real JPEG and PNG dimensions, including a sliced typed array', () => {
  const jpeg = readFileSync(new URL('../public/images/886.jpg', import.meta.url));
  assert.deepEqual(inspectImage(jpeg, 'image/jpeg'), { width: 843, height: 1241 });
  assert.deepEqual(inspectImage(png, 'image/png'), { width: 1, height: 1 });
  const padded = Buffer.concat([Buffer.from([1, 2]), png]);
  assert.deepEqual(inspectImage(padded.subarray(2), 'image/png'), { width: 1, height: 1 });
});

test('reads lossy, extended, and lossless WebP declared dimensions', () => {
  for (const extended of [false, true]) assert.deepEqual(inspectImage(webp(640, 480, extended), 'image/webp'), { width: 640, height: 480 });
  const lossless = Buffer.alloc(26);
  lossless.write('RIFF', 0); lossless.writeUInt32LE(18, 4); lossless.write('WEBPVP8L', 8); lossless.writeUInt32LE(5, 16);
  lossless[20] = 0x2f; lossless.writeUInt32LE((639 | (479 << 14)) >>> 0, 21);
  assert.deepEqual(inspectImage(lossless, 'image/webp'), { width: 640, height: 480 });
});

test('rejects mismatched content types, SVG, empty, truncated, and malformed containers', () => {
  for (const [bytes, type] of [
    [png, 'image/jpeg'], [Buffer.from('<svg/>'), 'image/svg+xml'], [Buffer.alloc(0), 'image/png'],
    [png.subarray(0, -1), 'image/png'], [webp(10, 10).subarray(0, -1), 'image/webp'],
    [Buffer.from([255, 216, 255, 192, 0, 20, 255, 217]), 'image/jpeg'],
  ] as const) assert.throws(() => inspectImage(bytes, type), InvalidImage);
});

test('rejects oversized byte payloads, declared sides, pixels, and zero dimensions', () => {
  assert.throws(() => inspectImage(new Uint8Array(MAX_IMAGE_BYTES + 1), 'image/jpeg'), /8 MiB/);
  for (const [width, height] of [[0, 1], [10_001, 1], [5000, 5000]]) {
    const oversized = Buffer.from(png); oversized.writeUInt32BE(width, 16); oversized.writeUInt32BE(height, 20);
    assert.throws(() => inspectImage(oversized, 'image/png'), /megapixels/);
  }
});

test('rejects animated PNG/WebP and mismatched WebP canvas size', () => {
  const animation = Buffer.alloc(20); animation.writeUInt32BE(8, 0); animation.write('acTL', 4);
  assert.throws(() => inspectImage(Buffer.concat([png.subarray(0, 33), animation, png.subarray(33)]), 'image/png'), /Animated/);
  const animated = webp(10, 10, true); animated[20] = 0x02;
  assert.throws(() => inspectImage(animated, 'image/webp'), /Animated/);
  const mismatched = webp(10, 10, true); mismatched[24] = 20;
  assert.throws(() => inspectImage(mismatched, 'image/webp'), InvalidImage);
});
