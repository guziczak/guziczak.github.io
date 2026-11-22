import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const sources = await Promise.all(['qr-resilient.js', 'qr-playback.js', 'qr-large.js', 'qr-core.js']
  .map(name => readFile(new URL(`../../assets/${name}`, import.meta.url), 'utf8')));
const SEGMENT_BYTES = 2 * 1024 * 1024;
const pattern = length => Uint8Array.from({ length }, (_, index) => (index * 73 + Math.floor(index / 256)) & 255);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const equalBytes = (actual, expected) => assert.deepEqual(Buffer.from(actual), Buffer.from(expected));
const plain = value => JSON.parse(JSON.stringify(value));
function runtime(crypto = webcrypto) {
  const browser = createContext({ TextEncoder, TextDecoder, crypto, File, Blob }, { codeGeneration: { strings: false, wasm: false } });
  for (const source of sources.slice(0, 3)) runInContext(source, browser, { timeout: 3000 });
  return { browser, playback: browser.WGPlayback, ...browser.WGLarge };
}
const api = runtime();
function crc(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
function edit(bytes, change, fixCrc = true) {
  const copy = new Uint8Array(bytes), view = new DataView(copy.buffer);
  change(copy, view);
  if (fixCrc) view.setUint32(copy.length - 4, crc(copy.subarray(0, -4)));
  return copy;
}
function independentRoot(metadata, hashes) {
  const name = Buffer.from(metadata.name), fields = Buffer.alloc(13);
  fields[0] = 4; fields.writeUInt32BE(metadata.size, 1); fields.writeUInt32BE(SEGMENT_BYTES, 5);
  fields.writeUInt16BE(metadata.segmentCount, 9); fields.writeUInt16BE(name.length, 11);
  return digest(Buffer.concat([Buffer.from('WGQR-LARGE-ROOT\0'), fields, name, ...hashes.map(value => Buffer.from(value, 'hex'))]));
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
class MemoryStore {
  constructor() { this.descriptor = null; this.parts = new Map(); this.hashes = []; this.complete = false; this.output = null;
    this.beginCalls = 0; this.putCalls = 0; this.finishCalls = 0; this.fileCalls = 0; this.clearCalls = 0; this.disposeCalls = 0;
    this.putGate = null; this.finishGate = null; this.putInputs = []; }
  get state() {
    const completed = this.descriptor ? Array.from({ length: this.descriptor.segmentCount }, (_, index) => this.parts.has(index)) : [];
    return { descriptor: this.descriptor, completed,
      digests: completed.map((done, index) => done ? this.hashes[index] : null),
      savedBytes: [...this.parts.values()].reduce((sum, bytes) => sum + bytes.length, 0), complete: this.complete };
  }
  async begin(descriptor) {
    this.beginCalls++;
    if (this.descriptor && JSON.stringify(plain(this.descriptor)) !== JSON.stringify(plain(descriptor))) throw Object.assign(new Error('conflict'), { code: 'STORE_CONFLICT' });
    this.descriptor = plain(descriptor);
  }
  async putSegment(index, bytes, hash) {
    this.putCalls++; this.putInputs.push(bytes);
    if (this.putGate) await this.putGate.promise;
    assert.equal(bytes.length, Math.min(SEGMENT_BYTES, this.descriptor.size - index * SEGMENT_BYTES));
    assert.equal(digest(bytes), hash);
    this.parts.set(index, new Uint8Array(bytes)); this.hashes[index] = hash;
  }
  async finish({ onProgress } = {}) {
    this.finishCalls++;
    if (this.finishGate) await this.finishGate.promise;
    const values = [];
    for (let index = 0; index < this.descriptor.segmentCount; index++) {
      const bytes = this.parts.get(index);
      assert.ok(bytes); assert.equal(digest(bytes), this.hashes[index]); values.push(bytes);
    }
    this.output = new File(values, this.descriptor.name); this.complete = true;
    onProgress?.({ phase: 'finish', completedBytes: this.descriptor.size, totalBytes: this.descriptor.size });
    return this.output;
  }
  async file() { this.fileCalls++; assert.ok(this.complete); return this.output; }
  clear() { this.clearCalls++; }
  dispose() { this.disposeCalls++; }
}
async function completeSmall(transfer, collector) {
  let result = await collector.accept(transfer.manifestFrame());
  for (let index = 0; index < transfer.total; index++) result = await collector.accept(transfer.frame(index));
  return result;
}

test('large sender slices sequentially, has a density-independent canonical root and owns only one live segment', async () => {
  const original = pattern(SEGMENT_BYTES + 17), calls = [], progress = [];
  const file = { name: '../żółw.zip', size: original.length, arrayBuffer() { assert.fail('Whole-file reads are forbidden'); },
    slice(start, end) { calls.push([start, end]); return new Blob([original.subarray(start, end)]); } };
  const sender = await api.createSender(file, { chunkBytes: 384, onProgress: value => progress.push(value) });
  assert.deepEqual(calls, [[0, SEGMENT_BYTES], [SEGMENT_BYTES, original.length]]);
  assert.deepEqual(progress.map(value => value.completedBytes), [SEGMENT_BYTES, original.length]);
  assert.equal(sender.descriptor.name, 'żółw.zip'); assert.ok(Object.isFrozen(sender.descriptor));
  assert.equal(sender.descriptor.id, independentRoot(sender.descriptor, [digest(original.subarray(0, SEGMENT_BYTES)), digest(original.subarray(SEGMENT_BYTES))]));
  assert.notEqual(sender.descriptor.id, digest(original));
  const dense = await api.createSender(file, { chunkBytes: 600 });
  assert.deepEqual(plain(dense.descriptor), plain(sender.descriptor));
  const first = await sender.loadSegment(0); assert.equal(first.size, SEGMENT_BYTES); assert.equal(first.version, 4);
  const second = await sender.loadSegment(1); assert.equal(second.size, 17); assert.equal(second.total, 1);
  assert.throws(() => first.frame(0), { code: 'TRANSFER_DISPOSED' });
  assert.equal(api.parseFrame(second.frame(0)).segmentIndex, 1);
  second.dispose(); assert.throws(() => second.manifestFrame(), { code: 'TRANSFER_DISPOSED' });
  sender.dispose(); dense.dispose();
});

test('representative v4 headers, nested CRC and root binding have independent binary checks', async () => {
  const sender = await api.createSender(new File([pattern(613)], 'binary.zip'), { chunkBytes: 600 });
  const transfer = await sender.loadSegment(0), frame = transfer.frame(0), manifest = transfer.manifestFrame();
  assert.equal(frame.length, 692); assert.equal(new DataView(frame.buffer).getUint16(10), 48);
  assert.equal(Buffer.from(frame.subarray(0, 8)).toString(), 'WGQR-LRG'); assert.equal(frame[8], 4); assert.equal(frame[9], 0);
  equalBytes(frame.subarray(12, 44), Buffer.from(sender.id, 'hex'));
  assert.equal(new DataView(frame.buffer).getUint16(46), 640);
  assert.equal(new DataView(frame.buffer).getUint32(frame.length - 4), crc(frame.subarray(0, -4)));
  const parsed = api.parseFrame(manifest);
  assert.deepEqual(plain(parsed.descriptor), plain(sender.descriptor)); assert.equal(parsed.digest, digest(pattern(613)));
  assert.equal(parsed.inner.length, 91); assert.equal(parsed.packetType, 'manifest');
  assert.equal(api.parseFrame(frame).packetType, 'single');
  const unaligned = new Uint8Array(frame.length + 3); unaligned.set(frame, 3);
  assert.equal(api.parseFrame(unaligned.subarray(3)).id, sender.id);
  const store = new MemoryStore(), receiver = api.createCollector({ store });
  const pending = await receiver.accept(frame);
  assert.equal(pending.kind, 'pending'); assert.equal(receiver.state, null); assert.equal(store.beginCalls, 0);
  await receiver.accept(manifest);
  const ack = receiver.createFeedback({ suggestedRate: 20 });
  assert.equal(ack.length, 61); assert.equal(Buffer.from(ack.subarray(0, 8)).toString(), 'WGQR-LAK');
  assert.deepEqual(plain(sender.acceptFeedback(ack)), { complete: false, missingSegments: [0], suggestedRate: 20 });
  sender.dispose(); receiver.dispose();
});

test('exact binary reconstruction accepts reordered source symbols and repair equations', async () => {
  const original = new Uint8Array([0xef, 0xbb, 0xbf, 0, 255, 13, 10, ...pattern(600 * 35 + 7)]);
  for (const chunkBytes of [384, 600]) {
    const sender = await api.createSender(new File([original], 'exact.bin'), { chunkBytes });
    const transfer = await sender.loadSegment(0), store = new MemoryStore(), receiver = api.createCollector({ store });
    await receiver.accept(transfer.manifestFrame());
    let result;
    for (let index = transfer.total - 1; index >= 0; index--) {
      if (index % 4 !== 0) result = await receiver.accept(transfer.frame(index));
    }
    for (let serial = 0; serial < 200 && result?.kind !== 'complete'; serial++) {
      for (let block = 0; block < transfer.blockCount; block++) {
        result = await receiver.accept(transfer.repairFrame(block, serial));
        if (result.kind === 'complete') break;
      }
    }
    assert.equal(result.kind, 'complete'); assert.equal(result.bytes, undefined); assert.equal(result.completedSegments, 1);
    assert.equal(result.receivedBytes, original.length); assert.equal(result.pendingBytes, 0);
    equalBytes(new Uint8Array(await result.file.arrayBuffer()), original);
    assert.equal(store.putCalls, 1); assert.equal(store.finishCalls, 1);
    assert.equal(store.putInputs[0].every(value => value === 0), true, 'Released segment copies are wiped after storage consumes them');
    const again = await receiver.accept(transfer.frame(0)); assert.equal(again.file, result.file); assert.equal(store.putCalls, 1);
    assert.deepEqual(plain(sender.acceptFeedback(receiver.createFeedback({ suggestedRate: 15 }))), { complete: true, missingSegments: [], suggestedRate: 15 });
    sender.dispose(); receiver.dispose();
  }
});

test('a fresh inner session needs a manifest, replaces partial equations and retains durable segments', async () => {
  const original = pattern(SEGMENT_BYTES + 619), file = new File([original], 'resume.zip');
  const first = await api.createSender(file, { chunkBytes: 600 }), second = await api.createSender(file, { chunkBytes: 384 });
  const store = new MemoryStore(); await store.begin(first.descriptor);
  await store.putSegment(0, original.subarray(0, SEGMENT_BYTES), digest(original.subarray(0, SEGMENT_BYTES)));
  const receiver = api.createCollector({ store });
  assert.equal(receiver.state.savedBytes, SEGMENT_BYTES);
  assert.deepEqual(plain(first.acceptFeedback(receiver.createFeedback()).missingSegments), [1]);
  assert.equal((await receiver.resume()).completedSegments, 1);
  const old = await first.loadSegment(1), fresh = await second.loadSegment(1);
  await receiver.accept(old.manifestFrame()); await receiver.accept(old.frame(0));
  assert.equal(receiver.state.pendingBytes, 600);
  assert.equal((await receiver.accept(fresh.frame(0))).kind, 'pending'); assert.equal(receiver.state.pendingBytes, 600);
  await receiver.accept(fresh.manifestFrame()); assert.equal(receiver.state.pendingBytes, 0);
  assert.equal((await receiver.accept(old.frame(1))).kind, 'pending');
  let result;
  for (let index = fresh.total - 1; index >= 0; index--) result = await receiver.accept(fresh.frame(index));
  assert.equal(result.kind, 'complete'); equalBytes(new Uint8Array(await result.file.arrayBuffer()), original);
  assert.equal(store.putCalls, 2);
  receiver.reset(); assert.equal(receiver.state.savedBytes, original.length);
  assert.equal((await receiver.resume()).kind, 'complete'); assert.equal(store.finishCalls, 1); assert.equal(store.fileCalls, 1);
  receiver.dispose(); assert.equal(store.clearCalls, 0); assert.equal(store.disposeCalls, 0);
  first.dispose(); second.dispose();
});

test('data cannot change metadata, switch a foreign root or acknowledge unwritten bytes', async () => {
  const sender = await api.createSender(new File([pattern(601)], 'commit.bin'), { chunkBytes: 600 });
  const foreign = await api.createSender(new File([pattern(602)], 'other.bin'), { chunkBytes: 600 });
  const transfer = await sender.loadSegment(0), other = await foreign.loadSegment(0), store = new MemoryStore();
  const receiver = api.createCollector({ store }); await receiver.accept(transfer.manifestFrame());
  assert.equal((await receiver.accept(other.manifestFrame())).kind, 'foreign');
  assert.equal((await receiver.accept(other.frame(0))).kind, 'foreign'); assert.equal(store.beginCalls, 1);
  await receiver.accept(transfer.frame(0)); assert.equal(receiver.state.pendingBytes, 600);
  store.putGate = deferred();
  const final = receiver.accept(transfer.frame(1));
  for (let attempt = 0; store.putCalls === 0 && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 1));
  assert.equal(store.putCalls, 1); assert.equal(receiver.state.savedBytes, 0);
  assert.deepEqual(plain(sender.acceptFeedback(receiver.createFeedback()).missingSegments), [0]);
  store.putGate.resolve(); assert.equal((await final).kind, 'complete');
  sender.dispose(); foreign.dispose(); receiver.dispose();
});

test('reset during a disk write discards its late reply without deleting a valid durable commit', async () => {
  const original = pattern(83), sender = await api.createSender(new File([original], 'reset.bin'));
  const transfer = await sender.loadSegment(0), store = new MemoryStore(), receiver = api.createCollector({ store });
  await receiver.accept(transfer.manifestFrame()); store.putGate = deferred();
  const pending = receiver.accept(transfer.frame(0));
  const rejected = assert.rejects(pending, { code: 'TRANSFER_RESET' });
  for (let attempt = 0; store.putCalls === 0 && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 1));
  assert.equal(store.putCalls, 1); receiver.reset(); store.putGate.resolve(); await rejected;
  assert.equal(store.clearCalls, 0); assert.equal(store.finishCalls, 0); assert.equal(receiver.state.savedBytes, original.length);
  assert.equal(store.putInputs[0].every(value => value === 0), true);
  const restored = await receiver.resume(); assert.equal(restored.kind, 'complete');
  equalBytes(new Uint8Array(await restored.file.arrayBuffer()), original);
  sender.dispose(); receiver.dispose();
});

