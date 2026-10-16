import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InvalidInferenceResponse, normalizeDetections } from '../worker/detections.ts';

const dog = { class: 'dog', x: 250, y: 100, width: 200, height: 100, confidence: 0.8 };
const response = (predictions: unknown[], width = 1000, height = 500) => ({
  image: { width, height }, predictions,
});

test('converts center pixels to top-left fractions using returned landscape dimensions', () => {
  const result = normalizeDetections(response([dog]));
  assert.deepEqual(result.image, { width: 1000, height: 500 });
  assert.equal(result.detections[0].x, 0.15);
  assert.equal(result.detections[0].y, 0.1);
  assert.ok(Math.abs(result.detections[0].width - 0.2) < 1e-10);
  assert.ok(Math.abs(result.detections[0].height - 0.2) < 1e-10);
});

test('uses independent portrait dimensions and clips a box at image edges', () => {
  const { detections } = normalizeDetections(response([
    { ...dog, x: 0, y: 950, width: 200, height: 200 },
  ], 500, 1000));
  assert.deepEqual(detections[0], {
    id: 'dog-0', label: 'dog', confidence: 0.8,
    x: 0, y: 0.85, width: 0.2, height: 1 - 0.85,
  });
});

test('keeps only dogs at the floor and drops boxes completely outside the image', () => {
  const { detections } = normalizeDetections(response([
    { ...dog, class: 'cat' }, { ...dog, confidence: 0.09 },
    { ...dog, confidence: 0.1 }, { ...dog, x: -200 },
  ]));
  assert.equal(detections.length, 1);
  assert.equal(detections[0].confidence, 0.1);
  assert.equal(detections[0].id, 'dog-2');
});

test('an empty prediction list is a valid no-detection result', () => {
  assert.deepEqual(normalizeDetections(response([])).detections, []);
});

test('rejects malformed response shape and nonfinite dimensions', () => {
  for (const raw of [null, [], {}, { image: { width: 0, height: 500 }, predictions: [] },
    { image: { width: 1000, height: Infinity }, predictions: [] },
    { image: { width: 1000, height: 500 }, predictions: 'none' }]) {
    assert.throws(() => normalizeDetections(raw), InvalidInferenceResponse);
  }
});

test('rejects corrupt dog coordinates rather than falsely reporting no dogs', () => {
  for (const invalid of [{ ...dog, x: NaN }, { ...dog, width: -3 },
    { ...dog, confidence: 2 }, { ...dog, height: '100' }, null]) {
    assert.throws(() => normalizeDetections(response([invalid])), InvalidInferenceResponse);
  }
});
