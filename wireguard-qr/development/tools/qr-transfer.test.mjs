import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const transferSource = await readFile(new URL('../../assets/qr-transfer.js', import.meta.url), 'utf8');
const coreSource = await readFile(new URL('../../assets/qr-core.js', import.meta.url), 'utf8');
const utf8 = value => new TextEncoder().encode(value);
const pattern = length => Uint8Array.from({ length }, (_, index) => (index * 73 + Math.floor(index / 256)) % 256);
const asBuffer = bytes => Buffer.from(bytes);

function runtime(crypto = webcrypto) {
  const browser = createContext({ TextEncoder, TextDecoder, crypto }, {
    codeGeneration: { strings: false, wasm: false }
  });
  runInContext(transferSource, browser, { timeout: 3000 });
  return { browser, ...browser.WGTransfer };
}

const transfer = runtime();

// Independent, bit-at-a-time reference for constructing intentional corrupt frames.
function referenceCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function changed(frame, edit, repairCrc = true) {
  const copy = new Uint8Array(frame);
  const view = new DataView(copy.buffer);
  edit(copy, view);
  if (repairCrc) view.setUint32(copy.length - 4, referenceCrc32(copy.subarray(0, -4)));
  return copy;
}

function assertBytes(actual, expected) {
  assert.deepEqual(asBuffer(actual), asBuffer(expected));
}

async function collectAll(collector, frames) {
  let result;
  for (const frame of frames) result = await collector.accept(frame);
  return result;
}

test('transfer API has fixed limits, SHA-256, random identifiers, and valid frame CRCs', async () => {
  assert.equal(transfer.MAX_FILE_BYTES, 262144);
  assert.equal(transfer.CHUNK_BYTES, 600);
  assert.equal(typeof transfer.browser.fetch, 'undefined');
  assert.equal(typeof transfer.browser.localStorage, 'undefined');
  const bytes = pattern(3017);
  const first = await transfer.createTransfer(bytes, 'plik.conf');
  const second = await transfer.createTransfer(bytes, 'plik.conf');
  assert.equal(first.total, 6);
  assert.equal(first.size, bytes.length);
  assert.match(first.id, /^[0-9a-f]{32}$/);
  assert.notEqual(first.id, second.id);
  assert.equal(first.digest, createHash('sha256').update(bytes).digest('hex'));
  for (const frame of first.frames) {
    assert.ok(frame.length <= 796);
    assert.equal(asBuffer(frame.subarray(0, 8)).toString('ascii'), 'WGQR-XFR');
    assert.equal(new DataView(frame.buffer).getUint32(frame.length - 4), referenceCrc32(frame.subarray(0, -4)));
  }
});

test('shuffled, dropped and repeated frames complete only after all missing fragments arrive', async () => {
  const bytes = Uint8Array.from([0xef, 0xbb, 0xbf, ...utf8('# Zażółć gęślą jaźń 🔑\r\n  \r\n'), ...pattern(3500)]);
  const created = await transfer.createTransfer(bytes, 'Zażółć-🔑.conf');
  const collector = transfer.createCollector();
  assert.equal(collector.state, null);
  let result = await collector.accept(created.frames[4]);
  assert.equal(result.kind, 'progress');
  assert.equal(result.received, 1);
  assert.deepEqual([...result.missing], [1, 2, 3, 4, 6]);
  result = await collector.accept(created.frames[4]);
  assert.equal(result.duplicate, true);
  assert.equal(result.received, 1);
  for (const index of [0, 5, 2, 2, 3]) result = await collector.accept(created.frames[index]);
  assert.equal(result.kind, 'progress');
  assert.deepEqual([...result.missing], [2]);
  result = await collector.accept(created.frames[1]);
  assert.equal(result.kind, 'complete');
  assertBytes(result.bytes, bytes);
  assert.equal(result.name, 'Zażółć-🔑.conf');
  assert.equal(result.id, created.id);
  assert.equal(result.total, created.total);
  assert.equal(collector.state.complete, true);
  assert.deepEqual([...collector.state.missing], []);
});