test('root verification precedes final assembly, including resume from an otherwise valid durable store', async () => {
  const sender = await api.createSender(new File([pattern(23)], 'root.bin')), transfer = await sender.loadSegment(0);
  const store = new MemoryStore(), receiver = api.createCollector({ store });
  const forged = bytes => edit(bytes, value => value.fill(0x11, 12, 44));
  await receiver.accept(forged(transfer.manifestFrame()));
  await assert.rejects(receiver.accept(forged(transfer.frame(0))), { code: 'ROOT_MISMATCH' });
  assert.equal(store.finishCalls, 0); assert.equal(receiver.state.complete, false);
  assert.equal(api.parseFeedback(receiver.createFeedback()).complete, false);
  assert.deepEqual(plain(api.parseFeedback(receiver.createFeedback()).missingSegments), []);
  receiver.reset(); await assert.rejects(receiver.resume(), { code: 'ROOT_MISMATCH' }); assert.equal(store.finishCalls, 0);
  sender.dispose(); receiver.dispose();
});

test('source changes, stale loads, cancellation and disposal never expose a replaced segment', async () => {
  const original = pattern(SEGMENT_BYTES + 7); let gate = null, waiting = false, heldBuffer = null;
  const file = { name: 'changing.bin', size: original.length, slice(start, end) { return { async arrayBuffer() {
    const bytes = original.slice(start, end); if (gate && start === 0) { waiting = true; heldBuffer = bytes; await gate.promise; }
    return bytes.buffer;
  } }; } };
  const sender = await api.createSender(file, { chunkBytes: 600 });
  gate = deferred(); const old = sender.loadSegment(0); const rejected = assert.rejects(old, { code: 'CANCELLED' });
  assert.equal(waiting, true); const fresh = await sender.loadSegment(1); gate.resolve(); await rejected;
  assert.equal(heldBuffer.every(value => value === 0), true); assert.equal(api.parseFrame(fresh.frame(0)).segmentIndex, 1);
  gate = null; original[SEGMENT_BYTES] ^= 1;
  await assert.rejects(sender.loadSegment(1), { code: 'FILE_CHANGED' });
  sender.dispose(); await assert.rejects(sender.loadSegment(0), { code: 'CANCELLED' });
  let current = true, read = 0;
  const cancelFile = { size: SEGMENT_BYTES + 1, name: 'cancel.bin', slice(start, end) {
    read++; return new Blob([new Uint8Array(end - start)]);
  } };
  await assert.rejects(api.createSender(cancelFile, { isCurrent: () => current, onProgress() { current = false; } }), { code: 'CANCELLED' });
  assert.equal(read, 1);
});

