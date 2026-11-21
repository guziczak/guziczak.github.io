import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInThisContext } from 'node:vm';

// Main-realm evaluation avoids sandbox-realm overhead in the small timing check.
runInThisContext(await readFile(new URL('../../assets/qr-core.js', import.meta.url), 'utf8'), { filename: 'qr-core.js' });
runInThisContext(await readFile(new URL('../../assets/qr-transfer.js', import.meta.url), 'utf8'), { filename: 'qr-transfer.js' });
runInThisContext(await readFile(new URL('../../assets/qr-camera.js', import.meta.url), 'utf8'), { filename: 'qr-camera.js' });
const { WGQR, WGTransfer, WGCamera } = globalThis;
const original = Uint8Array.from({ length: 601 }, (_, index) => (index * 73 + Math.floor(index / 256)) % 256);
const transfer = await WGTransfer.createTransfer(original, 'kamera.bin');
const frame = transfer.frames[0];
const qr = WGQR.encodeBytes(frame);

class PixelCanvas {
  constructor() {
    this.pixelWidth = 300;
    this.pixelHeight = 150;
    this.resizes = 0;
    this.clears = 0;
    this.draws = [];
    this.rgba = new Uint8ClampedArray(this.width * this.height * 4);
    this.context = {
      drawImage: (...args) => this.draw(...args),
      getImageData: (x, y, width, height) => {
        assert.equal(x, 0);
        assert.equal(y, 0);
        assert.equal(width, this.width);
        assert.equal(height, this.height);
        return { data: new Uint8ClampedArray(this.rgba), width, height };
      },
      clearRect: () => { this.clears++; this.rgba.fill(0); }
    };
  }
  get width() { return this.pixelWidth; }
  set width(value) { this.pixelWidth = value; this.resizes++; this.rgba = new Uint8ClampedArray(this.width * this.height * 4); }
  get height() { return this.pixelHeight; }
  set height(value) { this.pixelHeight = value; this.resizes++; this.rgba = new Uint8ClampedArray(this.width * this.height * 4); }
  getContext(type, options) {
    assert.equal(type, '2d');
    assert.equal(options.willReadFrequently, true);
    return this.context;
  }
  draw(video, sx, sy, sw, sh, dx, dy, dw, dh) {
    assert.equal(dx, 0);
    assert.equal(dy, 0);
    assert.ok(sx >= 0 && sy >= 0 && sx + sw <= video.videoWidth && sy + sh <= video.videoHeight);
    this.draws.push({ sx, sy, sw, sh, dw, dh });
    for (let y = 0; y < dh; y++) {
      const sourceY = Math.min(video.videoHeight - 1, Math.floor(sy + (y + 0.5) * sh / dh));
      for (let x = 0; x < dw; x++) {
        const sourceX = Math.min(video.videoWidth - 1, Math.floor(sx + (x + 0.5) * sw / dw));
        const source = (sourceY * video.videoWidth + sourceX) * 4;
        const target = (y * dw + x) * 4;
        this.rgba[target] = video.rgba[source];
        this.rgba[target + 1] = video.rgba[source + 1];
        this.rgba[target + 2] = video.rgba[source + 2];
        this.rgba[target + 3] = video.rgba[source + 3];
      }
    }
  }
}

function scannerWithCanvas(decode = WGQR.decodePixels) {
  const canvas = new PixelCanvas();
  const previous = globalThis.document;
  globalThis.document = { createElement: name => { assert.equal(name, 'canvas'); return canvas; } };
  let scanner;
  try { scanner = WGCamera.createScanner({ decode }); }
  finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
  return { scanner, canvas };
}

function scene({ matrix = qr, width = 1600, height = 900, scale = 4, left = 560, top = 220, inverted = false, blank = false } = {}) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const paperSide = (matrix.size + 8) * scale;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 216;
      if (!blank && x >= left && x < left + paperSide && y >= top && y < top + paperSide) {
        const qx = Math.floor((x - left) / scale) - 4;
        const qy = Math.floor((y - top) / scale) - 4;
        const dark = qx >= 0 && qy >= 0 && qx < matrix.size && qy < matrix.size && matrix.data[qy * matrix.size + qx];
        value = (inverted ? !dark : dark) ? 0 : 255;
      }
      const offset = (y * width + x) * 4;
      rgba[offset] = rgba[offset + 1] = rgba[offset + 2] = value;
      rgba[offset + 3] = 255;
    }
  }
  return { videoWidth: width, videoHeight: height, rgba };
}

