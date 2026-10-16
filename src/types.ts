export type ImageSourceKind = 'collection' | 'upload' | 'url';

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
}

export interface DetectionResult {
  artworkId: number | null;
  // Older saved collection fixtures omit this field.
  source?: ImageSourceKind;
  model: string;
  generatedAt: string;
  mode: 'live' | 'saved';
  durationMs: number;
  image: { width: number; height: number };
  detections: Detection[];
}
