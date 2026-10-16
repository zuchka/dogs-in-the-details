# Developer walkthrough — target 4:30

Record one take with the browser and editor at a readable zoom. Close secret files and hide terminal history that could contain credentials. Use your own voice; this is a teaching demo, not a polished commercial.

## Before recording

- Open https://dogs.zuchka.dev on La Grande Jatte.
- Keep `public/images/886.jpg` ready in the file picker for the upload demonstration.
- Open `scripts/detect.mjs`, `worker/detections.ts`, and `README.md` in the editor.
- Prepare a terminal in the project with Node 24 and `.dev.vars` configured. Do not open the secret file on screen.
- Make one rehearsal live call, then wait a minute so the public demo's request limit will not interrupt the recording.
- Start with the saved example visible and clearly explain its label.

## 0:00–0:35 — Problem and audience

“I'm building for developers who work with museum and digital-library collections. Catalog search can tell you a painting contains a dog. It doesn't show you where to look. Dogs in the Details turns that label into a box, a close-up, and a reusable JSON result.”

“These are public-domain paintings from the Art Institute of Chicago. This small collection was selected for a demo; I'm not claiming a collection-wide accuracy result.”

## 0:35–1:15 — Show a real prediction

Point to the saved-result label, then click **Find the dogs**.

“The initial example is a saved, genuine Roboflow result. This button runs the model again. The browser calls my Cloudflare Worker, and the Worker sends the image to Roboflow Serverless. Roboflow runs RF-DETR Medium, its pretrained object-detection model.”

Select each dog detail. Show its box in the painting and its enlarged crop.

“This is detection: rectangular boxes and confidence scores. It isn't segmentation, and the close-up is simply a crop of the original image.”

## 1:15–1:45 — Try another image

Choose **Upload**, select the prepared painting, then click **Find the dogs**. Point to the live-result label and the JSON export.

“You can also test your own collection. The browser prepares the image, and the same hosted detector runs on it. A direct image URL works when the source website allows browser imports; otherwise, download and upload the file. The app does not add these images to a public gallery.”

Return to La Grande Jatte using the collection.

## 1:45–2:15 — Teach the limitation

Lower the threshold to 0.25 on La Grande Jatte and point out the monkey candidate. Restore 0.35.

“A lower threshold admits more uncertain predictions. Here the monkey becomes a false dog candidate. The slider filters the same response; it doesn't call Roboflow again. Scores aren't a guarantee, and a human still needs to inspect the result.”

“A no-detection result is not proof of absence.” Skip switching to additional paintings to keep the recording short.

## 2:15–3:10 — Explain the implementation

Open `scripts/detect.mjs`, then `worker/detections.ts`.

“The small script is the whole inference path without the UI. It reads an image, sends base64 bytes to Roboflow with a server-side bearer key, and filters the response to the dog class. I pin the REST endpoint to coco/40, the version behind the rfdetr-medium alias.”

“Roboflow returns center-based pixel coordinates. I convert the left edge to x minus half the width, then divide by the image width. Normalized coordinates keep the overlay aligned as the browser resizes the painting.”

“Collection requests use approved painting IDs. Visitor images use a bounded upload endpoint with format and dimension checks. Both share a request limit, and the key never reaches the browser.”

## 3:10–4:00 — Reproduce it

Show the README setup, then run:

```sh
node --env-file=.dev.vars scripts/detect.mjs public/images/886.jpg --artwork-id 886 --output result.json
```

Open `result.json`.

“Use Node 24, put your own Roboflow key in the ignored .dev.vars file, and run this command. It doesn't need a GPU or an npm install. Replace the image path to test your own painting. The full UI uses npm ci, npm run build, and npm run preview.”

## 4:00–4:30 — Decisions and invitation

“I used a pretrained model and a small, verified public-domain collection so the work could fit in four hours. RF-DETR can miss small or stylized dogs, confuse other animals, or produce overlapping boxes. The evaluation notes include those failures.”

“Try the public demo with an image from your own collection, then get the source on GitHub. I'd especially like examples where the detector misses an obvious dog or mistakes another animal for one.”

Stop by 4:45 even if you skip the final sentence. The assessment requires a recording shorter than five minutes.
