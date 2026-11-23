import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInThisContext } from 'node:vm';
import { Worker as NodeWorker } from 'node:worker_threads';

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
    this.readbacks = 0;
    this.readbackBytes = 0;
    this.rgba = new Uint8ClampedArray(this.width * this.height * 4);
    this.context = {
      drawImage: (...args) => this.draw(...args),
      getImageData: (x, y, width, height) => {
        assert.equal(x, 0);
        assert.equal(y, 0);
        assert.equal(width, this.width);
        assert.equal(height, this.height);
        this.readbacks++;
        this.readbackBytes += width * height * 4;
        return { data: new Uint8ClampedArray(this.rgba), width, height };
      },
      clearRect: () => { this.clears++; this.rgba.fill(0); }
    };
  }
  get width() { return this.pixelWidth; }
  set width(value) { this.pixelWidth = value; this.resizes++; this.rgba = new Uint8ClampedArray(this.width * this.height * 4); }
  get height() { return this.pixelHeight; }
  get videoWidth() { return this.width; }
  get videoHeight() { return this.height; }
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
    this.draws.push({ sx, sy, sw, sh, dw, dh, source: video });
    for (let y = 0; y < dh; y++) {
      const sourceY = Math.min(video.videoHeight - 1, Math.floor(sy + (y + 0.5) * sh / dh));
      for (let x = 0; x < dw; x++) {
        const sourceX = Math.min(video.videoWidth - 1, Math.floor(sx + (x + 0.5) * sw / dw));
        const source = (sourceY * video.videoWidth + sourceX) * 4;
        const target = (y * this.width + x) * 4;
        this.rgba[target] = video.rgba[source];
        this.rgba[target + 1] = video.rgba[source + 1];
        this.rgba[target + 2] = video.rgba[source + 2];
        this.rgba[target + 3] = video.rgba[source + 3];
      }
    }
  }
}

function scannerWithCanvas(decode = WGQR.decodePixels, options = {}) {
  const canvases = [];
  const previous = globalThis.document;
  globalThis.document = { createElement: name => {
    assert.equal(name, 'canvas');
    const canvas = new PixelCanvas();
    canvases.push(canvas);
    return canvas;
  } };
  let scanner;
  try { scanner = WGCamera.createScanner({ ...options, decode }); }
  finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
  return { scanner, canvas: canvases[0], canvases };
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

const secondTransfer = await WGTransfer.createTransfer(original.map(value => value ^ 0xa5), 'kamera-druga.bin');
const secondFrame = secondTransfer.frames[0];
const secondQR = WGQR.encodeBytes(secondFrame);

function twoSymbols({ vertical = false, swapped = false, identical = false, only = null, shift = 0,
  width = 1600, height = 1000 } = {}) {
  const size = { width, height };
  const positions = vertical ? [{ left: 580, top: 20 }, { left: 580, top: 545 }]
    : [{ left: 100 + shift, top: 280 }, { left: width - 560 - shift, top: 280 }];
  const matrices = identical ? [qr, qr] : swapped ? [secondQR, qr] : [qr, secondQR];
  const output = scene({ ...size, blank: true });
  for (let index = 0; index < 2; index++) {
    if (only !== null && only !== index) continue;
    const layer = scene({ ...size, ...positions[index], matrix: matrices[index] });
    for (let offset = 0; offset < layer.rgba.length; offset += 4) {
      if (layer.rgba[offset] === 216) continue;
      output.rgba.set(layer.rgba.subarray(offset, offset + 4), offset);
    }
  }
  return output;
}

function assertBoth(sample) {
  assert.equal(sample.results.length, 2);
  assert.ok(sample.results.some(result => Buffer.from(result.bytes).equals(Buffer.from(frame))));
  assert.ok(sample.results.some(result => Buffer.from(result.bytes).equals(Buffer.from(secondFrame))));
}

function gridSymbols({ columns, rows, width = 1920, height = 1080, packetBytes = 640 } = {}) {
  const video = scene({ width, height, blank: true });
  const payloads = [], centers = [];
  for (let index = 0; index < columns * rows; index++) {
    const payload = Uint8Array.from({ length: packetBytes }, (_, offset) =>
      (index * 37 + offset * 73 + Math.floor(offset / 256)) % 256);
    payload[0] = index;
    const matrix = WGQR.encodeBytes(payload, { errorCorrectionLevel: 'M' });
    const scale = Math.min(4, Math.floor(Math.min(width / columns, height / rows) / (matrix.size + 16)));
    assert.ok(scale >= 2, 'The synthetic fixture must retain at least two pixels per QR module.');
    const side = (matrix.size + 8) * scale;
    const left = Math.round((index % columns + 0.5) * width / columns - side / 2);
    const top = Math.round((Math.floor(index / columns) + 0.5) * height / rows - side / 2);
    for (let y = 0; y < side; y++) {
      for (let x = 0; x < side; x++) {
        const qx = Math.floor(x / scale) - 4, qy = Math.floor(y / scale) - 4;
        const dark = qx >= 0 && qy >= 0 && qx < matrix.size && qy < matrix.size
          && matrix.data[qy * matrix.size + qx];
        const offset = ((top + y) * width + left + x) * 4;
        video.rgba[offset] = video.rgba[offset + 1] = video.rgba[offset + 2] = dark ? 0 : 255;
      }
    }
    payloads.push(payload); centers.push({ x: left + side / 2, y: top + side / 2 });
  }
  return { video, payloads, centers };
}

function rotateClockwise(video) {
  const width = video.videoWidth, height = video.videoHeight;
  const rgba = new Uint8ClampedArray(video.rgba.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = (y * width + x) * 4, to = (x * height + height - 1 - y) * 4;
      rgba.set(video.rgba.subarray(from, from + 4), to);
    }
  }
  return { videoWidth: height, videoHeight: width, rgba };
}

