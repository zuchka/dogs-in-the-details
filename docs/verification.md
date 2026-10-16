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

A separate copy of the upload-enabled source (commit `b111022`) was downloaded from the public source link and extracted into a clean directory. Every archived file matched that commit. On Node 24.15.0 and npm 11.12.1:

- `npm ci` succeeded, reporting no known vulnerabilities at the time.
- All 30 tests passed.
- `npm run build` passed TypeScript checking and generated production assets.
- The archive included all eight images, eight saved results, and required source files.
- The archive contained no `.dev.vars`, private `.env` file, or configured secret value.

The tests cover center-to-corner normalization, portrait/landscape dimensions, clipping, non-dog filtering, empty/malformed responses, approved image selection, oversized inputs, rate-limit responses, unavailable credentials, upstream failures, timeouts, cross-origin requests, and analytics validation. Tests mock hosted inference; the public-site check above verifies the actual hosted service.

## Visitor-image extension

The upload and image-URL extension was checked against real Roboflow inference through the local browser UI before deployment:

- An uploaded copy of *Three Little Girls* returned one dog above the default 0.35 threshold in approximately 0.8 seconds.
- A direct Art Institute image URL imported successfully through browser CORS and returned two dogs in approximately 0.5 seconds. The remote URL did not enter the inference API request.
- A user-supplied 7,906,092-byte JPEG of the Rijksmuseum's *Banquet Still Life* was normalized from 6111 × 4785 to 2048 × 1604 pixels. Live inference returned the correct lower-right dog at approximately 74% confidence in 1.2 seconds. The nearby monkey was not displayed as a dog at the default threshold.
- The Rijksmuseum collection-page URL was rejected with “This link must point directly to a JPEG, PNG, or WebP image.” This importer accepts image resources, not arbitrary web pages.
- All 30 automated tests passed, along with TypeScript, the production build, and a Wrangler deployment dry run. Added cases cover image headers, dimensions, byte limits, animated-image rejection at the API, shared admission before reading upload bodies, source validation, and new/legacy export events.
- The credential audit passed across tracked files, all Git objects, and the source archive. No configured secret value, token pattern, forbidden secret file, private home path, or personal commit email was found.

After deployment, the public site repeated both paths successfully. The Rijksmuseum upload returned one dog above 0.35 at approximately 74% confidence in 1.3 seconds; the Art Institute URL import returned two dogs in 0.4 seconds. Both JSON exports used `artworkId: null` and the correct `upload`/`url` source without the original filename or remote URL. The URL export emitted its source-based event and received HTTP 202 in Cloudflare logs. Returning to the collection restored the saved museum example. The upload view still had no horizontal overflow at 319 CSS pixels.

The public GitHub repository is [zuchka/dogs-in-the-details](https://github.com/zuchka/dogs-in-the-details). Its focused commit history was preserved; secret files and the user-supplied test image were not published.

The artwork pilot is documented separately in [evaluation.md](evaluation.md). It is qualitative and deliberately includes failures. That initial pilot did not include custom training, segmentation, or a collection-wide benchmark. The later segmentation extension is documented below.

## Forty-work gallery expansion

- The catalog discovery script returned 66 public-domain paintings with an image and dog-related titles or subject tags. Thirty-two were selected before running inference, bringing the gallery to 40 works.
- All 40 manifest entries have unique IDs, museum source links, `publicDomain: true`, and JPEG dimensions matching their local files. The default fetcher reproduces the same 40 IDs.
- Each addition received one real hosted `coco/40` request. All 40 saved result files match their artwork IDs and dimensions, and their normalized boxes stay within the image. The original eight responses and timestamps were reused.
- Among the 32 additions, 23 have at least one candidate above 0.35 and nine have none. This describes model outputs, not accuracy or the number of paintings that actually contain dogs.
- The browser loaded the new *Landscape with Dog* example with a 92% dog candidate. Accent-insensitive search for `raffaelli` returned two works; selecting *Notre Dame de Paris* opened its saved result and correct plate number. An unmatched query showed a clear empty state.
- “Browse all” displayed all 40 cards in a five-column desktop grid and a two-column grid at 375 CSS pixels, with no horizontal page overflow.
- All 30 tests, TypeScript, the production build, and the credential audit passed after the expansion.

## Optional outlines extension

- Three paintings were visually checked with hosted RF-DETR Seg Medium before adding Outlines. The observations, including the monkey false positive in La Grande Jatte, are in [segmentation-evaluation.md](segmentation-evaluation.md).
- All 40 separate segmentation fixtures match their captured responses, image IDs, and dimensions. Their 141 candidates contain 44,004 finite polygon points within normalized image bounds. The original box fixtures are byte-for-byte unchanged.
- All 35 automated tests, TypeScript, the production build, Wrangler dry run, and credential audit passed. New tests cover polygon validation, whole-image coordinate conversion, explicit model selection, and uploaded segmentation.
- Chrome checks verified box/outline switching, reuse of successful results for both upload modes, keyboard polygon selection, hide/show controls, and the selected mode in share links. At 390 CSS pixels, the page had no horizontal overflow and both mode buttons were 44 pixels tall.
- The resized Rijksmuseum upload (2048 × 1604) returned the correct dog at 77.7% in Outlines mode and approximately 74% in Boxes mode. Its downloaded outline JSON recorded `source: upload`, `artworkId: null`, the segmentation checkpoint, and 689 points on the visible dog. These checks ran through the local Worker and the real hosted models.
- On dogs.zuchka.dev, fresh segmentation returned the standing dog in artwork 886 at 90.4%. Switching to Boxes restored its original saved 68.4% candidate; a separate fresh production box request also succeeded. The public source ZIP matched the audited local archive.
- The original box-only source remains available at the [boxes-fallback tag](https://github.com/zuchka/dogs-in-the-details/tree/boxes-fallback). Boxes also remains the default in the deployed interface.

## Recording and submission

The `/assessment` page links the live demo and source, renders the 176-word launch note from its source document, and reserves a clearly labeled space for the recording. Chrome checks covered its desktop layout, section links, and a 390 CSS-pixel mobile view with no horizontal overflow. The production build and all 35 existing tests passed. Video playback remains unverified until the actual MP4 is supplied.

The walkthrough script and launch note are prepared. A human-narrated recording and the final submission email remain manual deliverables. Do not describe those as completed until the video is recorded and the email is actually sent.