function assertResult(result, expected = frame) {
  assert.ok(result, 'A readable QR must be decoded.');
  assert.deepEqual(Buffer.from(result.bytes), Buffer.from(expected));
}

function acquire(scanner, video, attempts = 4) {
  for (let index = 0; index < attempts; index++) {
    const output = scanner.scan(video);
    if (output.result) return output;
  }
  assert.fail('The periodic detail search must acquire this readable QR.');
}

test('camera tracks byte-exact QR results, maps locations to video coordinates, and reuses stable canvas dimensions', () => {
  const { scanner, canvas } = scannerWithCanvas();
  const video = scene();
  const initial = scanner.scan(video);
  assert.equal(initial.region, 'search');
  assert.equal(initial.pixels.width, 960);
  const first = initial.result ? initial : acquire(scanner, video, 3);
  assertResult(first.result);
  assert.ok(Math.abs(first.result.location.topLeftCorner.x - (560 + 16)) < 8);
  assert.ok(Math.abs(first.result.location.topLeftCorner.y - (220 + 16)) < 8);
  for (let index = 0; index < 3; index++) {
    const tracked = scanner.scan(video);
    assert.equal(tracked.region, 'tracked');
    assertResult(tracked.result);
    assert.ok(tracked.pixels.width < 800);
    assert.ok(Number.isFinite(tracked.decodeMs) && tracked.decodeMs >= 0);
  }
  const resizes = canvas.resizes;
  const stable = scanner.scan(video);
  assertResult(stable.result);
  assert.equal(canvas.resizes, resizes, 'Unchanged ROI dimensions must not reset the canvas.');
  const moved = scanner.scan(scene({ left: 595, top: 245 }));
  assert.equal(moved.region, 'tracked');
  assertResult(moved.result);
  assert.ok(Math.abs(moved.result.location.topLeftCorner.x - (595 + 16)) < 8);
  assert.ok(Math.abs(moved.result.location.topLeftCorner.y - (245 + 16)) < 8);
  scanner.dispose();
});

test('a QR moving out of its tracked region triggers a full detail search and reacquires the same bytes', () => {
  const { scanner } = scannerWithCanvas();
  assertResult(acquire(scanner, scene({ left: 80 })).result);
  const distant = scene({ left: 1100, top: 340 });
  const firstMiss = scanner.scan(distant);
  assert.equal(firstMiss.region, 'tracked');
  assert.equal(firstMiss.result, null);
  const secondMiss = scanner.scan(distant);
  assert.equal(secondMiss.region, 'tracked');
  assert.equal(secondMiss.result, null);
  const recovered = scanner.scan(distant);
  assert.equal(recovered.region, 'search');
  assert.equal(recovered.pixels.width, 1600);
  assertResult(recovered.result);
  assert.ok(recovered.result.location.topLeftCorner.x > 1100);
  assertResult(scanner.scan(distant).result);
  scanner.dispose();
});

test('blank frames clear a lost ROI, and reacquisition also survives source dimensions changing', () => {
  const { scanner } = scannerWithCanvas();
  assertResult(acquire(scanner, scene()).result);
  const blank = scene({ blank: true });
  assert.equal(scanner.scan(blank).result, null);
  assert.equal(scanner.scan(blank).result, null);
  const search = scanner.scan(blank);
  assert.equal(search.region, 'search');
  assert.equal(search.result, null);
  assertResult(acquire(scanner, scene({ left: 80, top: 80 })).result);
  const resized = acquire(scanner, scene({ width: 1920, height: 1080, left: 800, top: 300 }));
  assert.equal(resized.region, 'search');
  assertResult(resized.result);
  scanner.dispose();
});

test('periodic 1600-pixel search preserves readability of a dense QR missed at 960 pixels', () => {
  const bytes = Uint8Array.from({ length: 2953 }, (_, index) => (index * 53 + Math.floor(index / 256)) % 256);
  const matrix = WGQR.encodeBytes(bytes);
  assert.equal(matrix.version, 40);
  const video = scene({ matrix, scale: 2, left: 610, top: 250 });
  assertResult(WGQR.decodePixels(video.rgba, video.videoWidth, video.videoHeight), bytes);
  const { scanner } = scannerWithCanvas();
  for (let attempt = 0; attempt < 3; attempt++) {
    const low = scanner.scan(video);
    assert.equal(low.pixels.width, 960);
    assert.equal(low.result, null);
  }
  const high = scanner.scan(video);
  assert.equal(high.pixels.width, 1600);
  assert.equal(high.region, 'search');
  assertResult(high.result, bytes);
  assertResult(scanner.scan(video).result, bytes);
  scanner.dispose();
});