function assertGrid(sample, payloads) {
  assert.equal(sample.results.length, payloads.length, 'Every physical grid cell must be decoded once in this camera frame.');
  const read = sample.results.map(result => Buffer.from(result.bytes).toString('hex'));
  assert.equal(new Set(read).size, payloads.length, 'Overlapping searches must not count one QR twice.');
  assert.deepEqual(read.sort(), payloads.map(payload => Buffer.from(payload).toString('hex')).sort());
}

function acquireGrid(scanner, video, count, attempts = 10) {
  const reads = [];
  for (let index = 0; index < attempts; index++) {
    const sample = scanner.scan(video);
    reads.push(sample.results.length);
    if (sample.results.length === count) return sample;
  }
  assert.fail(`The synthetic grid must be acquired; per-frame reads: ${reads.join(', ')}.`);
}

test('grid arguments are bounded and reject inconsistent or partial geometry', () => {
  for (const options of [{ columns: 0, rows: 2 }, { columns: 4, rows: 2 }, { columns: 2, rows: 4 },
    { columns: 1.5, rows: 1 }, { columns: 2 }, { rows: 2 }, { columns: '2', rows: 2 },
    { columns: 3, rows: 3, lanes: 2 }, { lanes: 9 }]) {
    assert.throws(() => scannerWithCanvas(() => null, options), TypeError);
  }
  const { scanner } = scannerWithCanvas(() => null, { columns: 3, rows: 3, lanes: 9 });
  try {
    for (const [columns, rows] of [[0, 1], [3, 4], [NaN, 2], [2.5, 1], ['2', 2]]) {
      assert.throws(() => scanner.setGrid(columns, rows), TypeError);
    }
    assert.throws(() => scanner.setLanes(9), TypeError, 'Legacy lane counts must not guess an ambiguous grid shape.');
    scanner.setLanes(2); scanner.setGrid(1, 3); scanner.setGrid(3, 3);
  } finally { scanner.dispose(); }
});