test('a valid foreign session is ignored without mixing data or replacing progress', async () => {
  const primary = await transfer.createTransfer(pattern(1201), 'pierwszy.conf');
  const foreign = await transfer.createTransfer(pattern(1801), 'obcy.conf');
  const collector = transfer.createCollector();
  await collector.accept(primary.frames[0]);
  const result = await collector.accept(foreign.frames[1]);
  assert.equal(result.kind, 'foreign');
  assert.equal(result.id, primary.id);
  assert.equal(result.name, primary.name);
  assert.equal(result.received, 1);
  assert.equal(result.total, primary.total);
  assert.equal(result.foreignId, foreign.id);
  assert.equal(result.foreignName, foreign.name);
  const completed = await collectAll(collector, primary.frames.slice(1));
  assert.equal(completed.kind, 'complete');
  assertBytes(completed.bytes, pattern(1201));
});

test('plain QR bytes stay backward compatible and do not reset an active transfer', async () => {
  const collector = transfer.createCollector();
  const file = await transfer.createTransfer(pattern(1200), 'plik.conf');
  await collector.accept(file.frames[0]);
  for (const bytes of [utf8('[Interface]\r\n# zażółć  \r\n'), pattern(256), utf8('WGQR-XF')]) {
    const result = await collector.accept(bytes);
    assert.equal(result.kind, 'plain');
    assertBytes(result.bytes, bytes);
    assert.equal(collector.state.received, 1);
  }
});

test('unsupported versions and truncated framed payloads are rejected', async () => {
  const file = await transfer.createTransfer(pattern(1200), 'plik.conf');
  const collector = transfer.createCollector();
  await assert.rejects(collector.accept(changed(file.frames[0], bytes => { bytes[8] = 2; })), { code: 'UNSUPPORTED_VERSION' });
  await assert.rejects(collector.accept(utf8('WGQR-XFR')), { code: 'MALFORMED_FRAME' });
  await assert.rejects(collector.accept(file.frames[0].subarray(0, 50)), { code: 'MALFORMED_FRAME' });
  assert.equal(collector.state, null);
});

test('bad CRC rejects corrupted data without consuming a chunk or losing previous progress', async () => {
  const file = await transfer.createTransfer(pattern(1201), 'plik.conf');
  const collector = transfer.createCollector();
  await collector.accept(file.frames[0]);
  const broken = changed(file.frames[1], (bytes, view) => { bytes[view.getUint16(10)] ^= 1; }, false);
  await assert.rejects(collector.accept(broken), { code: 'CRC_MISMATCH' });
  assert.equal(collector.state.received, 1);
  const completed = await collectAll(collector, file.frames.slice(1));
  assertBytes(completed.bytes, pattern(1201));
});

test('structural bounds reject out-of-range indices, counts, lengths, flags, chunk sizes and size bombs', async () => {
  const file = await transfer.createTransfer(pattern(1201), 'plik.conf');
  const cases = [
    [(_, view) => view.setUint16(32, file.total), 'MALFORMED_FRAME'],
    [(_, view) => view.setUint16(34, 65535), 'MALFORMED_FRAME'],
    [(_, view) => view.setUint16(36, 65535), 'MALFORMED_FRAME'],
    [(_, view) => view.setUint16(38, 65535), 'MALFORMED_FRAME'],
    [(_, view) => view.setUint16(10, 1), 'MALFORMED_FRAME'],
    [(bytes) => { bytes[9] = 1; }, 'MALFORMED_FRAME'],
    [(_, view) => view.setUint32(28, 0), 'MALFORMED_FRAME'],
    [(_, view) => view.setUint32(28, 0xffffffff), 'FILE_TOO_LARGE']
  ];
  for (const [edit, code] of cases) {
    const collector = transfer.createCollector();
    await assert.rejects(collector.accept(changed(file.frames[0], edit)), { code });
    assert.equal(collector.state, null);
  }
  const extra = new Uint8Array(file.frames[0].length + 1);
  extra.set(file.frames[0]);
  await assert.rejects(transfer.createCollector().accept(extra), { code: 'MALFORMED_FRAME' });
});

test('metadata conflicts with the same ID cannot change file name, size, or digest', async () => {
  const file = await transfer.createTransfer(pattern(1801), 'plik.conf');
  const collector = transfer.createCollector();
  await collector.accept(file.frames[0]);
  const edits = [
    bytes => { bytes[72] = 88; },
    bytes => { bytes[40] ^= 1; },
    (_, view) => view.setUint32(28, file.size + 1)
  ];
  for (const edit of edits) {
    await assert.rejects(collector.accept(changed(file.frames[1], edit)), { code: 'METADATA_CONFLICT' });
    assert.equal(collector.state.received, 1);
    assert.equal(collector.state.name, 'plik.conf');
  }
});

