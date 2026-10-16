# Pilot evaluation: Dogs in the Details

This is the original eight-image pilot. The gallery has since expanded to 40
paintings; the 32 additions have genuine saved hosted results but were not added
to this manually compared pilot. See [artwork notes](artwork-notes.md) for the
selection method. Do not generalize the pilot's findings to the expanded gallery.

Eight Art Institute of Chicago paintings were inspected visually and processed
once each through Roboflow's hosted `rfdetr-medium` model, pinned to `coco/40`.
The existing response for artwork 886 was reused; seven additional requests were
made sequentially. No training, retries, or alternative-model selection was
used to improve these results. Source images are the 843-pixel-wide museum
JPEGs listed in `public/artworks.json`.

The API requested detections down to score 0.10. The application defaults to
displaying scores of at least 0.35. These are model scores, not calibrated
probabilities that a detected object is a dog. Only predictions labeled `dog`
are passed to the UI. Scores and box coordinates are preserved in
`public/results/{id}.json`; changing a display threshold does not rerun inference.

## Results at the default 0.35 threshold

The observations below compare returned box locations with the inspected
source paintings. They are a small, deliberately selected demonstration, not
an independently annotated benchmark or evidence of collection-wide accuracy.

| ID / painting | Dogs visually observed | Displayed dog boxes at 0.35 | Displayed scores | Observation |
| --- | ---: | ---: | --- | --- |
| 20697 / Portrait of a Lady with a Dog | 1 | 2 | 0.465, 0.368 | Both boxes cover the same lap dog; the second is much broader. One dog must not be reported as two dogs. |
| 886 / Three Little Girls | 2 | 1 | 0.684 | Finds the standing dog. The lap puppy scores 0.275, below the default threshold. |
| 896 / The Road to Market | 1 | 0 | — | Misses the dark dog at the far-right edge. The only returned dog candidate scores 0.192 in a different, upper-central region. |
| 497 / A Mother Feeding her Child | 1 | 1 | 0.453 | Box matches the small dog at the mother's feet. |
| 561 / The Family Concert | 1 | 1 | 0.918 | Box matches the dog at lower left. The cat is not displayed as a dog at the default threshold. |
| 27992 / A Sunday on La Grande Jatte | 2 | 2 | 0.649, 0.467 | Boxes match the dark foreground dog and the smaller brown foreground dog. |
| 20684 / Paris Street; Rainy Day | 0 observed | 0 | — | No dog predictions, including at the API's 0.10 floor. |
| 111436 / The Basket of Apples | 0 observed | 0 | — | No dog predictions, including at the API's 0.10 floor. |

The default view has no inspected non-dog false positives in these eight images,
but it includes a duplicate box and misses two visible dogs. This does not
establish a general false-positive rate. At lower thresholds, non-dog false
positives and duplicate boxes become visible:

- **The Family Concert:** the cat receives a dog score of 0.166. A small extra
  box around part of the real dog's head scores 0.114.
- **La Grande Jatte:** the monkey beside the woman receives a dog score of 0.284.
  Several additional weak dog candidates are unrelated details, and some repeat
  the true dog boxes.
- **Three Little Girls:** lowering to 0.25 reveals the real lap puppy, while a
  further drop below 0.175 adds another box around the standing dog.
- **Portrait of a Lady with a Dog:** 16 dog boxes are returned at the 0.10 floor,
  largely overlapping the lap and dog region. Box count is not animal count.

## Recommended walkthrough

Use **The Family Concert (561)** as the opening example: the dog is easy to
verify, the score is comfortably above the default threshold, and the adjacent
cat makes threshold tradeoffs visible. Start at 0.35, then move to 0.15 and show
the false detection on the cat. Return to 0.35 before moving on.

Use **Three Little Girls (886)** to show a different tradeoff: at 0.25 the small
puppy appears alongside the larger dog. Use **The Road to Market (896)** as an
honest failure, and a negative control to show the empty state. La Grande Jatte
is a good second success, with two different-sized dogs and a monkey that is
mistaken for a dog only at a lower threshold.

The six positive paintings already have dog subject tags in the museum's
catalog. This demonstration adds image-level localization and inspection; it
does not establish that the museum's catalog omitted those dogs.

## Response provenance and reproduction

Saved fixtures preserve the original model name, response timestamp, elapsed
request time, image dimensions, and detections. Only `mode` changes from `live`
to `saved`. The eight measured request durations ranged from **263 to 1,081 ms**;
this single small run is not a latency guarantee and does not measure UI load
time. Live calls can return different results or take longer.

Raw responses are retained locally under the gitignored `artifacts/roboflow/`
directory. The public JSON contains dog detections only and no credentials.

To rebuild public fixtures from captured local responses, without any network
requests:

```sh
node scripts/generate-results.mjs
```

To make one hosted request for each missing captured response, with the API key
in the gitignored `.dev.vars` file:

```sh
node --env-file=.dev.vars scripts/generate-results.mjs --run-missing
```

The second command consumes Roboflow inference usage for missing responses. It
reuses existing responses and stops on an error instead of automatically
retrying a model call. Node 22.18 or later is required by the detector script.

Before publication, saved responses were checked against their original
normalized captures, every returned image size matched the source asset, and
all normalized boxes were verified to stay within the image boundary.