test('2×2 and 3×3 grids decode distinct full-size binary packets from one frozen frame', () => {
  for (const [columns, rows, packetBytes] of [[2, 2, 424], [3, 3, 692]]) {
    const { video, payloads, centers } = gridSymbols({ columns, rows, packetBytes });
    const { scanner, canvases } = scannerWithCanvas(WGQR.decodePixels, { columns, rows });
    try {
      const first = acquireGrid(scanner, video, payloads.length);
      assertGrid(first, payloads);
      const snapshot = canvases[columns * rows];
      const captures = snapshot.draws.length;
      const clearCounts = canvases.map(canvas => canvas.clears);
      scanner.setGrid(columns, rows);
      assert.deepEqual(canvases.map(canvas => canvas.clears), clearCounts, 'Repeating the current grid must preserve tracks.');
      const tracked = scanner.scan(video);
      assertGrid(tracked, payloads);
      assert.equal(tracked.region, 'tracked');
      assert.equal(snapshot.draws.length, captures + 1, 'One frozen camera frame must feed every cell decoder.');
      for (const canvas of canvases.slice(0, columns * rows)) assert.equal(canvas.draws.at(-1).source, snapshot);
      assert.equal(snapshot.draws.at(-1).source, video);
      for (const result of tracked.results) {
        const center = centers[result.bytes[0]];
        const x = (result.location.topLeftCorner.x + result.location.bottomRightCorner.x) / 2;
        const y = (result.location.topLeftCorner.y + result.location.bottomRightCorner.y) / 2;
        assert.ok(Math.abs(x - center.x) < 8 && Math.abs(y - center.y) < 8,
          'Grid crop locations must map back to the original video coordinates.');
      }
    } finally { scanner.dispose(); }
  }
});

test('explicit 2×1 and asymmetric 3×2 grids are reacquired after the actual pixels rotate by 90 degrees', () => {
  for (const [columns, rows] of [[2, 1], [3, 2]]) {
    const { video, payloads, centers } = gridSymbols({ columns, rows });
    const { scanner } = scannerWithCanvas(WGQR.decodePixels, { columns, rows });
    try {
      assertGrid(acquireGrid(scanner, video, payloads.length), payloads);
      assertGrid(scanner.scan(video), payloads);
      const height = video.videoHeight;
      Object.assign(video, rotateClockwise(video));
      const initial = scanner.scan(video);
      assert.equal(initial.region, 'search', 'Changed source dimensions must invalidate all old tracked rectangles.');
      const rotated = initial.results.length === payloads.length ? initial : acquireGrid(scanner, video, payloads.length);
      assertGrid(rotated, payloads);
      for (const result of rotated.results) {
        const center = centers[result.bytes[0]];
        const points = ['topLeftCorner', 'topRightCorner', 'bottomRightCorner', 'bottomLeftCorner'].map(name => result.location[name]);
        assert.ok(points.every(point => point.x >= 0 && point.x <= video.videoWidth && point.y >= 0 && point.y <= video.videoHeight));
        const x = points.reduce((sum, point) => sum + point.x, 0) / 4;
        const y = points.reduce((sum, point) => sum + point.y, 0) / 4;
        assert.ok(Math.abs(x - (height - center.y)) < 8 && Math.abs(y - center.x) < 8,
          'Transpose search must recover the actual rotated symbols, not just relabel width and height.');
      }
      assertGrid(scanner.scan(video), payloads);
    } finally { scanner.dispose(); }
  }
});

test('dual scanner freezes one image, reads both independent payloads, and follows swapped/moved symbols', () => {
  const { scanner, canvases } = scannerWithCanvas(WGQR.decodePixels, { lanes: 2 });
  const video = twoSymbols();
  const first = scanner.scan(video);
  assertBoth(first);
  assert.equal(first.attempts, 2);
  assert.equal(canvases[2].draws.length, 1, 'One snapshot must feed both ROI decoders.');
  assert.equal(canvases[2].draws[0].source, video);
  assert.equal(canvases[0].draws[0].source, canvases[2]);
  assert.equal(canvases[1].draws[0].source, canvases[2]);
  assertBoth(scanner.scan(twoSymbols({ swapped: true, shift: 45 })));
  assertBoth(scanner.scan(twoSymbols({ shift: 80 })));
  scanner.dispose();
});

