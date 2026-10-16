import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { handleRequest } from '../worker/index.ts';
import { MAX_IMAGE_BYTES } from '../worker/image-input.ts';
import type { DetectionResult } from '../src/types.ts';

const jpeg = readFileSync(new URL('../public/images/886.jpg', import.meta.url));
const neverFetch: typeof fetch = async () => { throw new Error('Unexpected upstream call'); };
const raw = { image: { width: 843, height: 1241 }, predictions: [] };
function environment(admitted = true): Parameters<typeof handleRequest>[1] {
  return {
    ROBOFLOW_API_KEY: 'test-secret',
    INFERENCE_RATE_LIMITER: { limit: async () => ({ success: admitted }) },
    ASSETS: { fetch: async () => { throw new Error('Uploads must not access asset storage'); } },
  };
}
function upload(body: BodyInit = jpeg, headers: Record<string, string> = {}) {
  return new Request('https://demo.test/api/detect-upload', {
    method: 'POST', headers: { 'Content-Type': 'image/jpeg', 'CF-Connecting-IP': '203.0.113.7', ...headers }, body,
  });
}

test('upload and URL-import bytes use the same private hosted request with the correct source', async () => {
  for (const source of [undefined, 'upload', 'url']) {
    let calls = 0;
    const response = await handleRequest(upload(jpeg, source ? { 'X-Image-Source': source } : {}), environment(), async (input, init) => {
      calls++;
      const url = new URL(String(input));
      assert.equal(url.pathname, '/coco/40');
      assert.equal(url.searchParams.get('disable_active_learning'), 'true');
      assert.equal(url.searchParams.has('image'), false);
      assert.equal(url.searchParams.has('api_key'), false);
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-secret');
      assert.equal(init?.body, jpeg.toString('base64'));
      return Response.json(raw);
    });
    assert.equal(response.status, 200);
    const result = await response.json() as DetectionResult;
    assert.equal(result.source, source ?? 'upload');
    assert.equal(result.artworkId, null);
    assert.equal(result.mode, 'live');
    assert.deepEqual(result.image, raw.image);
    assert.deepEqual(result.detections, []);
    assert.equal(calls, 1);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});

test('upload rejects unsupported types, bad source, malformed bytes, oversize and URL payloads before inference', async () => {
  const cases: [Request, number][] = [
    [upload(jpeg, { 'Content-Type': 'image/svg+xml' }), 415],
    [upload(jpeg, { 'Content-Type': 'multipart/form-data' }), 415],
    [upload(jpeg, { 'X-Image-Source': 'collection' }), 400],
    [upload('https://example.com/private.jpg'), 422],
    [upload('{"url":"https://example.com/private.jpg"}', { 'Content-Type': 'application/json' }), 415],
    [upload(new Uint8Array([255, 216, 255, 217])), 422],
    [upload(jpeg, { 'Content-Length': String(MAX_IMAGE_BYTES + 1) }), 413],
    [upload(new Uint8Array(MAX_IMAGE_BYTES + 1)), 413],
    [upload(jpeg, { Origin: 'https://other.test' }), 403],
    [new Request('https://demo.test/api/detect-url', { method: 'POST' }), 404],
  ];
  for (const [request, status] of cases) assert.equal((await handleRequest(request, environment(), neverFetch)).status, status);
});

test('upload rate admission happens before the body is read and uses the collection IP budget', async () => {
  const deniedRequest = upload();
  const env = environment(false);
  const keys: string[] = [];
  env.INFERENCE_RATE_LIMITER.limit = async ({ key }) => { keys.push(key); return { success: false }; };
  const denied = await handleRequest(deniedRequest, env, neverFetch);
  assert.equal(denied.status, 429);
  assert.equal(denied.headers.get('retry-after'), '60');
  assert.equal(deniedRequest.bodyUsed, false);
  const collection = new Request('https://demo.test/api/detect', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7' }, body: '{"artworkId":886}',
  });
  assert.equal((await handleRequest(collection, env, neverFetch)).status, 429);
  assert.deepEqual(keys, ['203.0.113.7', '203.0.113.7']);
});

test('a missing key leaves upload bytes unread; provider decode failures are sanitized', async () => {
  const env = environment(); env.ROBOFLOW_API_KEY = '';
  const request = upload();
  assert.equal((await handleRequest(request, env, neverFetch)).status, 503);
  assert.equal(request.bodyUsed, false);
  const response = await handleRequest(upload(), environment(), async () => new Response('private provider detail', { status: 400 }));
  assert.equal(response.status, 422);
  const text = await response.text();
  assert.equal(text.includes('INVALID_IMAGE'), true);
  assert.equal(text.includes('private'), false);
});
