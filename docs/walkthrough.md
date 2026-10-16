# Developer walkthrough — target 4:35, hard stop 4:50

Read only the quoted narration. Screen directions and commands are not spoken. Rehearse once with a timer, allowing time for clicks and requests. The assessment requires a video shorter than five minutes.

## Before recording

- Open [La Grande Jatte](https://dogs.zuchka.dev/?artwork=27992#collection) at a readable desktop size, at 35% confidence with the saved result visible.
- Keep the supplied Rijksmuseum still life, `SK-C-301.jpg`, ready in the file picker. It previously returned a correct dog candidate at the lower right; describe the result actually returned, without promising an exact score.
- Open `worker/detections.ts`, `scripts/detect.mjs`, and the README setup instructions in the editor. Increase the font size for the recording.
- Prepare a terminal in the repository with Node 24 and your key already configured in the ignored `.dev.vars` file. Close that file and any credential screens before recording.
- Stage the command below, but run it during the reproduction segment. Outputs go under ignored `artifacts/`.
- Keep another browser tab on the saved La Grande Jatte example for the threshold demonstration. This makes that observed failure repeatable even if the live response changes. Identify it as a saved result when switching.
- If rehearsing live calls, leave a minute before recording so the shared six-request-per-minute limit does not interrupt you.

## 0:00–0:25 — Who this helps

**Show:** The site title, then scroll to the painting and its detail panel.

> This is Dogs in the Details, a computer vision demo for developers building museum and digital-library interfaces. A catalog can tell you a painting contains a dog. I wanted to show where it is, let you inspect the detail, and export the location as data. The gallery contains forty public-domain paintings from the Art Institute of Chicago.

## 0:25–0:55 — Make a live prediction

**Show:** Point to **Saved Roboflow result**, click **Find the dogs again**, and wait for **Live Roboflow result**. Click one detail to highlight its box. Explain the request while it runs.

> These initial boxes are a saved result from an earlier Roboflow run. Clicking here makes a fresh request. My Cloudflare Worker sends the painting to Roboflow Serverless, which runs RF-DETR Medium. Roboflow returns object labels, boxes, and confidence scores. My app keeps the dog predictions and draws them here. These close-ups are crops of the painting. We're locating objects, rather than outlining every pixel of a dog.

## 0:55–2:00 — What RF-DETR and COCO mean

**Show:** Keep the painting and boxes visible for the first paragraph. Then show `worker/detections.ts`: first `MODEL_ID = 'coco/40'`, then `if (prediction.class !== 'dog') continue;`.

> RF-DETR is Roboflow's transformer-based object detector. The version I'm using is already trained on COCO: Common Objects in Context. COCO's detection task has eighty object categories, including dogs, cats, birds, horses, people, chairs, and bottles.
>
> During training, the model learned from photographs with labeled objects and boxes. At runtime, it turns image pixels into visual features and predicts which objects are present and where they are.
>
> I haven't trained it on these paintings, and I'm not sending a prompt saying “find the dogs.” The model produces predictions across its learned categories; this line keeps the ones labeled dog. Uploading an image doesn't retrain it.
>
> Roboflow provides the trained detector and the hosted service that runs it. I don't need to operate a GPU server. My application handles the collection, the interface, and the returned predictions.

## 2:00–2:30 — Show a limitation

**Show:** Switch to the prepared **saved** La Grande Jatte tab. Lower **Minimum confidence** from 35% to 25%. Point to the new box around the monkey at lower right, then restore 35%.

> Back on this saved example, lowering the threshold brings in a monkey that the model labels as a dog. That's a false positive. The slider filters the same predictions; it doesn't call the model again. Confidence is a model score, not a guarantee. Paintings differ from its training photographs, and small or stylized dogs can be missed. No detection doesn't prove there's no dog.

## 2:30–3:05 — Bring your own painting

**Show:** Choose **Try your own painting → Upload**, select `SK-C-301.jpg`, and click **Find the dogs**. Point to the result actually returned and to **JSON**. Mention URL support without attempting a second import.

> You can try an image from your own collection, too. I'll upload this still life and run the same detector. The browser resizes the image and removes embedded metadata before sending it. This app doesn't save uploads to its gallery. Direct image URLs also work when the source permits browser imports; otherwise, download and upload the file. The JSON button exports the detections.

## 3:05–4:10 — Show how to reproduce it

**Show:** In `scripts/detect.mjs`, highlight the `fetch` call, authorization header, and base64 body. Show the README clone/setup instructions. Run this prepared command, then open its JSON output:

```sh
node --env-file=.dev.vars scripts/detect.mjs public/images/886.jpg \
  --artwork-id 886 --output artifacts/walkthrough/result.json
```

> Here's the same inference path without the interface: read an image, send its bytes to Roboflow, and normalize the dog boxes. The API key stays on the server in the website. The endpoint, coco slash forty, pins the hosted model version.
>
> To reproduce this, clone the repository, use Node twenty-four, and put your own Roboflow key in the ignored configuration file. This command runs a prediction without installing any npm packages. The result contains dog labels, scores, and box coordinates expressed as fractions of the image dimensions. Replace the image path to try another painting. Hosted calls use your Roboflow credits.

## 4:10–4:35 — Invite a useful next step

**Show:** Return to the live site and point to the GitHub icon. End with a painting and its result visible.

> This is a starting point for collection exploration, not an accuracy benchmark. Try your own painting at dogs dot zuchka dot dev, then use the GitHub link to inspect or adapt the code. I'd especially like examples of missed dogs or convincing false positives. Those are useful evidence for deciding what to improve next.

## Recording contingencies — not spoken

- If a live request fails or stalls, name that honestly and show the labeled saved result; do not present a cached result as live. Keep one successful live call or CLI run in the take if possible.
- If the upload takes too long, skip the URL explanation and move to the code. Do not keep clicking inference while waiting.
- Aim to finish around 4:35. At 4:30, jump to the closing invitation if needed; stop by 4:50.
- Exact live scores and counts may differ. Describe what is visible instead of reading a predicted outcome from this script.

## Accuracy notes and sources — not spoken

- Say **COCO** like “cocoa.” It is a dataset, not the model. Its standard object-detection task has **80 classes**; `coco/40` means hosted project/version, not forty classes.
- This project uses an RF-DETR **object-detection** checkpoint. Other RF-DETR checkpoints support segmentation, but this application returns rectangular boxes and makes image crops.
- Dog filtering selects an existing category; it does not teach the model a new one. The current website displays dogs only, although the pretrained detector supports the other COCO classes.
- The implementation and recorded fixtures establish this project's behavior. The external references below establish the model and dataset facts, checked October 16, 2026.
- [Roboflow RF-DETR documentation](https://docs.roboflow.com/models/supported-models/rf-detr): transformer-based detector, COCO-pretrained checkpoints, hosted inference.
- [COCO dataset](https://cocodataset.org/): Common Objects in Context.
- [Roboflow's COCO class reference](https://roboflow.com/blog/microsoft-coco-classes): the 80 detection categories.
- [Roboflow model aliases](https://github.com/roboflow/inference/blob/main/inference/models/aliases.py): `rfdetr-medium` maps to `coco/40`.