test('dual reception accepts one readable symbol without requiring its partner', () => {
  const { scanner } = scannerWithCanvas(WGQR.decodePixels, { lanes: 2 });
  const first = scanner.scan(twoSymbols({ only: 0 }));
  assert.equal(first.results.length, 1);
  assertResult(first.result, frame);
  let acquired;
  for (let attempt = 0; attempt < 7; attempt++) {
    const sample = scanner.scan(twoSymbols({ only: 1 }));
    if (sample.results.some(result => Buffer.from(result.bytes).equals(Buffer.from(secondFrame)))) { acquired = sample; break; }
  }
  assert.ok(acquired, 'The other symbol must remain independently receivable after movement/loss.');
  scanner.dispose();
});

test('two physical copies remain two optical reads; protocol packet deduplication belongs to the receiver', () => {
  const { scanner } = scannerWithCanvas(WGQR.decodePixels, { lanes: 2 });
  const sample = scanner.scan(twoSymbols({ identical: true }));
  assert.equal(sample.results.length, 2);
  for (const result of sample.results) assertResult(result, frame);
  assert.ok(Math.abs(sample.results[0].location.topLeftCorner.x - sample.results[1].location.topLeftCorner.x) > 500);
  scanner.dispose();
});

test('dual scanner discovers vertically arranged codes in a landscape camera frame', () => {
  const { scanner, canvases } = scannerWithCanvas(WGQR.decodePixels, { lanes: 2 });
  let found;
  const trace = [];
  for (let attempt = 0; attempt < 10; attempt++) {
    const sample = scanner.scan(twoSymbols({ vertical: true }));
    trace.push({ attempt, reads: sample.results.length, regions: canvases.slice(0, 2).map(canvas => {
      const { sx, sy, sw, sh, dw, dh } = canvas.draws.at(-1); return { sx, sy, sw, sh, dw, dh };
    }) });
    if (sample.results.length === 2) { found = sample; break; }
  }
  assert.ok(found, `Orientation search must find both vertically arranged symbols: ${JSON.stringify(trace)}`);
  assertBoth(found);
  scanner.dispose();
});

test('dual scanner reacquires both byte-exact symbols after a 1920x1080 frame rotates to 1080x1920', () => {
  const { scanner } = scannerWithCanvas(WGQR.decodePixels, { lanes: 2 });
  const video = twoSymbols({ width: 1920, height: 1080 });
  const width = video.videoWidth;
  const height = video.videoHeight;
  const rotated = new Uint8ClampedArray(video.rgba.length);
  // Rotate the captured pixels, including both QR matrices and their quiet zones.
  // Changing only the metadata or the symbols' positions would miss this case.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = (y * width + x) * 4;
      const to = (x * height + height - 1 - y) * 4;
      rotated[to] = video.rgba[from];
      rotated[to + 1] = video.rgba[from + 1];
      rotated[to + 2] = video.rgba[from + 2];
      rotated[to + 3] = video.rgba[from + 3];
    }
  }
  const assertInFrame = sample => {
    assertBoth(sample);
    for (const result of sample.results) {
      for (const name of ['topLeftCorner', 'topRightCorner', 'bottomRightCorner', 'bottomLeftCorner']) {
        const point = result.location[name];
        assert.ok(Number.isFinite(point.x) && point.x >= 0 && point.x <= video.videoWidth,
          `${name}.x must use the current source width.`);
        assert.ok(Number.isFinite(point.y) && point.y >= 0 && point.y <= video.videoHeight,
          `${name}.y must use the current source height.`);
      }
    }
  };
  try {
    assertInFrame(scanner.scan(video));
    const landscapeTracked = scanner.scan(video);
    assert.equal(landscapeTracked.region, 'tracked');
    assertInFrame(landscapeTracked);

    // Keep the same video object and scanner, as happens when a camera rotates.
    Object.assign(video, { videoWidth: height, videoHeight: width, rgba: rotated });
    const portraitSearch = scanner.scan(video);
    assert.equal(portraitSearch.region, 'search', 'Dimension changes must discard both old tracked ROIs.');
    assertInFrame(portraitSearch);
    const centers = portraitSearch.results.map(result =>
      (result.location.topLeftCorner.y + result.location.bottomRightCorner.y) / 2);
    assert.ok(Math.abs(centers[0] - centers[1]) > 1000,
      'The two rotated payloads must be located above/below one another.');

    const portraitTracked = scanner.scan(video);
    assert.equal(portraitTracked.region, 'tracked');
    assertInFrame(portraitTracked);
  } finally { scanner.dispose(); }
});

