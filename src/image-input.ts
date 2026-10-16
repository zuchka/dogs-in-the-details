export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;
const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface CustomImage {
  source: 'upload' | 'url';
  image: string;
  width: number;
  height: number;
  blob?: Blob;
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

/** Inspect dimensions before decoding, including small compressed image bombs. */
export function inspectImage(bytes: Uint8Array, type: string) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0;
  let height = 0;
  if (type === 'image/png' && bytes.length >= 24 && bytes[0] === 137 && ascii(bytes, 1, 3) === 'PNG' && ascii(bytes, 12, 4) === 'IHDR') {
    width = view.getUint32(16);
    height = view.getUint32(20);
  } else if (type === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 3 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker) && length >= 7) {
        height = view.getUint16(offset + 3);
        width = view.getUint16(offset + 5);
        break;
      }
      offset += length;
    }
  } else if (type === 'image/webp' && bytes.length >= 30 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    const format = ascii(bytes, 12, 4);
    if (format === 'VP8X') {
      width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    } else if (format === 'VP8L' && bytes[20] === 0x2f) {
      width = 1 + bytes[21] + ((bytes[22] & 0x3f) << 8);
      height = 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10);
    } else if (format === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      width = view.getUint16(26, true) & 0x3fff;
      height = view.getUint16(28, true) & 0x3fff;
    }
  }
  if (!width || !height) throw new Error('This file could not be read as a JPEG, PNG, or WebP image.');
  if (width * height > MAX_IMAGE_PIXELS || Math.max(width, height) > 16384) {
    throw new Error('Please use an image under 40 megapixels and 16,384 pixels on either side.');
  }
  return { width, height };
}

export function resizedDimensions(width: number, height: number) {
  const scale = Math.min(1, 2048 / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function prepareUpload(file: File): Promise<CustomImage> {
  if (!SUPPORTED_TYPES.includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('This file is over 8 MB. Please choose a smaller image.');
  inspectImage(new Uint8Array(await file.arrayBuffer()), file.type);
  // Browser decoding applies EXIF orientation before the pixels are redrawn.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const { width, height } = resizedDimensions(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare this image. Try a different browser.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('This image could not be prepared. Try a different file.')), 'image/jpeg', 0.9));
    if (blob.size > MAX_IMAGE_BYTES) throw new Error('The prepared image is too large. Please choose a smaller image.');
    return { source: 'upload', image: URL.createObjectURL(blob), width, height, blob };
  } finally {
    bitmap.close();
  }
}

export function validateImageUrl(input: string) {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error('Paste a complete HTTPS link to an image.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.port) throw new Error('Use a public HTTPS image link without a password, custom port, or URL fragment.');
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || !hostname.includes('.') || /^[\d.]+$/.test(hostname) || hostname.includes(':')) {
    throw new Error('Use a public image website, or upload the image from your device.');
  }
  if (url.href.length > 2048) throw new Error('This image link is too long. Please upload the image instead.');
  if (typeof window !== 'undefined' && url.origin === window.location.origin && /^\/api(?:\/|$)/.test(decodeURIComponent(url.pathname))) throw new Error('Use a direct image link, or upload an image from your device.');
  return url.href;
}

export async function previewImageUrl(input: string): Promise<CustomImage> {
  const url = validateImageUrl(input);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal: controller.signal });
    if (!response.ok || !response.body) throw new Error('This image host did not return an image. Download the image and upload it here instead.');
    const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
    if (!SUPPORTED_TYPES.includes(type)) throw new Error('This link must point directly to a JPEG, PNG, or WebP image.');
    if (Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) throw new Error('This image is over 8 MB. Download a smaller version and upload it here.');
    const reader = response.body.getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_IMAGE_BYTES) {
          await reader.cancel();
          throw new Error('This image is over 8 MB. Download a smaller version and upload it here.');
        }
        chunks.push(new Uint8Array(value));
      }
    } finally { reader.releaseLock(); }
    const prepared = await prepareUpload(new File(chunks, 'imported-image', { type }));
    return { ...prepared, source: 'url' };
  } catch (failure) {
    if (failure instanceof TypeError || (failure instanceof Error && failure.name === 'AbortError')) {
      throw new Error('This host blocks image imports, redirects, or took too long to respond. Download the image and use Upload instead.');
    }
    throw failure;
  } finally {
    window.clearTimeout(timeout);
  }
}