test('conflicting payload for a repeated index is rejected even with a valid frame CRC', async () => {
  const file = await transfer.createTransfer(pattern(1801), 'plik.conf');
  const collector = transfer.createCollector();
  await collector.accept(file.frames[0]);
  const conflict = changed(file.frames[0], (bytes, view) => { bytes[view.getUint16(10) + 3] ^= 1; });
  await assert.rejects(collector.accept(conflict), { code: 'CHUNK_CONFLICT' });
  assert.equal(collector.state.received, 1);
  const completed = await collectAll(collector, file.frames.slice(1));
  assertBytes(completed.bytes, pattern(1801));
});

test('a wrong repeated whole-file SHA-256 fails completion and clears the failed session', async () => {
  const file = await transfer.createTransfer(pattern(1201), 'plik.conf');
  const badFrames = file.frames.map(frame => changed(frame, bytes => { bytes[40] ^= 1; }));
  const collector = transfer.createCollector();
  await collector.accept(badFrames[0]);
  await collector.accept(badFrames[1]);
  await assert.rejects(collector.accept(badFrames[2]), { code: 'DIGEST_MISMATCH' });
  assert.equal(collector.state, null);
  const corrected = await collectAll(collector, file.frames);
  assertBytes(corrected.bytes, pattern(1201));
});

test('reset while SHA-256 is pending cannot resurrect the old transfer or overwrite a new one', async () => {
  const oldFile = await transfer.createTransfer(pattern(601), 'stary.conf');
  const nextFile = await transfer.createTransfer(pattern(1201), 'nowy.conf');
  let release;
  let held = false;
  const delayedCrypto = {
    getRandomValues: bytes => webcrypto.getRandomValues(bytes),
    subtle: {
      digest: (algorithm, bytes) => {
        const result = webcrypto.subtle.digest(algorithm, bytes);
        if (held) return result;
        held = true;
        return new Promise((resolve, reject) => {
          release = () => result.then(resolve, reject);
        });
      }
    }
  };
  const collector = runtime(delayedCrypto).createCollector();
  await collector.accept(oldFile.frames[0]);
  const pending = collector.accept(oldFile.frames[1]);
  assert.equal(typeof release, 'function');
  assert.equal(collector.state.complete, false);
  const rejection = assert.rejects(pending, { code: 'TRANSFER_RESET' });
  collector.reset();
  assert.equal(collector.state, null);
  await collector.accept(nextFile.frames[0]);
  await release();
  await rejection;
  assert.equal(collector.state.id, nextFile.id);
  assert.equal(collector.state.received, 1);
  const nextComplete = await collectAll(collector, nextFile.frames.slice(1));
  assertBytes(nextComplete.bytes, pattern(1201));
});

test('simultaneous duplicates during verification share one digest and return identical results', async () => {
  const file = await transfer.createTransfer(pattern(601), 'plik.conf');
  let digests = 0;
  const collector = runtime({
    getRandomValues: bytes => webcrypto.getRandomValues(bytes),
    subtle: { digest: (...args) => { digests++; return webcrypto.subtle.digest(...args); } }
  }).createCollector();
  await collector.accept(file.frames[0]);
  const [first, second] = await Promise.all([collector.accept(file.frames[1]), collector.accept(file.frames[1])]);
  assert.equal(digests, 1);
  assert.equal(first.kind, 'complete');
  assert.equal(second.kind, 'complete');
  assertBytes(first.bytes, second.bytes);
});

test('file names are safe UTF-8 basenames capped at 120 bytes, including emoji boundaries', async () => {
  for (const [input, expected] of [
    ['../../mój-plik.conf', 'mój-plik.conf'],
    ['C:\\folder\\telefon.conf', 'telefon.conf'],
    ['  \u202eplik\u0000?.conf. ', 'plik_.conf'],
    ['CON.txt', 'plik.bin'],
    ['..', 'plik.bin'],
    ['😀'.repeat(40) + '.conf', '😀'.repeat(30)],
    ['con' + ' '.repeat(120) + 'tail.conf', 'plik.bin'],
    ['normal' + '\u2003'.repeat(40) + 'tail.conf', 'normal']
  ]) {
    const file = await transfer.createTransfer(pattern(3), input);
    assert.equal(file.name, expected);
    assert.ok(utf8(file.name).length <= 120);
    const result = await transfer.createCollector().accept(file.frames[0]);
    assert.equal(result.name, expected);
  }
  const normal = await transfer.createTransfer(pattern(3), 'plik.conf');
  await assert.rejects(transfer.createCollector().accept(changed(normal.frames[0], bytes => { bytes[72] = 0xff; })), { code: 'MALFORMED_FRAME' });
  await assert.rejects(transfer.createCollector().accept(changed(normal.frames[0], bytes => { bytes[72] = 47; })), { code: 'MALFORMED_FRAME' });
});