test('dual search can reacquire a centered single dense QR that crosses both half-frame seams', () => {
  const bytes = Uint8Array.from({ length: 2953 }, (_, index) => (index * 53 + Math.floor(index / 256)) % 256);
  const matrix = WGQR.encodeBytes(bytes);
  const video = scene({ matrix, width: 1600, height: 1000, scale: 4, left: 430, top: 130 });
  let decodes = 0;
  const { scanner } = scannerWithCanvas((...args) => { decodes++; return WGQR.decodePixels(...args); }, { lanes: 2 });
  let found;
  let foundDecodes = 0;
  for (let attempt = 0; attempt < 8; attempt++) {
    const before = decodes;
    const sample = scanner.scan(video);
    if (sample.result) { found = sample; foundDecodes = decodes - before; break; }
  }
  assert.ok(found, 'A full-frame detail pass must preserve single-symbol compatibility.');
  assert.equal(found.results.length, 1, 'Overlapping ROI results must be deduplicated.');
  assert.equal(found.attempts, 1, 'Identical full-frame searches represent one actual decoder invocation.');
  assert.equal(foundDecodes, 1, 'The shared pixels must actually be decoded just once.');
  assertResult(found.result, bytes);
  scanner.dispose();
});

test('stable dual tracks freeze only their union without moving decoded coordinates or extra readbacks', context => {
  const { scanner, canvases } = scannerWithCanvas(WGQR.decodePixels, { lanes: 2 });
  const video = twoSymbols();
  assertBoth(scanner.scan(video));
  const initialCapture = canvases[2].draws.at(-1);
  assert.equal(initialCapture.dw * initialCapture.dh, video.videoWidth * video.videoHeight);
  const beforeBytes = canvases[0].readbackBytes + canvases[1].readbackBytes;
  const tracked = scanner.scan(video);
  assertBoth(tracked);
  const capture = canvases[2].draws.at(-1);
  assert.ok(capture.sx > 0 && capture.sy > 0, 'This fixture requires a translated snapshot union.');
  const capturedPixels = capture.dw * capture.dh;
  assert.ok(capturedPixels < video.videoWidth * video.videoHeight * 0.75);
  const xs = tracked.results.map(result => result.location.topLeftCorner.x).sort((a, b) => a - b);
  assert.ok(Math.abs(xs[0] - 116) < 8);
  assert.ok(Math.abs(xs[1] - 1056) < 8);
  const readbackBytes = canvases[0].readbackBytes + canvases[1].readbackBytes - beforeBytes;
  assert.equal(readbackBytes, tracked.pixelCount * 4, 'Only unique ROI pixels should be read back once.');
  const resizes = canvases[2].resizes;
  assertBoth(scanner.scan(video));
  assert.equal(canvases[2].resizes, resizes, 'Stable union capture must reuse its backing canvas.');
  context.diagnostic(`Deterministic pixel budget, not phone timing: ${video.videoWidth}x${video.videoHeight} full snapshot ${video.videoWidth * video.videoHeight * 4} bytes -> union ${capture.dw}x${capture.dh} ${capturedPixels * 4} bytes; ${readbackBytes} ROI bytes per scan are transferred instead of cloned by the worker path.`);
  scanner.dispose();
});

