# Hosted Roboflow integration

The model runs on **Roboflow's Serverless Cloud API**. The browser renders the returned boxes; it does not run RF-DETR locally. No model training or GPU installation is required.

## Model and request

This demo pins `coco/40`, the project/version behind Roboflow's `rfdetr-medium` alias. The mapping was checked against [Roboflow's alias registry](https://github.com/roboflow/inference/blob/main/inference/models/aliases.py) on October 16, 2026. [The RF-DETR documentation](https://docs.roboflow.com/models/supported-models/rf-detr) describes the hosted model and its COCO training domain.

The integration sends:

```text
POST https://serverless.roboflow.com/coco/40
  ?confidence=0.1&overlap=0.5&max_detections=100&disable_active_learning=true
Authorization: Bearer <server-side secret>
Content-Type: application/x-www-form-urlencoded

<base64 image bytes>
```

The key is never placed in a URL, returned to the browser, or included in logs. Current hosted API documentation recommends [header-based authentication](https://docs.roboflow.com/deployment/roboflow-cloud/serverless-api). The actual endpoint and parameters were checked against the hosted [OpenAPI specification](https://serverless.roboflow.com/openapi.json) and exercised with a real museum image.

## Browser API

- `GET /api/health` returns `{ "configured": true }` when the secret is present. This reports configuration, not a successful provider connection.
- `POST /api/detect` accepts only `{ "artworkId": 886 }`. It reads the public-domain manifest and the corresponding bundled `/images/886.jpg` through the Worker asset binding; successful results have `source: "collection"`.
- `POST /api/detect-upload` accepts raw JPEG, PNG, or WebP bytes with the matching `Content-Type`. The optional `X-Image-Source` header is `upload` (default) or `url`. Results have `artworkId: null` and that source. Multipart uploads, JSON, unsupported types, invalid headers, and oversized images are rejected.
- There is no server-side URL-fetch endpoint. The browser imports a public HTTPS image using CORS, without credentials or a referrer, and rejects redirects. It validates and re-encodes the image before using the same upload endpoint. A host that blocks browser downloads requires the file-upload fallback. The API never receives the submitted URL or filename, so it does not have an arbitrary-URL proxy or server-side DNS/redirect boundary to secure.
- Success returns the `DetectionResult` contract in `src/types.ts`, with `mode: "live"`, a timestamp, measured request duration, returned image dimensions, and dog detections. API responses use `Cache-Control: no-store`. The application does not explicitly store uploaded image bytes, filenames, or submitted URLs, and does not log them. Image bytes are sent to Roboflow for hosted processing, with active learning disabled.
- Errors return `{ "error": { "code": "...", "message": "..." } }`. A failed live run never becomes a saved or empty successful result.

Saved examples are genuine earlier responses supplied by the application. Their display mode must be `saved`; refreshing the browser does not perform a live inference.

## Trial activation measurement

The browser can send `POST /api/events` with exactly:

```json
{"event":"live_inference_exported","sessionId":"d4df4dde-7193-4358-a5f2-7acfd07462ab","artworkId":886}
```

Send this only when a visitor exports a fresh, successful live result. Generate a random UUID with `crypto.randomUUID()` and keep it in `sessionStorage`; send no name, email, or other identifying fields. Telemetry is best-effort: a network failure or rejected event must not interrupt the download. The server validates the event name, UUID, catalog ID, and 1 KB body limit, then writes a structured log containing only those three fields. It never calls Roboflow for an event.

In Cloudflare Workers Logs, filter for `event = live_inference_exported` and count distinct `sessionId` values over the reporting period. This measures **anonymous sessions exporting live results**, a trial activation proxy. It is not proof of unique people or project adoption: sessions can reset and the public browser event can be forged. No third-party analytics service is required. Platform request logs have their own separate retention and metadata settings.

## Reproduce one result

Use Node 24. Put the key in the ignored `.dev.vars` file as `ROBOFLOW_API_KEY=...`, or provide it through the process environment. The following call sends the local museum image to Roboflow and prints a normalized result:

```sh
node --env-file=.dev.vars scripts/detect.mjs public/images/886.jpg --artwork-id 886
```

To retain the raw provider response and normalized output for inspection:

```sh
node --env-file=.dev.vars scripts/detect.mjs public/images/886.jpg --artwork-id 886 \
  --raw-output artifacts/roboflow/886.json \
  --output artifacts/roboflow/886-normalized.json
```

`artifacts/` is ignored by Git. The script records the freshly executed result as `live`; change the display mode to `saved` when packaging it as a saved example, preserving its actual timestamp. These commands consume hosted inference credits.

## Coordinates and interpretation

Roboflow returns `(x, y)` as a box's center in pixels. For returned image width `W` and height `H`, the top-left corner is `((x - width/2)/W, (y - height/2)/H)`. The other corner is normalized the same way. Both corners are clamped to `[0, 1]`; zero-area boxes outside the image are discarded. We use the **returned image dimensions**, not the museum's original dimensions.

The parser retains only `class: "dog"` at a score of at least `0.1`. The interface can apply a higher threshold locally without making another inference call. Scores are model confidence values, not calibrated probabilities. Low thresholds may expose duplicate predictions, misses, and false positives. Painted dogs differ from the photographs in COCO; these examples are a demonstration, not a validated collection-wide accuracy estimate.

## Limits and failures

The Worker caps request JSON at 1 KiB, image bytes at 8 MiB, and the provider response at 2 MiB. Uploaded container headers must declare at most 20 megapixels and 10,000 pixels on either side. File signatures must match the MIME type; APNG and animated WebP are rejected. Header inspection does not prove that every compressed pixel is valid: Roboflow performs the final decode, with a safe invalid-image error on failure. Roboflow's documented upload limit is 20 MB. A 55-second timeout allows for model cold starts; no automatic retry spends another request without a new user action. Authentication, quota, malformed-output, rate-limit, and timeout states have distinct safe error codes.

The `INFERENCE_RATE_LIMITER` binding admits six requests per minute per network address at a Cloudflare location. Collection inference, uploads, and URL imports share this allowance; upload admission happens before the body is read. Shared networks share this allowance. Cloudflare's limiter is eventually consistent and **is not a global billing cap**. See [Cloudflare's rate-limit behavior](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) and [Roboflow's cold-start and error guidance](https://docs.roboflow.com/deployment/production-checklist).

## Friction encountered

The MCP single-model tool rejected the short `rfdetr-medium` alias; using the pinned model version `coco/40` removed that ambiguity. Museum image URL inference then received an HTTP 403 while the same image could be downloaded locally. Sending the bundled JPEG as base64 succeeded. The application therefore uses the exact local copy shown in its gallery, avoiding a second museum fetch during live inference. A documented alias-to-endpoint mapping and a URL-fetch diagnostic suggesting byte upload would make this path easier to discover.

## Verification

`npm test` covers normalization in portrait and landscape images, boundary clipping, empty results, confidence filtering, corrupt responses, rejected artwork IDs/URLs, bounded requests, private header transport, rate limits, and sanitized provider failures. The first real hosted test on artwork 886 returned dog predictions in approximately 1.08 seconds; that single request is not a latency benchmark.