test('maximum 256 KiB file assembles exactly with a dynamic count of 437 frames', async () => {
  const bytes = pattern(transfer.MAX_FILE_BYTES);
  const file = await transfer.createTransfer(bytes, 'duży-plik.bin');
  assert.equal(file.total, 437);
  const completed = await collectAll(transfer.createCollector(), [...file.frames].reverse());
  assertBytes(completed.bytes, bytes);
  assert.equal(completed.size, transfer.MAX_FILE_BYTES);
});

test('invalid or excessive create input and missing Web Crypto produce explicit coded errors', async () => {
  await assert.rejects(transfer.createTransfer(new Uint8Array(), 'pusty'), { code: 'EMPTY_INPUT' });
  await assert.rejects(transfer.createTransfer(new Uint8Array(transfer.MAX_FILE_BYTES + 1), 'duży'), { code: 'FILE_TOO_LARGE' });
  await assert.rejects(transfer.createTransfer('string', 'tekst'), { code: 'INVALID_INPUT' });
  await assert.rejects(transfer.createCollector().accept(new Uint8ClampedArray(10)), { code: 'INVALID_INPUT' });
  const noCrypto = runtime(null);
  await assert.rejects(noCrypto.createTransfer(utf8('x'), 'x'), { code: 'CRYPTO_UNAVAILABLE' });
  const plain = await noCrypto.createCollector().accept(utf8('plain'));
  assert.equal(plain.kind, 'plain');
});

test('caller mutations cannot change a pending transfer, buffered chunks, state, or completed bytes', async () => {
  const original = pattern(1201);
  const input = new Uint8Array(original);
  const pending = transfer.createTransfer(input, 'plik.conf');
  input.fill(0);
  const file = await pending;
  const collector = transfer.createCollector();
  const firstFrame = new Uint8Array(file.frames[0]);
  await collector.accept(firstFrame);
  firstFrame.fill(0);
  const state = collector.state;
  state.received = 100;
  state.missing.length = 0;
  assert.equal(collector.state.received, 1);
  assert.equal(collector.state.missing.length, 2);
  const completed = await collectAll(collector, file.frames.slice(1));
  assertBytes(completed.bytes, original);
  completed.bytes.fill(0);
  const repeated = await collector.accept(file.frames[1]);
  assertBytes(repeated.bytes, original);
});

test('at least five animated-transfer frames survive the real QR matrix → PNG → jsQR pipeline', async () => {
  runInContext(coreSource, transfer.browser, { timeout: 3000 });
  const { encodeBytes, decodePixels } = transfer.browser.WGQR;
  const bytes = Uint8Array.from([0xef, 0xbb, 0xbf, ...utf8('# polskie: Zażółć gęślą jaźń 🔑\r\n  \r\n'), ...pattern(3800)]);
  const file = await transfer.createTransfer(bytes, 'Zażółć-🔑.conf');
  assert.ok(file.total >= 5);
  const collector = transfer.createCollector();
  let completed;
  for (const frame of [...file.frames].reverse()) {
    const qr = encodeBytes(frame);
    assert.equal(qr.level, 'M');
    const scale = 4;
    const margin = 4;
    const side = (qr.size + margin * 2) * scale;
    const png = new PNG({ width: side, height: side });
    for (let y = 0; y < side; y++) {
      for (let x = 0; x < side; x++) {
        const qx = Math.floor(x / scale) - margin;
        const qy = Math.floor(y / scale) - margin;
        const dark = qx >= 0 && qy >= 0 && qx < qr.size && qy < qr.size && qr.data[qy * qr.size + qx];
        const offset = (y * side + x) * 4;
        png.data[offset] = png.data[offset + 1] = png.data[offset + 2] = dark ? 0 : 255;
        png.data[offset + 3] = 255;
      }
    }
    const reopened = PNG.sync.read(PNG.sync.write(png));
    const decoded = decodePixels(new Uint8ClampedArray(reopened.data), reopened.width, reopened.height);
    assert.ok(decoded);
    assertBytes(decoded.bytes, frame);
    completed = await collector.accept(decoded.bytes);
  }
  assert.equal(completed.kind, 'complete');
  assertBytes(completed.bytes, bytes);
  assert.equal(completed.name, file.name);
});