test('stable large QR crops adapt their pixel budget without changing decoded bytes', () => {
  const { scanner } = scannerWithCanvas();
  const video = scene({ width: 1600, height: 1200, scale: 8, left: 300, top: 130 });
  assertResult(acquire(scanner, video).result);
  const initial = scanner.scan(video);
  assertResult(initial.result);
  const adapted = scanner.scan(video);
  assertResult(adapted.result);
  assert.ok(adapted.pixelCount < initial.pixelCount * 0.75, 'A well-sampled stable QR needs fewer pixels than its original large ROI.');
  scanner.setLanes(2);
  assertBoth(scanner.scan(twoSymbols()));
  scanner.setLanes(1);
  assertResult(acquire(scanner, video).result);
  scanner.dispose();
});

// Run the actual browser worker in an isolated Node thread. Only its host bridge
// is adapted; importScripts, raw pixel decoding and byte transfer are exercised.
class LocalDecoderWorker {
  constructor(url) {
    assert.equal(url, './assets/qr-decoder-worker.js');
    const script = new URL('../../assets/qr-decoder-worker.js', import.meta.url).href;
    this.thread = new NodeWorker(`
      const { parentPort } = require('node:worker_threads');
      const { readFileSync } = require('node:fs');
      const { runInThisContext } = require('node:vm');
      const script = ${JSON.stringify(script)};
      globalThis.self = globalThis;
      globalThis.importScripts = name => {
        if (name !== 'qr-core.js?v=3') throw new Error('Unexpected dependency');
        runInThisContext(readFileSync(new URL(name, script), 'utf8'));
      };
      globalThis.postMessage = (message, transfer) => parentPort.postMessage(message, transfer);
      runInThisContext(readFileSync(new URL(script), 'utf8'));
      parentPort.on('message', data => globalThis.onmessage({ data }));
    `, { eval: true });
    this.thread.on('message', data => this.onmessage?.({ data }));
    this.thread.on('error', error => this.onerror?.({ error, preventDefault() {} }));
  }
  postMessage(message, transfer) {
    assert.ok(Array.isArray(transfer) && transfer.length >= 1 && transfer.length <= 9);
    const expected = [...new Set(message.frames.map(frame => frame.data.buffer))];
    assert.deepEqual(transfer, expected, 'Every unique RGBA buffer must be transferred, not cloned.');
    this.thread.postMessage(message, transfer);
    for (const buffer of transfer) assert.equal(buffer.byteLength, 0, 'Ownership must leave the caller immediately.');
  }
  terminate() { void this.thread.terminate(); }
}

test('local worker decodes both real QR images and returns byte-exact binary payloads', async () => {
  const previous = globalThis.Worker;
  globalThis.Worker = LocalDecoderWorker;
  let fallbackCalls = 0;
  const { scanner, canvases } = scannerWithCanvas((...args) => { fallbackCalls++; return WGQR.decodePixels(...args); },
    { lanes: 2, workerUrl: './assets/qr-decoder-worker.js' });
  try {
    const sample = await scanner.scanAsync(twoSymbols());
    assertBoth(sample);
    assert.equal(sample.decoder, 'worker');
    assert.equal(fallbackCalls, 0);
    assert.equal(canvases[0].readbacks + canvases[1].readbacks, 2, 'Successful worker transfer must not re-read detached pixels.');
    assertBoth(await scanner.scanAsync(twoSymbols({ swapped: true })));
  } finally { scanner.dispose(); globalThis.Worker = previous; }
});