test('strict outer and inner bounds reject malformed packets before storage or equation allocation', async () => {
  const sender = await api.createSender(new File([pattern(1201)], 'safe.bin'), { chunkBytes: 600 });
  const transfer = await sender.loadSegment(0), frame = transfer.frame(0), manifest = transfer.manifestFrame();
  const store = new MemoryStore(), receiver = api.createCollector({ store });
  const bad = [new Uint8Array(), frame.subarray(0, 8), new Uint8Array(693),
    edit(frame, bytes => { bytes[8] = 3; }), edit(frame, bytes => { bytes[9] = 2; }),
    edit(frame, (_, view) => view.setUint16(44, 100)), edit(frame, (_, view) => view.setUint16(46, 65535)),
    edit(manifest, (_, view) => view.setUint32(48, 200 * 1024 * 1024 + 1)),
    edit(manifest, (_, view) => view.setUint32(52, SEGMENT_BYTES - 1)),
    edit(manifest, (_, view) => view.setUint16(56, 100)), edit(manifest, (_, view) => view.setUint16(58, 65535)),
    edit(manifest, bytes => { bytes[92] = 0; }), edit(manifest, bytes => { bytes[92] = 0xff; }),
    edit(manifest, bytes => { bytes[60] ^= 1; }), edit(frame, bytes => { bytes[100] ^= 1; }, false),
    edit(frame, bytes => { bytes[100] ^= 1; })];
  for (const bytes of bad) await assert.rejects(receiver.accept(bytes));
  assert.equal(store.beginCalls, 0); assert.equal(receiver.state, null);
  assert.equal(api.isReserved(frame.subarray(0, 8)), true); assert.equal(api.isFrame(frame.subarray(0, 8)), true);
  await receiver.accept(manifest);
  await assert.rejects(receiver.accept(receiver.createFeedback()), { code: 'FEEDBACK_FRAME' });
  const changedName = edit(manifest, bytes => { bytes[92] = 'x'.charCodeAt(0); });
  await assert.rejects(receiver.accept(changedName), { code: 'METADATA_CONFLICT' });
  assert.equal(receiver.state.savedBytes, 0);
  receiver.reset();
  await assert.rejects(receiver.accept(edit(frame, (_, view) => view.setUint16(44, 99))), { code: 'INVALID_SEGMENT' });
  sender.dispose(); receiver.dispose();
});

