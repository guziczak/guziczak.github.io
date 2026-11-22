import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const independentRenderer = require('qrcode');
const bundle = await readFile(new URL('../../assets/qr-core.js', import.meta.url), 'utf8');

// Test the shipped browser IIFE without DOM, Node APIs, network globals, or eval.
const browser = createContext({ TextEncoder }, {
  codeGeneration: { strings: false, wasm: false }
});
runInContext(bundle, browser, { timeout: 3000 });
const { encodeBytes, decodePixels } = browser.WGQR;
const utf8 = value => new TextEncoder().encode(value);

const example = [
  '[Interface]',
  'PrivateKey = AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  'Address = 10.8.0.2/32',
  'DNS = 1.1.1.1',
  '',
  '[Peer]',
  'PublicKey = AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
  'Endpoint = 198.51.100.20:51820',
  'AllowedIPs = 0.0.0.0/0, ::/0',
  'PersistentKeepalive = 25'
].join('\n');

function renderPng(qr, { inverted = false, scale = 4 } = {}) {
  const margin = 4;
  const side = (qr.size + margin * 2) * scale;
  const png = new PNG({ width: side, height: side });
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const moduleX = Math.floor(x / scale) - margin;
      const moduleY = Math.floor(y / scale) - margin;
      const dark = moduleX >= 0 && moduleY >= 0
        && moduleX < qr.size && moduleY < qr.size
        && Boolean(qr.data[moduleY * qr.size + moduleX]);
      const value = (inverted ? !dark : dark) ? 0 : 255;
      const position = (y * side + x) * 4;
      png.data[position] = value;
      png.data[position + 1] = value;
      png.data[position + 2] = value;
      png.data[position + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

function decodePng(pngBytes) {
  const png = PNG.sync.read(pngBytes);
  return decodePixels(new Uint8ClampedArray(png.data), png.width, png.height);
}

function roundTrip(bytes, options) {
  const qr = encodeBytes(bytes);
  assert.equal(qr.data.length, qr.size * qr.size);
  assert.equal(qr.size, 17 + 4 * qr.version);
  assert.ok(qr.version >= 1 && qr.version <= 40);
  const pngBytes = renderPng(qr, options);
  assert.deepEqual([...pngBytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const decoded = decodePng(pngBytes);
  assert.ok(decoded, 'The generated PNG must decode.');
  assert.deepEqual(Buffer.from(decoded.bytes), Buffer.from(bytes), 'Every recovered byte must match.');
  assert.equal(decoded.version, qr.version);
  assert.equal(typeof decoded.location.topLeftCorner.x, 'number');
  return qr;
}

test('the published browser API is synchronous and self-contained', () => {
  assert.deepEqual(Object.keys(browser.WGQR).sort(), ['decodePixels', 'encodeBytes']);
  assert.equal(typeof encodeBytes, 'function');
  assert.equal(typeof decodePixels, 'function');
  assert.equal(typeof browser.fetch, 'undefined');
  assert.equal(typeof browser.require, 'undefined');
  assert.equal(encodeBytes(utf8(example)).then, undefined);
});

const fixtures = [
  ['ASCII with LF', utf8(example + '\n')],
  ['CRLF without rewriting line endings', utf8(example.replaceAll('\n', '\r\n') + '\r\n')],
  ['UTF-8 BOM with CRLF', Uint8Array.from([0xef, 0xbb, 0xbf, ...utf8(example.replaceAll('\n', '\r\n'))])],
  ['UTF-8 Polish and emoji comments', utf8('# Zażółć gęślą jaźń — dom 🔑🏠\n' + example + '\n')],
  ['trailing spaces, blank lines, and no final newline', utf8(example.replaceAll('\n', '  \n') + '  \n\n   ')],
  ['no final newline', utf8(example)],
  ['multiple peers', utf8(example + '\n\n[Peer]\nPublicKey = AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=\nAllowedIPs = 10.9.0.0/16\n')],
  ['arbitrary binary including invalid UTF-8 and NUL', Uint8Array.from({ length: 256 }, (_, index) => index)]
];

for (const [name, bytes] of fixtures) {
  test(`PNG round-trip preserves ${name}`, () => roundTrip(bytes));
}

for (const [length, level] of [[2331, 'M'], [2332, 'L'], [2953, 'L']]) {
  test(`capacity boundary ${length} bytes round-trips at ${level}`, () => {
    const bytes = Uint8Array.from({ length }, (_, index) => (index * 73 + Math.floor(index / 256)) % 256);
    const qr = roundTrip(bytes);
    assert.equal(qr.level, level);
    if (length === 2331 || length === 2953) assert.equal(qr.version, 40);
  });
}

test('2954-byte input is rejected without truncating it', () => {
  assert.throws(() => encodeBytes(new Uint8Array(2954)), { code: 'INPUT_TOO_LARGE' });
});

test('explicit L and M correction both preserve arbitrary binary bytes through actual PNG decoding', () => {
  const backing = Uint8Array.from({ length: 640 }, (_, index) => (index * 73 + Math.floor(index / 256)) % 256);
  const bytes = backing.subarray(17, 617);
  const codes = {};
  for (const level of ['L', 'M']) {
    const qr = encodeBytes(bytes, { errorCorrectionLevel: level });
    assert.equal(qr.level, level);
    const decoded = decodePng(renderPng(qr));
    assert.ok(decoded);
    assert.deepEqual(Buffer.from(decoded.bytes), Buffer.from(bytes));
    codes[level] = qr;
  }
  assert.ok(codes.L.size < codes.M.size, 'This payload should use fewer modules with correction L.');
  assert.equal(encodeBytes(bytes).level, 'M', 'Ordinary single-QR calls keep their original default.');
});

test('explicit correction settings reject unsupported levels and never silently weaken requested M', () => {
  const bytes = Uint8Array.from([0, 255, 0xc0, 0x80, 13, 10]);
  for (const options of [null, false, 'L', { errorCorrectionLevel: 'H' }, { errorCorrectionLevel: 'm' }]) {
    assert.throws(() => encodeBytes(bytes, options), { code: 'INVALID_OPTIONS' });
  }
  assert.throws(() => encodeBytes(new Uint8Array(2332), { errorCorrectionLevel: 'M' }), { code: 'INPUT_TOO_LARGE' });
  assert.equal(encodeBytes(new Uint8Array(2332), { errorCorrectionLevel: 'L' }).level, 'L');
});

test('empty input has an explicit coded error', () => {
  assert.throws(() => encodeBytes(new Uint8Array()), { code: 'EMPTY_INPUT' });
});

test('strings and clamped pixel arrays are not silently accepted as file bytes', () => {
  assert.throws(() => encodeBytes(example), { code: 'INVALID_INPUT' });
  assert.throws(() => encodeBytes(new Uint8ClampedArray([65])), { code: 'INVALID_INPUT' });
});

test('subarray byte offsets are respected without adding surrounding bytes', () => {
  const bytes = utf8('not-in-qr:' + example + ':also-not-in-qr');
  roundTrip(bytes.subarray(10, bytes.length - 15));
});

test('an inverted QR survives PNG encoding and decoding', () => {
  roundTrip(utf8(example + '\n'), { inverted: true });
});

test('an independently rendered, automatically segmented QR imports correctly', async () => {
  const content = '# Imported from another renderer\n' + example;
  const png = await independentRenderer.toBuffer(content, {
    type: 'png', margin: 4, scale: 4, errorCorrectionLevel: 'Q'
  });
  const decoded = decodePng(png);
  assert.ok(decoded);
  assert.deepEqual(Buffer.from(decoded.bytes), Buffer.from(utf8(content)));
});

test('blank white and black PNGs return null, not stale or fabricated content', () => {
  for (const value of [0, 255]) {
    const image = new PNG({ width: 128, height: 128 });
    for (let index = 0; index < image.data.length; index += 4) {
      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = value;
      image.data[index + 3] = 255;
    }
    assert.equal(decodePng(PNG.sync.write(image)), null);
  }
});

test('invalid RGBA buffers and dimensions fail with a coded error', () => {
  assert.throws(() => decodePixels(new Uint8ClampedArray(), 0, 0), { code: 'INVALID_IMAGE' });
  assert.throws(() => decodePixels(new Uint8ClampedArray(4), 2, 2), { code: 'INVALID_IMAGE' });
  assert.throws(() => decodePixels(new Uint8Array(4), 1, 1), { code: 'INVALID_IMAGE' });
  assert.throws(() => decodePixels(new Uint8ClampedArray(4), 1.5, 1), { code: 'INVALID_IMAGE' });
});