test('one bounded local-worker batch decodes nine real grid payloads without main-thread fallback', async () => {
  const previous = globalThis.Worker;
  const batches = [];
  globalThis.Worker = class extends LocalDecoderWorker {
    postMessage(message, transfer) { batches.push(message.frames.length); super.postMessage(message, transfer); }
  };
  const { video, payloads } = gridSymbols({ columns: 3, rows: 3, packetBytes: 692 });
  let fallbackCalls = 0;
  const { scanner, canvases } = scannerWithCanvas((...args) => { fallbackCalls++; return WGQR.decodePixels(...args); },
    { columns: 3, rows: 3, workerUrl: './assets/qr-decoder-worker.js' });
  try {
    let complete;
    for (let attempt = 0; attempt < 4; attempt++) {
      const sample = await scanner.scanAsync(video);
      assert.equal(sample.decoder, 'worker');
      if (sample.results.length === 9) { complete = sample; break; }
    }
    assert.ok(complete, 'The real worker must be able to decode the complete synthetic nine-cell scene.');
    assertGrid(complete, payloads);
    assert.equal(fallbackCalls, 0);
    assert.ok(batches.every(count => count === 9));
    assert.equal(canvases[9].draws.length, batches.length, 'Each batch must freeze exactly one camera frame.');
    assert.equal(canvases.slice(0, 9).reduce((sum, canvas) => sum + canvas.readbacks, 0), batches.length * 9,
      'Successful transfer must neither clone nor re-read the nine detached RGBA buffers.');
  } finally { scanner.dispose(); globalThis.Worker = previous; }
});

test('local worker reuses a shared reacquisition crop and transfers its decoded bytes only once', async () => {
  const worker = new LocalDecoderWorker('./assets/qr-decoder-worker.js');
  const video = scene({ width: 640, height: 640, left: 100, top: 100 });
  const crop = { data: video.rgba, width: 640, height: 640, inversionAttempts: 'dontInvert' };
  try {
    const reply = new Promise((resolve, reject) => {
      worker.onmessage = event => resolve(event.data);
      worker.onerror = event => reject(event.error);
      worker.postMessage({ id: 42, frames: [{ ...crop }, { ...crop }] }, [crop.data.buffer]);
    });
    const message = await reply;
    assert.equal(message.id, 42);
    assert.equal(message.answers.length, 2);
    assertResult(message.answers[0].decoded);
    assert.equal(message.answers[0], message.answers[1], 'The worker must share one decode answer for the identical pixels.');
  } finally { worker.terminate(); }
});

test('worker startup/error restores detached pixels from frozen crops even after the live image changes', async () => {
  const previous = globalThis.Worker;
  for (const failure of ['constructor', 'decode']) {
    const video = twoSymbols();
    globalThis.Worker = class {
      constructor() { if (failure === 'constructor') throw new Error('Worker unavailable'); }
      postMessage(message, transfer) {
        structuredClone(message, { transfer });
        for (const buffer of transfer) assert.equal(buffer.byteLength, 0);
        video.rgba.fill(216); // The live camera now shows something else.
        queueMicrotask(() => this.onerror?.({ preventDefault() {} }));
      }
      terminate() {}
    };
    const { scanner, canvases } = scannerWithCanvas(WGQR.decodePixels, { lanes: 2, workerUrl: './assets/qr-decoder-worker.js' });
    try {
      const sample = await scanner.scanAsync(video);
      assertBoth(sample);
      assert.equal(sample.decoder, 'main');
      assert.equal(canvases[2].draws.length, 1, 'Fallback must not recapture the changed live video.');
      assert.equal(canvases[0].readbacks + canvases[1].readbacks, failure === 'decode' ? 4 : 2);
    } finally { scanner.dispose(); }
  }
  globalThis.Worker = previous;
});

test('worker scans are bounded; reset/dispose cancel pending replies without decoding stale pixels', async () => {
  const previous = globalThis.Worker;
  const workers = [];
  globalThis.Worker = class {
    constructor() { this.messages = []; workers.push(this); }
    postMessage(message, transfer) { this.messages.push(structuredClone(message, { transfer })); }
    terminate() { this.terminated = true; }
  };
  let decodes = 0;
  const { scanner } = scannerWithCanvas((...args) => { decodes++; return WGQR.decodePixels(...args); },
    { workerUrl: './assets/qr-decoder-worker.js' });
  try {
    const pending = scanner.scanAsync(scene());
    assert.equal((await scanner.scanAsync(scene())).busy, true);
    assert.equal(workers[0].messages.length, 1);
    scanner.reset();
    assert.equal((await pending).results.length, 0);
    assert.equal(workers[0].terminated, true);
    const next = scanner.scanAsync(scene());
    workers[0].onerror({ preventDefault() {} });
    assert.equal(workers[1].terminated, undefined, 'A stale worker error must not kill the replacement.');
    scanner.dispose();
    assert.equal((await next).results.length, 0);
    assert.equal(workers[1].terminated, true);
    assert.equal(decodes, 0);
    assert.equal((await scanner.scanAsync(scene())).attempts, 0);
  } finally { scanner.dispose(); globalThis.Worker = previous; }
});

