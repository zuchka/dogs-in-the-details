import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleRequest } from '../worker/index.ts';
import type { DetectionResult } from '../src/types.ts';

function environment({ key = 'test-secret-never-return', admitted = true } = {}): Parameters<typeof handleRequest>[1] {
  return {
    ROBOFLOW_API_KEY: key,
    INFERENCE_RATE_LIMITER: { limit: async () => ({ success: admitted }) },
    ASSETS: { fetch: async (input) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.pathname === '/artworks.json') return Response.json([{ id: 886, image: '/images/886.jpg', publicDomain: true }]);
      if (url.pathname === '/images/886.jpg') return new Response(new Uint8Array([255, 216, 255, 1]));
      return new Response('asset');
    } },
  };
}
const request = (body: unknown = { artworkId: 886 }) => new Request('https://demo.test/api/detect', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'Origin': 'https://demo.test' }, body: JSON.stringify(body),
});
const neverFetch: typeof fetch = async () => { throw new Error('Unexpected upstream call'); };
const raw = { image: { width: 1000, height: 500 }, predictions: [
  { class: 'dog', confidence: 0.8, x: 500, y: 250, width: 200, height: 100 },
] };

test('health reports only whether the key is configured', async () => {
  for (const key of ['', 'hidden-key']) {
    const response = await handleRequest(new Request('https://demo.test/api/health'), environment({ key }), neverFetch);
    assert.deepEqual(await response.json(), { configured: Boolean(key) });
  }
});

test('live request sends only local image bytes and key in Authorization header', async () => {
  let calls = 0;
  const upstream: typeof fetch = async (input, init) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://serverless.roboflow.com');
    assert.equal(url.pathname, '/coco/40');
    assert.equal(url.searchParams.get('confidence'), '0.1');
    assert.equal(url.searchParams.has('api_key'), false);
    assert.equal(url.searchParams.has('image'), false);
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-secret-never-return');
    assert.equal(init?.body, '/9j/AQ==');
    return Response.json(raw);
  };
  const response = await handleRequest(request(), environment(), upstream);
  assert.equal(response.status, 200);
  const result = await response.json() as DetectionResult;
  assert.equal(result.mode, 'live');
  assert.equal(result.artworkId, 886);
  assert.equal(result.detections.length, 1);
  assert.equal(result.detections[0].x, 0.4);
  assert.equal(calls, 1);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('unknown artwork, arbitrary URL, and invalid IDs never reach Roboflow', async () => {
  for (const body of [{ artworkId: 999 }, { artworkId: '886' }, { artworkId: 886, image: 'https://evil.test' }, { artworkId: -1 }]) {
    const response = await handleRequest(request(body), environment(), neverFetch);
    assert.ok([400, 404].includes(response.status));
  }
});

test('missing key and rate limit fail explicitly without calling inference', async () => {
  const missing = await handleRequest(request(), environment({ key: '' }), neverFetch);
  assert.equal(missing.status, 503);
  const limited = await handleRequest(request(), environment({ admitted: false }), neverFetch);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '60');
});

test('malformed or oversized JSON is rejected before inference', async () => {
  const malformed = new Request('https://demo.test/api/detect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal((await handleRequest(malformed, environment(), neverFetch)).status, 400);
  const oversized = new Request('https://demo.test/api/detect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(1025) });
  assert.equal((await handleRequest(oversized, environment(), neverFetch)).status, 413);
});

test('provider errors are sanitized, not passed through or replaced with saved results', async () => {
  for (const [upstreamStatus, expected] of [[401, 503], [402, 503], [429, 429], [500, 502]]) {
    const response = await handleRequest(request(), environment(), async () => new Response('secret upstream detail', { status: upstreamStatus }));
    assert.equal(response.status, expected);
    const text = await response.text();
    assert.equal(text.includes('secret'), false);
    assert.equal(text.includes('detections'), false);
  }
});

test('malformed upstream JSON, shape errors, timeout, and network failure have explicit error states', async () => {
  const cases: [typeof fetch, number][] = [
    [async () => new Response('not json'), 502],
    [async () => Response.json({ predictions: [] }), 502],
    [async () => { throw new DOMException('secret', 'TimeoutError'); }, 504],
    [async () => { throw new TypeError('secret'); }, 502],
  ];
  for (const [upstream, expected] of cases) {
    const response = await handleRequest(request(), environment(), upstream);
    assert.equal(response.status, expected);
    assert.equal((await response.text()).includes('secret'), false);
  }
});

test('wrong method, remote browser origin, and unknown API route are rejected', async () => {
  assert.equal((await handleRequest(new Request('https://demo.test/api/detect'), environment(), neverFetch)).status, 405);
  const remote = request();
  remote.headers.set('origin', 'https://other.test');
  assert.equal((await handleRequest(remote, environment(), neverFetch)).status, 403);
  assert.equal((await handleRequest(new Request('https://demo.test/api/nope'), environment(), neverFetch)).status, 404);
});
