# Developer walkthrough — target 4:35, hard stop 4:50

Read only the quoted narration. Screen directions and commands are not spoken. Rehearse once with a timer, allowing time for clicks and requests. The assessment requires a video shorter than five minutes.

## Before recording

- Open [La Grande Jatte](https://dogs.zuchka.dev/?artwork=27992#collection) at a readable desktop size, in **Boxes** mode at 35% confidence with the saved result visible.
- Keep the supplied Rijksmuseum still life, `SK-C-301.jpg`, ready in the file picker. It previously returned a correct dog candidate at the lower right; describe the result actually returned, without promising an exact score.
- Open `worker/detections.ts`, `scripts/detect.mjs`, and the README setup instructions in the editor. Increase the font size for the recording.
- Prepare a terminal in the repository with Node 24 and your key already configured in the ignored `.dev.vars` file. Close that file and any credential screens before recording.
- Stage the command below, but run it during the reproduction segment. It prints JSON directly in the terminal; any optional saved outputs belong under ignored `artifacts/`.
- Keep another browser tab on the saved La Grande Jatte example for the threshold and Outlines demonstration. Check both saved results, then restore Boxes at 35%. This makes the observed failures repeatable even if the live response changes. Identify them as saved results when switching.
- If rehearsing live calls, leave a minute before recording so the shared six-request-per-minute limit does not interrupt you.

## 0:00–0:25 — Who this helps

**Show:** The site title, then scroll to the painting and its detail panel.

> This is Dogs in the Details, a computer vision demo for developers building museum and digital-library interfaces. A catalog can tell you a painting contains a dog. I wanted to show where it is, let you inspect the detail, and export the location as data. The gallery contains forty public-domain paintings from the Art Institute of Chicago.

## 0:25–0:55 — Make a live prediction

**Show:** Point to **Saved Roboflow result**, click **Find the dogs again**, and wait for **Live Roboflow result**. Click one detail to highlight its box. Explain the request while it runs.

> These boxes are a saved result from an earlier Roboflow run. Clicking here makes a fresh request. My Cloudflare Worker sends the painting to Roboflow Serverless, which runs RF-DETR Medium. Roboflow returns object labels, boxes, and confidence scores. My app keeps the dog predictions and draws them here. These close-ups are crops of the painting.

## 0:55–1:50 — What RF-DETR and COCO mean

**Show:** Keep the painting and boxes visible for the first paragraph. Then show `worker/detections.ts`: the pinned `coco/40` model definition, then `if (prediction.class !== 'dog') continue;`.

> RF-DETR is Roboflow's transformer-based model. These checkpoints are already trained on COCO: Common Objects in Context. Its eighty object categories include dogs, cats, birds, people, and umbrellas.
>
> It learned from labeled photographs. At runtime, it turns pixels into visual features and predicts objects and their locations.
>
> I haven't trained it on paintings or sent a prompt saying “find dogs.” The model predicts across its learned categories; this line keeps dog predictions. Uploading an image doesn't retrain it.
>
> Roboflow supplies the model and hosted inference. My app handles the collection, interface, and predictions, without operating a GPU server.

## 1:50–2:35 — Compare boxes and outlines honestly

**Show:** Switch to the prepared **saved** La Grande Jatte tab in Boxes mode. Lower **Minimum confidence** from 35% to 25%. Point to the new box around the monkey at lower right, then restore 35%. Select **Outlines** and point to the dog silhouettes and the monkey false positive. Return to **Boxes** for the upload segment.

> On this saved example, lowering the threshold brings in a monkey labeled as a dog. The slider filters existing predictions without calling Roboflow again.
>
> Outlines uses RF-DETR's separate segmentation checkpoint to estimate each dog's silhouette. Switching can reuse saved results; it isn't just restyling the boxes. Predictions can differ: this checkpoint includes the monkey even at thirty-five percent. A detailed outline doesn't guarantee the label is right. These scores aren't calibrated probabilities. Paintings differ from training photographs, and small dogs can be missed.

## 2:35–3:10 — Bring your own painting

**Show:** Choose **Try your own painting → Upload**, select `SK-C-301.jpg`, and click **Find the dogs**. Point to the result actually returned and to **JSON**. Mention URL support without attempting a second import.

> You can try your own painting in either mode. I'll upload this still life and run the box detector. The browser resizes the image and removes embedded metadata before sending it. This app doesn't save uploads to its gallery. Direct image URLs work when the source permits browser imports; otherwise, download and upload. The JSON button exports the predictions.

## 3:10–4:10 — Show how to reproduce it

**Show:** In `scripts/detect.mjs`, highlight the `fetch` call, authorization header, and base64 body. Show the README clone/setup instructions. Run this prepared command and show the JSON printed directly in the terminal:

```sh
node --env-file=.dev.vars scripts/detect.mjs \
  public/images/886.jpg \
  --artwork-id 886 \
| jq
```

> Here's the same inference path in a script: read an image, send its bytes to Roboflow, and normalize dog predictions. The website's API key stays on the server. Coco slash forty pins the box detector's hosted version.
>
> Clone the repository, use Node twenty-four, and configure your own key in the ignored file. No npm packages are needed for this command. It prints labels, scores, and box coordinates as fractions of the image dimensions. Add mode segmentation to include polygon points from the outline checkpoint. Replace the path to try another image. Hosted calls use your Roboflow credits.

## 4:10–4:35 — Invite a useful next step

**Show:** Return to the live site and point to the GitHub icon. End with a painting and its result visible.

> This is a starting point for collection exploration, not an accuracy benchmark. Try your own painting at dogs dot zuchka dot dev, then use the GitHub link to inspect or adapt the code. I'd especially like examples of missed dogs or convincing false positives. Those are useful evidence for deciding what to improve next.

## Recording contingencies — not spoken

- If a live request fails or stalls, name that honestly and show the labeled saved result; do not present a cached result as live. Keep one successful live call or CLI run in the take if possible.
- If the upload takes too long, skip the URL explanation and move to the code. Do not keep clicking inference while waiting.
- If Outlines is unavailable, keep Boxes selected and skip the segmentation comparison. Do not describe a box as a mask or imply the two checkpoints made the same predictions.
- Aim to finish around 4:35. At 4:30, jump to the closing invitation if needed; stop by 4:50.
- Exact live scores and counts may differ. Describe what is visible instead of reading a predicted outcome from this script.

## Accuracy notes and sources — not spoken

- Say **COCO** like “cocoa.” It is a dataset, not the model. Its standard object-detection task has **80 classes**; `coco/40` means hosted project/version, not forty classes.
- **Boxes** uses the RF-DETR Medium object-detection checkpoint `coco/40`. **Outlines** uses RF-DETR Seg Medium, `coco-dataset-vdnr1/37`, which also returns mask polygons. Both use COCO categories without a text prompt or custom training. Crops remain rectangular in either mode.
- The Boxes and Outlines controls select different checkpoints. Switching can reuse saved or previously fetched results; **Find the dogs** requests fresh inference. The confidence slider never makes a new inference request.
- In the captured La Grande Jatte segmentation result, the monkey false positive scores about 41%, so it appears at the default 35% threshold. That differs from the box-detector failure demonstrated at 25%. Describe the actual mode and result on screen.
- The displayed terminal command uses `jq` only for formatting. Omit `| jq` if it is unavailable; the script already prints formatted JSON. For segmentation, add `--mode segmentation` before the pipe. `--artwork-id` labels the output; it does not choose the model or fetch an image.
- Dog filtering selects an existing category; it does not teach the model a new one. The current website displays dogs only, although the pretrained detector supports the other COCO classes.
- The implementation and recorded fixtures establish this project's behavior. The external references below establish the model and dataset facts, checked October 16, 2026.
- [Roboflow RF-DETR documentation](https://docs.roboflow.com/models/supported-models/rf-detr): transformer-based detector, COCO-pretrained checkpoints, hosted inference.
- [COCO dataset](https://cocodataset.org/): Common Objects in Context.
- [Roboflow's COCO class reference](https://roboflow.com/blog/microsoft-coco-classes): the 80 detection categories.
- [Roboflow model aliases](https://github.com/roboflow/inference/blob/main/inference/models/aliases.py): `rfdetr-medium` maps to `coco/40`; `rfdetr-seg-medium` maps to `coco-dataset-vdnr1/37`.