test('feedback validates identity, completion, tail bits, rates and declared dimensions', async () => {
  const sender = await api.createSender(new File([pattern(11)], 'ack.bin'));
  const transfer = await sender.loadSegment(0), store = new MemoryStore(), receiver = api.createCollector({ store });
  await receiver.accept(transfer.manifestFrame()); const ack = receiver.createFeedback();
  for (const rate of [1, 2, 5, 10, 15, 20]) assert.equal(sender.acceptFeedback(receiver.createFeedback({ suggestedRate: rate })).suggestedRate, rate);
  for (const bytes of [edit(ack, value => { value[8] = 3; }), edit(ack, value => { value[9] = 1; }),
    edit(ack, value => { value[10] = 30; }), edit(ack, value => { value[11] = 1; }),
    edit(ack, (_, view) => view.setUint16(52, 0)), edit(ack, (_, view) => view.setUint16(54, 65535)),
    edit(ack, value => { value[56] |= 0x80; }), edit(ack, value => { value[44] ^= 1; }, false)]) {
    assert.throws(() => sender.acceptFeedback(bytes), { code: 'MALFORMED_FEEDBACK' });
  }
  assert.throws(() => sender.acceptFeedback(edit(ack, value => { value[12] ^= 1; })), { code: 'FEEDBACK_SESSION_MISMATCH' });
  assert.throws(() => receiver.createFeedback({ suggestedRate: 0 }), { code: 'INVALID_INPUT' });
  assert.equal(api.isReserved(ack.subarray(0, 8)), true);
  sender.dispose(); receiver.dispose();
});

