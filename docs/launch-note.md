# Launch and feedback note

I'd share Dogs in the Details on the Code4Lib mailing list, where developers working with museums, libraries, and archives exchange practical tools. A catalog tag can tell you a painting contains a dog; this demo shows where it is and gives you an inspectable crop and JSON coordinates. Try the public demo, then download the source and run the one-command example on an image from your own collection.

My initial measure would be unique anonymous sessions that run live inference and export its JSON. The app emits `live_inference_exported` with a session ID; I'd count distinct IDs in Cloudflare logs over the first seven days. This measures hands-on trial, not production adoption. Follow-up feedback would tell me whether the coordinates were useful in a collection workflow.

One friction point: Roboflow's documentation introduces `rfdetr-medium`, but the MCP inference tool rejects that alias and requires a two-part model ID. I resolved it to `coco/40` using Roboflow's SDK source. I'd make the tool accept the same aliases, or return the exact supported ID and a working request example in its error.
