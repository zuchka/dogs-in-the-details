# Verification record

Checked on October 16, 2026 during the four-hour build.

## Working product

- `https://dogs.zuchka.dev` serves the app over HTTPS without sign-in.
- The production `/api/health` reports `configured: true` without exposing the key.
- Clicking the live inference button on the public site returned RF-DETR Medium predictions for artwork 27992 in approximately 1.1 seconds. The two dog candidates above 0.35 matched the inspected foreground dogs.
- Lowering the threshold to 0.25 showed the known monkey false positive without another model call.
- Exporting a live result sent `live_inference_exported`; Cloudflare recorded the structured event and returned HTTP 202.
- The downloadable project source returned HTTP 200 with `application/zip`.
- At a 319 CSS-pixel viewport, the document and body width were both 319 pixels: no horizontal page overflow.

## Reproducibility and automated checks

A separate copy was downloaded from the public source link and extracted into a clean directory. On Node 24.15.0 and npm 11.12.1:

- `npm ci` succeeded, reporting no known vulnerabilities at the time.
- All 16 tests passed.
- `npm run build` passed TypeScript checking and generated production assets.
- The archive included all eight images, eight saved results, and required source files.
- The archive contained no `.dev.vars`, private `.env` file, or configured secret value.

The tests cover center-to-corner normalization, portrait/landscape dimensions, clipping, non-dog filtering, empty/malformed responses, approved image selection, oversized inputs, rate-limit responses, unavailable credentials, upstream failures, timeouts, cross-origin requests, and analytics validation. Tests mock hosted inference; the public-site check above verifies the actual hosted service.

The artwork pilot is documented separately in [evaluation.md](evaluation.md). It is qualitative and deliberately includes failures. No custom training, segmentation, visitor uploads, or collection-wide benchmark was attempted.

## Recording and submission

The walkthrough script and launch note are prepared. A human-narrated recording and the final submission email remain manual deliverables. Do not describe those as completed until the video is recorded and the email is actually sent.
