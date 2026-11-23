import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInThisContext } from 'node:vm';

runInThisContext(await readFile(new URL('../../assets/qr-core.js', import.meta.url), 'utf8'), { filename: 'qr-core.js' });
runInThisContext(await readFile(new URL('../../assets/qr-render.js', import.meta.url), 'utf8'), { filename: 'qr-render.js' });

class PixelCanvas {
  constructor(parentWidth = 0) {
    this._width = this._height = 1;
    this.resizes = 0;
    this.allocations = 0;
    this.draws = 0;
    this.style = {};
    this.parentElement = { getBoundingClientRect: () => ({ width: parentWidth }) };
    this.context = {
      createImageData: (width, height) => {
        this.allocations += 1;
        return { width, height, data: new Uint8ClampedArray(width * height * 4) };
      },
      putImageData: (image, x, y) => {
        assert.equal(x, 0);
        assert.equal(y, 0);
        this.draws += 1;
        this.image = image;
      }
    };
  }
  get width() { return this._width; }
  set width(value) { this._width = value; this.resizes += 1; }
  get height() { return this._height; }
  set height(value) { this._height = value; this.resizes += 1; }
  getContext(type) { assert.equal(type, '2d'); return this.context; }
}

const original = Uint8Array.from({ length: 600 }, (_, i) => (i * 83 + (i >> 3)) % 256);
const qr = WGQR.encodeBytes(original);

test('filled previews retain a uniform bitmap that round-trips binary bytes at phone and desktop sizes', () => {
  for (const [cssWidth, pixelRatio] of [[220, 2], [420, 1], [715.5, 1.25], [680, 2]]) {
    const canvas = new PixelCanvas();
    const metrics = WGRender.drawQR(qr, canvas, { cssWidth, pixelRatio });
    const result = WGQR.decodePixels(canvas.image.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
    assert.ok(result, `Must decode at ${cssWidth} CSS pixels and DPR ${pixelRatio}`);
    assert.deepEqual(Buffer.from(result.bytes), Buffer.from(original));
    assert.ok(Number.isInteger(metrics.scale));
    assert.equal(canvas.width, canvas.height);
    assert.equal(metrics.cssSide, cssWidth);
    assert.equal(Number.parseFloat(canvas.style.width), cssWidth);
    assert.ok(metrics.size >= cssWidth * pixelRatio, 'Preview must not enlarge an undersized bitmap.');
    assert.ok(metrics.size < cssWidth * pixelRatio + metrics.modules);
    assert.equal(canvas.draws, 1);
  }
});

test('dense previews fill their fields across the one-to-two-pixel module threshold', () => {
  for (const length of [476, 692]) {
    const bytes = Uint8Array.from({ length }, (_, i) => (i * 47 + (i >> 2)) % 256);
    const dense = WGQR.encodeBytes(bytes);
    assert.ok([85, 101].includes(dense.size));
    for (const cssWidth of [160, 190, 210, 217, 218]) {
      for (const pixelRatio of [1, 2]) {
        const canvas = new PixelCanvas();
        const result = WGRender.drawQR(dense, canvas, { cssWidth, pixelRatio });
        assert.equal(result.cssSide, cssWidth, 'Do not leave an unused strip as wide as a whole QR module grid.');
        assert.equal(canvas.style.width, `${cssWidth}px`);
        assert.equal(canvas.width % (dense.size + 8), 0, 'The native bitmap must keep equal-sized modules.');
        assert.ok(canvas.width >= cssWidth * pixelRatio);
        const decoded = WGQR.decodePixels(canvas.image.data, canvas.width, canvas.height);
        assert.deepEqual(Buffer.from(decoded?.bytes || []), Buffer.from(bytes));
      }
    }
  }
});

test('PNG exports keep their original integer module size and four-module margin', () => {
  const canvas = new PixelCanvas();
  const result = WGRender.drawQR(qr, canvas, { cssWidth: 960, pixelRatio: 1, integerScale: true });
  assert.equal(result.size, Math.floor(960 / (qr.size + 8)) * (qr.size + 8));
  assert.equal(result.cssSide, result.size);
  assert.equal(canvas.style.width, `${result.size}px`);
  const decoded = WGQR.decodePixels(canvas.image.data, canvas.width, canvas.height);
  assert.deepEqual(Buffer.from(decoded.bytes), Buffer.from(original));
});

test('fitting a large preview keeps the bitmap allocation within the side limit', () => {
  const canvas = new PixelCanvas();
  const result = WGRender.drawQR(qr, canvas, { cssWidth: 4096, pixelRatio: 2 });
  assert.equal(result.cssSide, 4096);
  assert.ok(result.size <= 4096);
  assert.equal(result.size % (qr.size + 8), 0);
});

test('quiet zone is four full white modules and all pixels are opaque black or white', () => {
  const canvas = new PixelCanvas();
  const { scale, size } = WGRender.drawQR(qr, canvas, { cssWidth: 600, pixelRatio: 1 });
  const margin = 4 * scale;
  const pixels = canvas.image.data;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const value = pixels[offset];
      assert.ok(value === 0 || value === 255);
      assert.equal(pixels[offset + 1], value);
      assert.equal(pixels[offset + 2], value);
      assert.equal(pixels[offset + 3], 255);
      if (x < margin || y < margin || x >= size - margin || y >= size - margin) assert.equal(value, 255);
    }
  }
});

