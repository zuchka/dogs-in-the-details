export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_SIDE = 10_000;
export const MAX_IMAGE_PIXELS = 20_000_000;

export class InvalidImage extends Error {
  constructor(message = 'This image is damaged or does not match its file type. Choose a JPEG, PNG, or WebP image.') {
    super(message);
    this.name = 'InvalidImage';
  }
}

type ImageSize = { width: number; height: number };
const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length));

function jpegSize(bytes: Uint8Array, view: DataView): ImageSize {
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8
    || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) throw new InvalidImage();
  let offset = 2;
  while (offset < bytes.length - 2) {
    if (bytes[offset++] !== 0xff) throw new InvalidImage();
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === undefined || marker === 0xda || marker === 0xd9 || marker === 0x00) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) throw new InvalidImage();
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > bytes.length - 2) throw new InvalidImage();
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (length < 8) throw new InvalidImage();
      return { width: view.getUint16(offset + 5), height: view.getUint16(offset + 3) };
    }
    offset += length;
  }
  throw new InvalidImage();
}

function pngSize(bytes: Uint8Array, view: DataView): ImageSize {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 45 || !signature.every((value, i) => bytes[i] === value)
    || view.getUint32(8) !== 13 || ascii(bytes, 12, 4) !== 'IHDR') throw new InvalidImage();
  const size = { width: view.getUint32(16), height: view.getUint32(20) };
  let offset = 8;
  let hasPixels = false;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const chunk = ascii(bytes, offset + 4, 4);
    if (offset + 12 + length > bytes.length) throw new InvalidImage();
    if (chunk === 'acTL') throw new InvalidImage('Animated images are not supported. Choose a still image.');
    if (chunk === 'IDAT') hasPixels = true;
    offset += 12 + length;
    if (chunk === 'IEND') {
      if (length !== 0 || !hasPixels || offset !== bytes.length) throw new InvalidImage();
      return size;
    }
  }
  throw new InvalidImage();
}

function webpSize(bytes: Uint8Array, view: DataView): ImageSize {
  if (bytes.length < 26 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP'
    || view.getUint32(4, true) + 8 !== bytes.length) throw new InvalidImage();
  let offset = 12;
  let canvas: ImageSize | undefined;
  let pixels: ImageSize | undefined;
  while (offset + 8 <= bytes.length) {
    const chunk = ascii(bytes, offset, 4);
    const length = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (start + length + (length % 2) > bytes.length) throw new InvalidImage();
    if (chunk === 'ANIM' || chunk === 'ANMF') throw new InvalidImage('Animated images are not supported. Choose a still image.');
    if (chunk === 'VP8X') {
      if (length !== 10) throw new InvalidImage();
      if ((bytes[start] & 0x02) !== 0) throw new InvalidImage('Animated images are not supported. Choose a still image.');
      const uint24 = (index: number) => bytes[index] + (bytes[index + 1] << 8) + (bytes[index + 2] << 16);
      canvas = { width: uint24(start + 4) + 1, height: uint24(start + 7) + 1 };
    } else if (chunk === 'VP8 ') {
      if (length < 10 || bytes[start + 3] !== 0x9d || bytes[start + 4] !== 0x01 || bytes[start + 5] !== 0x2a) throw new InvalidImage();
      pixels = { width: view.getUint16(start + 6, true) & 0x3fff, height: view.getUint16(start + 8, true) & 0x3fff };
    } else if (chunk === 'VP8L') {
      if (length < 5 || bytes[start] !== 0x2f) throw new InvalidImage();
      const dimensions = view.getUint32(start + 1, true);
      pixels = { width: (dimensions & 0x3fff) + 1, height: ((dimensions >>> 14) & 0x3fff) + 1 };
    }
    offset = start + length + (length % 2);
  }
  if (offset !== bytes.length || !pixels
    || (canvas && (canvas.width !== pixels.width || canvas.height !== pixels.height))) throw new InvalidImage();
  return canvas ?? pixels;
}

// This validates container headers and declared size. Roboflow performs the final pixel decode.
export function inspectImage(bytes: Uint8Array, contentType: string): ImageSize {
  if (bytes.length > MAX_IMAGE_BYTES) throw new InvalidImage('Images must be 8 MiB or smaller.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let size: ImageSize;
  if (contentType === 'image/jpeg') size = jpegSize(bytes, view);
  else if (contentType === 'image/png') size = pngSize(bytes, view);
  else if (contentType === 'image/webp') size = webpSize(bytes, view);
  else throw new InvalidImage('Choose a JPEG, PNG, or WebP image.');
  if (size.width < 1 || size.height < 1 || size.width > MAX_IMAGE_SIDE || size.height > MAX_IMAGE_SIDE
    || size.width * size.height > MAX_IMAGE_PIXELS) {
    throw new InvalidImage('Images must be at most 20 megapixels and 10,000 pixels on either side.');
  }
  return size;
}