test('normal polarity is the camera fast path and inverted codes receive a recovery attempt', () => {
  const modes = [];
  const { scanner } = scannerWithCanvas((pixels, width, height, options) => {
    modes.push(options.inversionAttempts);
    return WGQR.decodePixels(pixels, width, height, options);
  });
  const video = scene({ inverted: true });
  assert.equal(scanner.scan(video).result, null);
  assert.equal(scanner.scan(video).result, null);
  const firstFallback = scanner.scan(video);
  const fallback = firstFallback.result ? firstFallback : scanner.scan(video);
  assertResult(fallback.result);
  assert.deepEqual(modes.slice(0, 3), ['dontInvert', 'dontInvert', 'attemptBoth']);
  assert.equal(modes.at(-1), 'attemptBoth');
  const tracked = scanner.scan(video);
  assert.equal(tracked.region, 'tracked');
  assertResult(tracked.result);
  scanner.dispose();
});

test('QR decode options keep the default inverted-image support and byte preservation', () => {
  const normal = scene();
  const inverted = scene({ inverted: true });
  assertResult(WGQR.decodePixels(normal.rgba, 1600, 900, { inversionAttempts: 'dontInvert' }));
  assert.equal(WGQR.decodePixels(inverted.rgba, 1600, 900, { inversionAttempts: 'dontInvert' }), null);
  assertResult(WGQR.decodePixels(inverted.rgba, 1600, 900));
  assert.throws(() => WGQR.decodePixels(normal.rgba, 1600, 900, { inversionAttempts: 'unknown' }), { code: 'INVALID_OPTIONS' });
});

test('reset and dispose discard tracked frames, and unavailable video does not invoke decoding', () => {
  let calls = 0;
  const { scanner, canvas } = scannerWithCanvas((...args) => { calls++; return WGQR.decodePixels(...args); });
  assert.equal(scanner.scan({ videoWidth: 0, videoHeight: 0 }).result, null);
  assert.equal(calls, 0);
  assertResult(acquire(scanner, scene({ left: 0, top: 0 })).result);
  assertResult(scanner.scan(scene({ left: 0, top: 0 })).result);
  scanner.reset();
  assert.ok(canvas.clears > 0);
  assert.equal(scanner.scan(scene()).region, 'search');
  scanner.dispose();
  const callsAtDisposal = calls;
  const resizesAtDisposal = canvas.resizes;
  assert.equal(canvas.width, 1);
  assert.equal(canvas.height, 1);
  assert.equal(scanner.scan(scene()).result, null);
  scanner.dispose();
  scanner.reset();
  assert.equal(canvas.resizes, resizesAtDisposal);
  assert.equal(calls, callsAtDisposal);
});

test('one representative tracked crop reduces decoder work while preserving the unchanged framed QR', context => {
  let captured;
  const { scanner } = scannerWithCanvas((pixels, width, height, options) => {
    captured = { pixels: new Uint8ClampedArray(pixels), width, height };
    return WGQR.decodePixels(pixels, width, height, options);
  });
  const video = scene();
  assertResult(acquire(scanner, video).result);
  for (let index = 0; index < 3; index++) assertResult(scanner.scan(video).result);
  const crop = captured;
  assert.ok(crop.width * crop.height < video.videoWidth * video.videoHeight);
  const fullTimes = [];
  const cropTimes = [];
  for (let index = -2; index < 5; index++) {
    for (const [pixels, width, height, samples] of [
      [video.rgba, video.videoWidth, video.videoHeight, fullTimes],
      [crop.pixels, crop.width, crop.height, cropTimes]
    ]) {
      const start = performance.now();
      const result = WGQR.decodePixels(pixels, width, height, { inversionAttempts: 'dontInvert' });
      const elapsed = performance.now() - start;
      assertResult(result);
      if (index >= 0) samples.push(elapsed);
    }
  }
  const median = samples => [...samples].sort((a, b) => a - b)[2];
  context.diagnostic(`Synthetic Node runner, not phone performance: QRv${qr.version}, ${frame.length} framed bytes; full ${video.videoWidth}x${video.videoHeight} median ${median(fullTimes).toFixed(1)}ms, tracked crop ${crop.width}x${crop.height} median ${median(cropTimes).toFixed(1)}ms, ratio ${(median(fullTimes) / median(cropTimes)).toFixed(2)}x. Same normal polarity; two warmups and five verified decodes per image.`);
  scanner.dispose();
});