test('grid changes cancel old batches, preserve identical-grid work, and ignore stale nine-lane replies', async () => {
  const previous = globalThis.Worker;
  const workers = [];
  globalThis.Worker = class {
    constructor() { this.messages = []; workers.push(this); }
    postMessage(message, transfer) { this.messages.push(structuredClone(message, { transfer })); }
    terminate() { this.terminated = true; }
  };
  let fallbackCalls = 0;
  const { scanner, canvases } = scannerWithCanvas(() => { fallbackCalls++; return null; },
    { columns: 3, rows: 3, workerUrl: './assets/qr-decoder-worker.js' });
  const video = scene({ width: 960, height: 960, blank: true });
  try {
    const old = scanner.scanAsync(video);
    assert.equal(workers[0].messages[0].frames.length, 9);
    assert.equal(canvases[9].draws.length, 1);
    scanner.setGrid(3, 3);
    assert.equal(workers[0].terminated, undefined, 'An unchanged grid must not discard a useful pending batch.');
    assert.equal((await scanner.scanAsync(video)).busy, true);
    scanner.setGrid(2, 3);
    assert.equal((await old).results.length, 0);
    assert.equal(workers[0].terminated, true);
    const next = scanner.scanAsync(video);
    assert.equal(workers[1].messages[0].frames.length, 6);
    workers[0].onmessage({ data: { id: workers[0].messages[0].id,
      answers: Array.from({ length: 9 }, () => ({ decoded: { bytes: frame } })) } });
    workers[0].onerror({ preventDefault() {} });
    assert.equal(workers[1].terminated, undefined, 'A stale error must not terminate the replacement grid decoder.');
    assert.equal((await scanner.scanAsync(video)).busy, true);
    scanner.setGrid(1, 1);
    assert.equal((await next).results.length, 0);
    assert.equal(workers[1].terminated, true);
    assert.equal(fallbackCalls, 0, 'Cancelled buffers must never be decoded on the main thread.');
    scanner.dispose();
    assert.ok(canvases.every(canvas => canvas.width === 1 && canvas.height === 1));
  } finally { scanner.dispose(); globalThis.Worker = previous; }
});

test('a silent worker timeout terminates the worker and retries the captured pixels locally', async () => {
  const previousWorker = globalThis.Worker;
  const previousTimeout = globalThis.setTimeout;
  let terminated = 0;
  let created = 0;
  globalThis.Worker = class {
    constructor() { created++; }
    postMessage(message, transfer) {
      structuredClone(message, { transfer });
      video.rgba.fill(216);
    }
    terminate() { terminated++; }
  };
  globalThis.setTimeout = (callback, delay, ...args) => previousTimeout(callback, delay === 3000 ? 5 : delay, ...args);
  const { scanner } = scannerWithCanvas(WGQR.decodePixels, { workerUrl: './assets/qr-decoder-worker.js' });
  const video = scene({ width: 960, height: 900, left: 200, top: 220 });
  try {
    const sample = await scanner.scanAsync(video);
    assertResult(sample.result);
    assert.equal(sample.decoder, 'main');
    assert.equal(terminated, 1);
    assertResult((await scanner.scanAsync(scene({ width: 960, height: 900, left: 200, top: 220 }))).result);
    assert.equal(created, 1, 'A known unavailable worker must not repeatedly stall scanning.');
  } finally {
    scanner.dispose();
    globalThis.Worker = previousWorker;
    globalThis.setTimeout = previousTimeout;
  }
});
