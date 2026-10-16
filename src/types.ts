export interface Artwork {
  id: number;
  title: string;
  artist: string;
  date: string;
  image: string;
  imageId: string;
  sourceUrl: string;
  width: number;
  height: number;
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
  artworkId: number;
  model: string;
  generatedAt: string;
  mode: 'live' | 'saved';
  durationMs: number;
  image: { width: number; height: number };
  detections: Detection[];
}
