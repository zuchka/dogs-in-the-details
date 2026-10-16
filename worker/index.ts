import type { DetectionResult } from '../src/types.ts';
import { CONFIDENCE_FLOOR, InvalidInferenceResponse, MODEL_ID, MODEL_NAME, normalizeDetections } from './detections.ts';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 55_000;
// Narrow the generated binding types so the handler can be exercised without a live account.
type HandlerEnv = Pick<Env, 'ROBOFLOW_API_KEY' | 'INFERENCE_RATE_LIMITER'> & {
  ASSETS: Pick<Env['ASSETS'], 'fetch'>;
};

class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function json(value: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders },
  });
}

async function readBounded(response: Response | Request, maxBytes: number): Promise<Uint8Array> {
  if (Number(response.headers.get('content-length')) > maxBytes) {
    throw new HttpError(413, 'TOO_LARGE', 'The request or image exceeds the demo size limit.');
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, 'TOO_LARGE', 'The request or image exceeds the demo size limit.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  }
  return btoa(binary);
}

async function getArtworkImage(requestUrl: URL, env: HandlerEnv, artworkId: number): Promise<Uint8Array> {
  const catalogResponse = await env.ASSETS.fetch(new Request(new URL('/artworks.json', requestUrl)));
  if (!catalogResponse.ok) throw new HttpError(503, 'CATALOG_UNAVAILABLE', 'The artwork catalog is unavailable.');
  let catalog: unknown;
  try {
    catalog = JSON.parse(new TextDecoder().decode(await readBounded(catalogResponse, 128 * 1024)));
  } catch {
    throw new HttpError(503, 'CATALOG_UNAVAILABLE', 'The artwork catalog is unavailable.');
  }
  if (!Array.isArray(catalog)) throw new HttpError(503, 'CATALOG_UNAVAILABLE', 'The artwork catalog is unavailable.');
  const artwork = catalog.find((item) => item && item.id === artworkId && item.publicDomain === true);
  if (!artwork) throw new HttpError(404, 'UNKNOWN_ARTWORK', 'Choose an artwork from the demo collection.');
  // Only the known local copy is sent. No browser-supplied URL or museum fetch is accepted.
  const imagePath = `/images/${artworkId}.jpg`;
  if (artwork.image !== imagePath) throw new HttpError(503, 'IMAGE_UNAVAILABLE', 'The artwork image is unavailable.');
  const imageResponse = await env.ASSETS.fetch(new Request(new URL(imagePath, requestUrl)));
  if (!imageResponse.ok) throw new HttpError(503, 'IMAGE_UNAVAILABLE', 'The artwork image is unavailable.');
  const bytes = await readBounded(imageResponse, MAX_IMAGE_BYTES);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new HttpError(503, 'IMAGE_UNAVAILABLE', 'The artwork image is unavailable.');
  }
  return bytes;
}

function upstreamError(status: number): HttpError {
  if (status === 401 || status === 403) {
    return new HttpError(503, 'INFERENCE_AUTH', 'Live inference is not configured correctly. Saved examples remain available.');
  }
  if (status === 402 || status === 423) {
    return new HttpError(503, 'INFERENCE_QUOTA', 'Live inference is unavailable because of the service quota. Saved examples remain available.');
  }
  if (status === 429) {
    return new HttpError(429, 'INFERENCE_BUSY', 'Roboflow is busy. Wait a minute before trying again.');
  }
  return new HttpError(502, 'INFERENCE_FAILED', 'Roboflow could not complete this request. Try again or view a saved example.');
}

export async function handleRequest(request: Request, env: HandlerEnv, inferFetch: typeof fetch = fetch): Promise<Response> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
  try {
    if (url.pathname === '/api/health') {
      if (request.method !== 'GET') return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET.' } }, 405, { Allow: 'GET' });
      return json({ configured: Boolean(env.ROBOFLOW_API_KEY?.trim()) });
    }
    if (url.pathname !== '/api/detect') throw new HttpError(404, 'NOT_FOUND', 'This API route does not exist.');
    if (request.method !== 'POST') return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' } }, 405, { Allow: 'POST' });
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) throw new HttpError(403, 'INVALID_ORIGIN', 'Use the demo website to request inference.');
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      throw new HttpError(415, 'CONTENT_TYPE', 'Send application/json.');
    }
    let body: unknown;
    const bodyText = new TextDecoder().decode(await readBounded(request, 1024));
    try { body = JSON.parse(bodyText); }
    catch { throw new HttpError(400, 'INVALID_REQUEST', 'Send a JSON object containing artworkId.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || !('artworkId' in body) || typeof body.artworkId !== 'number'
      || !Number.isSafeInteger(body.artworkId) || body.artworkId <= 0 || Object.keys(body).length !== 1) {
      throw new HttpError(400, 'INVALID_REQUEST', 'Send only a positive integer artworkId.');
    }
    const artworkId = body.artworkId;
    const apiKey = env.ROBOFLOW_API_KEY?.trim();
    if (!apiKey) throw new HttpError(503, 'INFERENCE_NOT_CONFIGURED', 'Live inference is not configured. Saved examples remain available.');
    // Anonymous demo: limits are per network address and Cloudflare location, not a global spend cap.
    const admitted = await env.INFERENCE_RATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'local-development' });
    if (!admitted.success) throw new HttpError(429, 'RATE_LIMITED', 'Please wait a minute before running another detection.');
    const image = await getArtworkImage(url, env, artworkId);
    const inferenceUrl = new URL(`https://serverless.roboflow.com/${MODEL_ID}`);
    inferenceUrl.search = new URLSearchParams({
      confidence: String(CONFIDENCE_FLOOR), overlap: '0.5', max_detections: '100', disable_active_learning: 'true',
    }).toString();
    const started = Date.now();
    const response = await inferFetch(inferenceUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: base64(image), signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw upstreamError(response.status);
    let raw: unknown;
    try { raw = JSON.parse(new TextDecoder().decode(await readBounded(response, 2 * 1024 * 1024))); }
    catch (error) {
      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) throw error;
      throw new InvalidInferenceResponse();
    }
    const result: DetectionResult = {
      artworkId, model: MODEL_NAME, mode: 'live', generatedAt: new Date().toISOString(),
      durationMs: Date.now() - started, ...normalizeDetections(raw),
    };
    return json(result);
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ error: { code: error.code, message: error.message } }, error.status,
        error.status === 429 ? { 'Retry-After': '60' } : {});
    }
    if (error instanceof InvalidInferenceResponse) {
      return json({ error: { code: 'INVALID_INFERENCE_RESPONSE', message: error.message } }, 502);
    }
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return json({ error: { code: 'INFERENCE_TIMEOUT', message: 'Roboflow took too long to respond. Try again or view a saved example.' } }, 504);
    }
    // Do not return upstream bodies, credentials, or raw exception text to the browser.
    return json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Live detection is temporarily unavailable. Saved examples remain available.' } }, 502);
  }
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
};
