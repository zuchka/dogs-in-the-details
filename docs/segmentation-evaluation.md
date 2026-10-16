# RF-DETR segmentation spot-check

On October 16, 2026, we ran three paintings through Roboflow Serverless using **RF-DETR Seg Medium**, pinned to `coco-dataset-vdnr1/37`. We inspected the returned dog polygons over their source images before adding the optional Outlines mode. The original Boxes mode remains available, with its own checkpoint and saved results.

This is a qualitative feasibility check, not an accuracy benchmark or proof that segmentation is better than detection. These paintings were selected deliberately, no reference masks were annotated, and no precision, recall, or mask-overlap metrics were measured. The [original eight-painting detection pilot](evaluation.md) remains a separate evaluation.

## Observations

The service returned candidates down to 10% confidence. The table describes the default display threshold of **35%**, with lower-scoring candidates noted separately. Scores are rounded and apply to the captured requests, not guaranteed future results.

| Painting and input size | What appeared at 35% | Limitation observed |
| --- | --- | --- |
| *Three Little Girls*, Chicago ID 886, 843 × 1,241 | A useful approximate outline around the large standing dog, score 90.4% | The lapdog candidate scored 34.2%, just below the default threshold. |
| *A Sunday on La Grande Jatte — 1884*, Chicago ID 27992, 843 × 565 | Two foreground dogs, scores 71.1% and 56.6%, plus the monkey at 41.1% | The monkey is a false positive already visible at the default threshold. A detailed silhouette does not establish that the class is correct. |
| Rijksmuseum still life, user-supplied `SK-C-301.jpg`, original 6,111 × 4,785 | A useful outline around the dog at lower right, score 72.9% | Lower thresholds exposed duplicate dog candidates and a monkey candidate at 10.9%. This original-resolution request is distinct from the website's resized upload path. |

The masks followed the main bodies well enough to make the outline interaction useful. Fine boundaries, thin features, and occluded regions should be inspected rather than treated as exact. Small dogs can fall below a chosen confidence threshold, while other animals can pass it.

## Reproduction

Use the committed Chicago images with your own Roboflow key in the ignored `.dev.vars` file:

```sh
node --env-file=.dev.vars scripts/detect.mjs public/images/886.jpg \
  --artwork-id 886 \
  --mode segmentation \
  --raw-output artifacts/segmentation/886-recheck.json

node --env-file=.dev.vars scripts/detect.mjs public/images/27992.jpg \
  --artwork-id 27992 \
  --mode segmentation \
  --raw-output artifacts/segmentation/27992-recheck.json
```

These commands print normalized dog predictions and save the raw provider response under the ignored `artifacts/` directory. Hosted calls consume Roboflow credits. The user-supplied Rijksmuseum file is not included in the repository.

Both modes use COCO-pretrained checkpoints with fixed object categories; there is no text prompt or painting-specific training. The mask polygons are provider predictions, not hand-drawn additions. See [integration notes](roboflow-integration.md) for model mappings, coordinates, and request details.