test('empty and oversized files fail before reading and names remain bounded canonical UTF-8', async () => {
  for (const size of [0, -1, 200 * 1024 * 1024 + 1, 2 ** 40, 1.5]) {
    await assert.rejects(api.createSender({ size, name: 'bad.bin', slice() { assert.fail('Unexpected read'); } }), { code: 'INVALID_FILE' });
  }
  const sender = await api.createSender(new File([pattern(1)], '../' + '🔑'.repeat(50)));
  assert.equal(Buffer.byteLength(sender.name), 120); assert.equal(sender.segmentCount, 1);
  const transfer = await sender.loadSegment(0); assert.equal(api.parseFrame(transfer.manifestFrame()).descriptor.name, sender.name);
  await assert.rejects(sender.loadSegment(1), { code: 'INVALID_SEGMENT' });
  await assert.rejects(api.createSender(new File(['x'], 'x'), { isCurrent: null }), { code: 'INVALID_INPUT' });
  assert.doesNotMatch(sources[2], /\b(?:fetch|XMLHttpRequest|WebSocket|localStorage)\b/);
  sender.dispose();
});

test('large packets work with rewindable dual playback and missing manifests', async () => {
  const original = pattern(600 * 67 + 3), sender = await api.createSender(new File([original], 'dual.bin'), { chunkBytes: 600 });
  const transfer = await sender.loadSegment(0), planner = api.playback.create(transfer, { lanes: 2 });
  assert.equal(planner.interleave, true);
  const store = new MemoryStore(), receiver = api.createCollector({ store });
  const first = planner.next(); first.frames.forEach(frame => frame.bytes.fill(0)); // Lose first manifest and one source.
  let result, duplicateCheckpoint;
  for (let display = 0; display < 400 && result?.kind !== 'complete'; display++) {
    const planned = planner.next();
    if (display === 1) duplicateCheckpoint = planned.checkpoint;
    if (display === 2) { assert.equal(planner.restore(duplicateCheckpoint), true); }
    for (const frame of [...planned.frames].reverse()) {
      if (frame.kind === 'source' && frame.index % 9 === 0) continue;
      result = await receiver.accept(frame.bytes); frame.bytes.fill(0);
      if (result.kind === 'complete') break;
    }
  }
  assert.equal(result.kind, 'complete'); equalBytes(new Uint8Array(await result.file.arrayBuffer()), original);
  sender.dispose(); receiver.dispose();
});

