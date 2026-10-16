export type ImageSourceKind = 'collection' | 'upload' | 'url';
export type InferenceMode = 'detection' | 'segmentation';

export interface DisplayImage {
  title: string;
  image: string;
  width: number;
  height: number;
}

export interface Artwork extends DisplayImage {
  id: number;
  artist: string;
  date: string;
  imageId: string;
  sourceUrl: string;
  credit: string;
  publicDomain: true;
  note?: string;
}

// Coordinates are fractions of the original image, measured from the top left.
export interface Detection {
  id: string;
  label: 'dog';
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
  // Optional segmentation polygon, in the same whole-image coordinate space.
  points?: { x: number; y: number }[];
}

export interface DetectionResult {
  artworkId: number | null;
  // Older saved collection fixtures omit this field.
  source?: ImageSourceKind;
  // Older box fixtures omit this field and remain valid.
  inferenceMode?: InferenceMode;
  model: string;
  generatedAt: string;
  mode: 'live' | 'saved';
  durationMs: number;
  image: { width: number; height: number };
  detections: Detection[];
}
