import type { Detection, DetectionResult } from '../src/types.ts';

// Pinned resolution of Roboflow's rfdetr-medium alias, verified in its SDK.
export const MODEL_ID = 'coco/40';
export const MODEL_NAME = 'rfdetr-medium (coco/40)';
export const CONFIDENCE_FLOOR = 0.1;

export class InvalidInferenceResponse extends Error {
  constructor() {
    super('Roboflow returned an invalid detection response.');
    this.name = 'InvalidInferenceResponse';
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Roboflow boxes are center-based pixels in the returned image's coordinate space. */
export function normalizeDetections(raw: unknown): Pick<DetectionResult, 'image' | 'detections'> {
  if (!record(raw) || !record(raw.image) || !Array.isArray(raw.predictions)) {
    throw new InvalidInferenceResponse();
  }
  const { width, height } = raw.image;
  if (!finite(width) || !finite(height) || width <= 0 || height <= 0) {
    throw new InvalidInferenceResponse();
  }

  const detections: Detection[] = [];
  for (const [index, prediction] of raw.predictions.entries()) {
    if (!record(prediction) || typeof prediction.class !== 'string') {
      throw new InvalidInferenceResponse();
    }
    if (prediction.class !== 'dog') continue;
    const { x, y, width: boxWidth, height: boxHeight, confidence } = prediction;
    if (!finite(x) || !finite(y) || !finite(boxWidth) || !finite(boxHeight)
      || !finite(confidence) || boxWidth <= 0 || boxHeight <= 0
      || confidence < 0 || confidence > 1) {
      throw new InvalidInferenceResponse();
    }
    if (confidence < CONFIDENCE_FLOOR) continue;
    const left = clamp((x - boxWidth / 2) / width);
    const top = clamp((y - boxHeight / 2) / height);
    const right = clamp((x + boxWidth / 2) / width);
    const bottom = clamp((y + boxHeight / 2) / height);
    if (right <= left || bottom <= top) continue;
    detections.push({
      id: `dog-${index}`, label: 'dog', confidence,
      x: left, y: top, width: right - left, height: bottom - top,
    });
  }
  return { image: { width, height }, detections };
}