test('layout measurement subtracts padding and borders before selecting pixel size', () => {
  const previous = globalThis.getComputedStyle;
  globalThis.getComputedStyle = () => ({ paddingLeft: '12.25px', paddingRight: '12.25px', borderLeftWidth: '1px', borderRightWidth: '1px' });
  try {
    const canvas = new PixelCanvas(410.5);
    const result = WGRender.drawQR(qr, canvas, { pixelRatio: 2 });
    assert.equal(result.measured, true);
    assert.equal(result.cssSide, 384);
  } finally {
    if (previous === undefined) delete globalThis.getComputedStyle;
    else globalThis.getComputedStyle = previous;
  }
});

test('same-sized frames reuse the pixel surface and clear previous black modules', () => {
  const canvas = new PixelCanvas();
  WGRender.drawQR(qr, canvas, { cssWidth: 500 });
  const image = canvas.image;
  const secondBytes = Uint8Array.from(original, value => value ^ 0xff);
  const second = WGQR.encodeBytes(secondBytes);
  assert.equal(second.size, qr.size);
  WGRender.drawQR(second, canvas, { cssWidth: 500 });
  assert.equal(canvas.allocations, 1);
  assert.equal(canvas.resizes, 2);
  assert.equal(canvas.image, image);
  const decoded = WGQR.decodePixels(canvas.image.data, canvas.width, canvas.height);
  assert.deepEqual(Buffer.from(decoded.bytes), Buffer.from(secondBytes));
});

test('hidden canvas uses a bounded responsive fallback and can be resized on reveal', () => {
  const canvas = new PixelCanvas();
  const fallback = WGRender.drawQR(qr, canvas);
  assert.equal(fallback.measured, false);
  assert.ok(fallback.size <= 960);
  assert.equal(canvas.style.width, '100%');
  assert.equal(canvas.style.height, 'auto');
  const visible = WGRender.drawQR(qr, canvas, { cssWidth: 380, pixelRatio: 2 });
  assert.equal(visible.measured, true);
  assert.ok(visible.cssSide <= 380);
  assert.equal(canvas.allocations, 2);
});


test('clearing a canvas erases cached pixels and allocates a fresh surface on reuse', () => {
  const canvas = new PixelCanvas();
  WGRender.drawQR(qr, canvas, { cssWidth: 500 });
  const previous = canvas.image.data;
  WGRender.clear(canvas);
  assert.equal(canvas.width, 1);
  assert.equal(canvas.height, 1);
  assert.ok(previous.every(value => value === 0));
  WGRender.drawQR(qr, canvas, { cssWidth: 500 });
  assert.equal(canvas.allocations, 2);
  const decoded = WGQR.decodePixels(canvas.image.data, canvas.width, canvas.height);
  assert.deepEqual(Buffer.from(decoded.bytes), Buffer.from(original));
});