test('v4 manifest, dense data, repair and ACK round-trip through actual QR pixels', async () => {
  runInContext(sources[3], api.browser, { timeout: 3000 });
  const throughQr = bytes => {
    const qr = api.browser.WGQR.encodeBytes(bytes, { errorCorrectionLevel: 'M' }), scale = 4, side = (qr.size + 8) * scale;
    const image = new PNG({ width: side, height: side }); image.data.fill(255);
    for (let row = 0; row < qr.size; row++) for (let column = 0; column < qr.size; column++) {
      if (!qr.data[row * qr.size + column]) continue;
      for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) {
        const offset = (((row + 4) * scale + y) * side + (column + 4) * scale + x) * 4;
        image.data[offset] = image.data[offset + 1] = image.data[offset + 2] = 0;
      }
    }
    const reopened = PNG.sync.read(PNG.sync.write(image));
    const decoded = api.browser.WGQR.decodePixels(new Uint8ClampedArray(reopened.data), side, side);
    assert.ok(decoded); equalBytes(decoded.bytes, bytes); return decoded.bytes;
  };
  const original = pattern(901), sender = await api.createSender(new File([original], 'Zażółć.zip'), { chunkBytes: 600 });
  const transfer = await sender.loadSegment(0), store = new MemoryStore(), receiver = api.createCollector({ store });
  assert.equal((await receiver.accept(throughQr(transfer.manifestFrame()))).kind, 'manifest');
  await receiver.accept(throughQr(transfer.frame(0)));
  let result;
  for (let serial = 0; serial < 20; serial++) {
    result = await receiver.accept(throughQr(transfer.repairFrame(0, serial)));
    if (result.kind === 'complete') break;
  }
  assert.equal(result.kind, 'complete'); equalBytes(new Uint8Array(await result.file.arrayBuffer()), original);
  assert.equal(sender.acceptFeedback(throughQr(receiver.createFeedback())).complete, true);
  sender.dispose(); receiver.dispose();
});
