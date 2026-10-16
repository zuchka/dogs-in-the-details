import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectImage, resizedDimensions, validateImageUrl } from '../src/image-input.ts';

test('image dimensions are inspected before browser decoding', () => {
  const png = new Uint8Array(24);
  png.set([137, 80, 78, 71], 0);
  png.set([73, 72, 68, 82], 12);
  const data = new DataView(png.buffer);
  data.setUint32(16, 843);
  data.setUint32(20, 565);
  assert.deepEqual(inspectImage(png, 'image/png'), { width: 843, height: 565 });
  data.setUint32(16, 10000);
  data.setUint32(20, 10000);
  assert.throws(() => inspectImage(png, 'image/png'), /40 megapixels/);
});

test('JPEG and WebP dimensions can be read without decoding the image', () => {
  const jpeg = new Uint8Array([255, 216, 255, 224, 0, 4, 0, 0, 255, 192, 0, 8, 8, 2, 53, 3, 75, 0]);
  assert.deepEqual(inspectImage(jpeg, 'image/jpeg'), { width: 843, height: 565 });
  const webp = new Uint8Array(30);
  webp.set(new TextEncoder().encode('RIFF'), 0);
  webp.set(new TextEncoder().encode('WEBPVP8X'), 8);
  webp.set([74, 3, 0, 52, 2, 0], 24);
  assert.deepEqual(inspectImage(webp, 'image/webp'), { width: 843, height: 565 });
  assert.throws(() => inspectImage(jpeg.subarray(0, 13), 'image/jpeg'), /could not be read/);
});

test('output keeps orientation and aspect ratio while limiting the longest edge', () => {
  assert.deepEqual(resizedDimensions(4032, 3024), { width: 2048, height: 1536 });
  assert.deepEqual(resizedDimensions(3024, 4032), { width: 1536, height: 2048 });
  assert.deepEqual(resizedDimensions(843, 565), { width: 843, height: 565 });
});

test('image links permit public HTTPS but reject local hosts and credentials', () => {
  assert.equal(validateImageUrl(' https://www.artic.edu/iiif/image.jpg?size=843 '), 'https://www.artic.edu/iiif/image.jpg?size=843');
  for (const url of ['http://example.com/a.jpg', 'https://localhost/a.jpg', 'https://127.0.0.1/a.jpg', 'https://192.168.1.1/a.jpg', 'https://[::1]/a.jpg', 'https://name:secret@example.com/a.jpg', 'https://example.com/a.jpg#fragment', 'file:///tmp/a.jpg']) {
    assert.throws(() => validateImageUrl(url));
  }
});
