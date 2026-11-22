import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomFillSync, webcrypto } from 'node:crypto';
import * as zlib from 'node:zlib';
import { runInThisContext } from 'node:vm';
import { createDiskBackend, openDiskFile } from './qr-large-store-fs.mjs';

const SEGMENT = 2 * 1024 * 1024;
const FULL_SIZE = 200 * 1024 * 1024;
// Exercised 2026-11-22 on Node 24.22.3: 209715200 bytes, 100 segments,
// 371500 v4 packets, 200 source reads of at most 2 MiB, final SHA-256
// 11fd6e7eb89c9dd63976cddd3341af78d7e5aa41def8047712a458fe151e60ce.
// Duration 48.8 s is a CPU/disk integration result, not an optical camera rate.
const names = ['qr-core.js', 'qr-transfer.js', 'qr-resilient.js', 'qr-large-store.js', 'qr-large.js'];
const sources = Object.fromEntries(await Promise.all(names.map(async name => [name,
  await readFile(new URL(`../../assets/${name}`, import.meta.url), 'utf8')])));
for (const name of names.slice(0, 3)) runInThisContext(sources[name], { filename: name });
const { WGQR, WGResilient, WGTransfer } = globalThis;

// Evaluate the unmodified modules in the native V8 realm, while each module's
// root closes over an isolated OPFS backend. The large run processes ~350k frames.
function runtime(backend) {
  const scope = { crypto: webcrypto, navigator: { storage: backend.storage, locks: backend.locks },
    WGResilient, WGTransfer, WGQR, performance, setTimeout, clearTimeout, File, Blob };
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { value: scope, configurable: true });
  try {
    for (const name of names.slice(3)) runInThisContext(sources[name], { filename: name });
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else delete globalThis.window;
  }
  return scope;
}

async function temporary() {
  try { return await mkdtemp(join(process.env.WGQR_TEST_TMPDIR || tmpdir(), 'wgqr-large-integration-')); }
  catch (error) {
    if (!['EACCES', 'EPERM', 'ENOENT'].includes(error.code)) throw error;
    return mkdtemp(join(dirname(fileURLToPath(import.meta.url)), 'wgqr-large-integration-'));
  }
}

async function fixture() {
  const directory = await temporary();
  const backend = await createDiskBackend(join(directory, 'opfs'));
  const api = runtime(backend);
  const stores = [];
  const openStore = async () => { const store = await api.WGLargeStore.open(); stores.push(store); return store; };
  return { directory, backend, ...api, openStore,
    async close() { for (const store of stores) await store.dispose(); await rm(directory, { recursive: true, force: true }); } };
}

function patterned(length, seed = 0x12345678) {
  return Uint8Array.from({ length }, () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed & 255; });
}

function boundedFile(file) {
  const audit = { reads: [], fullReads: 0, active: 0, maxActive: 0 };
  const source = {
    name: file.name, size: file.size, type: file.type, lastModified: file.lastModified,
    async arrayBuffer() { audit.fullReads++; throw new Error('A sender must not materialize the whole source file'); },
    slice(start, end) {
      assert.ok(Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end <= file.size && end > start);
      assert.ok(end - start <= SEGMENT, 'A source read must fit in one segment');
      const piece = file.slice(start, end);
      return { size: piece.size, async arrayBuffer() {
        audit.reads.push({ start, end, bytes: end - start });
        audit.active++; audit.maxActive = Math.max(audit.maxActive, audit.active);
        try { return await piece.arrayBuffer(); } finally { audit.active--; }
      } };
    }
  };
  return { source, audit };
}

// Independent Node crypto reference for both the ordinary whole-file SHA-256
// and the specified domain-separated root over ordered segment hashes.
async function references(file) {
  const digests = [], full = createHash('sha256');
  for (let offset = 0; offset < file.size; offset += SEGMENT) {
    const bytes = new Uint8Array(await file.slice(offset, Math.min(file.size, offset + SEGMENT)).arrayBuffer());
    full.update(bytes); digests.push(createHash('sha256').update(bytes).digest()); bytes.fill(0);
  }
  const name = Buffer.from(file.name, 'utf8'), header = Buffer.alloc(13);
  header[0] = 4; header.writeUInt32BE(file.size, 1); header.writeUInt32BE(SEGMENT, 5);
  header.writeUInt16BE(digests.length, 9); header.writeUInt16BE(name.length, 11);
  const root = createHash('sha256').update(Buffer.from('WGQR-LARGE-ROOT\0')).update(header).update(name);
  for (const digest of digests) root.update(digest);
  return { full: full.digest('hex'), root: root.digest('hex'), segments: digests.map(digest => digest.toString('hex')) };
}

async function hashFile(file) {
  const hash = createHash('sha256');
  for (let offset = 0; offset < file.size; offset += 256 * 1024) {
    const bytes = new Uint8Array(await file.slice(offset, Math.min(file.size, offset + 256 * 1024)).arrayBuffer());
    hash.update(bytes); bytes.fill(0);
  }
  return hash.digest('hex');
}

function optical(bytes) {
  const matrix = WGQR.encodeBytes(bytes, { errorCorrectionLevel: 'M' });
  const scale = 3, side = (matrix.size + 8) * scale;
  const pixels = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let y = 0; y < matrix.size; y++) for (let x = 0; x < matrix.size; x++) {
    if (!matrix.data[y * matrix.size + x]) continue;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const offset = (((y + 4) * scale + dy) * side + (x + 4) * scale + dx) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 0;
    }
  }
  const result = WGQR.decodePixels(pixels, side, side, { inversionAttempts: 'dontInvert' });
  assert.ok(result, 'A representative v4 envelope must survive actual QR pixels and decoding');
  assert.deepEqual(result.bytes, bytes);
  pixels.fill(0); matrix.data.fill(0);
  return result.bytes;
}

async function acceptOwned(collector, bytes) {
  try { return await collector.accept(bytes); } finally { bytes.fill(0); }
}
async function sendSegment(collector, segment, end = segment.total) {
  let result = await acceptOwned(collector, segment.manifestFrame());
  for (let index = 0; index < end; index++) {
    if (index && index % 16 === 0) await acceptOwned(collector, segment.manifestFrame());
    result = await acceptOwned(collector, segment.frame(index));
  }
  return result;
}
function deferClose(backend, suffix) {
  let enter, release, used = false;
  const entered = new Promise(resolve => { enter = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  backend.faults.before = async event => {
    if (!used && event.op === 'close' && event.path.endsWith(suffix)) { used = true; enter(event); await held; }
  };
  return { entered, release };
}

test('v4 envelopes survive real QR decoding, loss, reordering and foreign traffic before durable completion', async () => {
  const f = await fixture(); let sender, foreign, collector;
  try {
    const original = patterned(37 * 600 + 97);
    const file = new File([original], 'optical.bin'), input = boundedFile(file);
    sender = await f.WGLarge.createSender(input.source, { chunkBytes: 600 });
    assert.equal(sender.descriptor.id, (await references(file)).root);
    const segment = await sender.loadSegment(0), store = await f.openStore();
    collector = f.WGLarge.createCollector({ store });
    const data = segment.frame(0); assert.equal(data.length, 692);
    assert.equal((await collector.accept(optical(data))).kind, 'pending'); assert.equal(store.state.descriptor, null);
    assert.equal((await collector.accept(optical(segment.manifestFrame()))).kind, 'manifest');
    await collector.accept(optical(data)); await collector.accept(data);
    assert.equal(collector.state.received, 1); assert.equal(collector.state.completedSegments, 0);
    foreign = await f.WGLarge.createSender(new File([patterned(900, 77)], 'foreign.bin'), { chunkBytes: 600 });
    const wrong = await foreign.loadSegment(0);
    assert.equal((await collector.accept(wrong.manifestFrame())).kind, 'foreign'); assert.equal(collector.state.received, 1);
    const damaged = segment.frame(1); damaged[damaged.length - 1] ^= 1;
    await assert.rejects(collector.accept(damaged), { code: 'CRC_MISMATCH' }); assert.equal(collector.state.received, 1);
    const lost = new Set([4, 17, 36]);
    let result;
    for (let index = segment.total - 1; index > 0; index--) if (!lost.has(index)) result = await acceptOwned(collector, segment.frame(index));
    assert.notEqual(result.kind, 'complete');
    for (let serial = 0; serial < 128 && result.kind !== 'complete'; serial++) {
      result = await acceptOwned(collector, segment.repairFrame(serial % segment.blockCount, serial));
    }
    assert.equal(result.kind, 'complete'); assert.equal(result.complete, true); assert.equal(result.file.size, original.length);
    assert.equal(Object.hasOwn(result, 'bytes'), false); assert.equal(store.state.complete, true);
    assert.equal(await hashFile(result.file), createHash('sha256').update(original).digest('hex'));
    const feedback = optical(collector.createFeedback({ suggestedRate: 15 }));
    assert.deepEqual(sender.acceptFeedback(feedback), { complete: true, missingSegments: [], suggestedRate: 15 });
    await assert.rejects(collector.accept(feedback), { code: 'FEEDBACK_FRAME' });
    assert.equal(input.audit.fullReads, 0); assert.equal(input.audit.maxActive, 1);
  } finally { collector?.dispose(); sender?.dispose(); foreign?.dispose(); await f.close(); }
});

test('durable ACK waits for metadata close and same-file resume preserves only completed segments', async () => {
  const f = await fixture(); let sender, resumedSender, collector, resumedCollector, gate;
  try {
    const original = patterned(SEGMENT + 1201), file = new File([original], 'resumable.bin');
    const input = boundedFile(file), reference = await references(file);
    sender = await f.WGLarge.createSender(input.source, { chunkBytes: 600 });
    let store = await f.openStore(); collector = f.WGLarge.createCollector({ store });
    const segment = await sender.loadSegment(0);
    await sendSegment(collector, segment, segment.total - 1);
    gate = deferClose(f.backend, 'state.json');
    const pending = acceptOwned(collector, segment.frame(segment.total - 1));
    await gate.entered;
    assert.equal(collector.state.completedSegments, 0); assert.equal(store.state.savedBytes, 0);
    assert.deepEqual(sender.acceptFeedback(collector.createFeedback()).missingSegments, [0, 1]);
    gate.release(); const saved = await pending;
    assert.equal(saved.segmentComplete, true); assert.equal(saved.completedSegments, 1); assert.equal(saved.savedBytes, SEGMENT);
    assert.equal(store.state.digests[0], reference.segments[0]);
    const incomplete = await sender.loadSegment(1);
    await collector.accept(incomplete.manifestFrame()); await collector.accept(incomplete.frame(0));
    assert.ok(collector.state.pendingBytes > 0); const previousInner = f.WGLarge.parseFrame(incomplete.manifestFrame()).innerId;
    collector.dispose(); await store.dispose(); sender.dispose();
    resumedSender = await f.WGLarge.createSender(input.source, { chunkBytes: 384 });
    assert.equal(resumedSender.id, reference.root, 'Chunk density must not change the persistent file identity');
    store = await f.openStore(); resumedCollector = f.WGLarge.createCollector({ store });
    await resumedCollector.resume();
    assert.equal(resumedCollector.state.completedSegments, 1); assert.equal(resumedCollector.state.pendingBytes, 0);
    assert.deepEqual(resumedSender.acceptFeedback(resumedCollector.createFeedback()).missingSegments, [1]);
    const next = await resumedSender.loadSegment(1);
    assert.notEqual(f.WGLarge.parseFrame(next.manifestFrame()).innerId, previousInner);
    const result = await sendSegment(resumedCollector, next);
    assert.equal(result.kind, 'complete'); assert.equal(result.completedSegments, 2);
    assert.equal(await hashFile(result.file), reference.full); assert.equal(result.file.size, original.length);
    resumedCollector.dispose(); await store.dispose();
    const reopened = await f.openStore(); const restored = f.WGLarge.createCollector({ store: reopened });
    const complete = await restored.resume();
    assert.equal(complete.kind, 'complete'); assert.ok(complete.file); assert.equal(complete.bytes, undefined);
    assert.equal(resumedSender.acceptFeedback(restored.createFeedback()).complete, true); restored.dispose();
    assert.equal(input.audit.fullReads, 0); assert.equal(input.audit.maxActive, 1);
    assert.ok(input.audit.reads.every(read => read.bytes <= SEGMENT));
  } finally { gate?.release(); collector?.dispose(); resumedCollector?.dispose(); sender?.dispose(); resumedSender?.dispose(); await f.close(); }
});

test('reset during a segment write cannot publish a stale complete result or a final success ACK', async () => {
  const f = await fixture(); let sender, collector, gate;
  try {
    sender = await f.WGLarge.createSender(new File([patterned(900)], 'reset.bin'), { chunkBytes: 600 });
    const segment = await sender.loadSegment(0), store = await f.openStore(); collector = f.WGLarge.createCollector({ store });
    await sendSegment(collector, segment, segment.total - 1);
    gate = deferClose(f.backend, 'segment-000.bin');
    const pending = acceptOwned(collector, segment.frame(segment.total - 1));
    const cancelled = assert.rejects(pending, { code: 'TRANSFER_RESET' });
    await gate.entered; collector.reset(); gate.release(); await cancelled;
    assert.equal(collector.state.complete, false); assert.equal(store.state.complete, false);
    assert.equal(sender.acceptFeedback(collector.createFeedback()).complete, false);
    assert.equal(f.backend.audit.closes.some(close => close.path.endsWith('received.zip')), false);
    const resumed = await collector.resume();
    assert.equal(resumed.kind, 'complete'); assert.ok(resumed.file); assert.equal(sender.acceptFeedback(collector.createFeedback()).complete, true);
  } finally { gate?.release(); collector?.dispose(); sender?.dispose(); await f.close(); }
});

test('segment or final-file storage failure never becomes a success ACK and remains retryable', async t => {
  for (const suffix of ['segment-000.bin', 'received.zip']) await t.test(suffix, async () => {
    const f = await fixture(); let sender, collector;
    try {
      const original = patterned(1300);
      sender = await f.WGLarge.createSender(new File([original], 'quota.bin'), { chunkBytes: 600 });
      const segment = await sender.loadSegment(0), store = await f.openStore(); collector = f.WGLarge.createCollector({ store });
      await sendSegment(collector, segment, segment.total - 1);
      f.backend.faults.before = event => { if (event.op === 'close' && event.path.endsWith(suffix)) throw new DOMException('Full', 'QuotaExceededError'); };
      await assert.rejects(acceptOwned(collector, segment.frame(segment.total - 1)), { code: 'STORE_QUOTA' });
      assert.equal(collector.state.complete, false); assert.equal(store.state.complete, false);
      const feedback = sender.acceptFeedback(collector.createFeedback()); assert.equal(feedback.complete, false);
      assert.deepEqual(feedback.missingSegments, suffix === 'received.zip' ? [] : [0]);
      f.backend.faults.before = undefined;
      const retried = await collector.accept(segment.frame(segment.total - 1));
      assert.equal(retried.kind, 'complete'); assert.equal(await hashFile(retried.file), createHash('sha256').update(original).digest('hex'));
    } finally { collector?.dispose(); sender?.dispose(); await f.close(); }
  });
});

test('individually valid segments cannot complete a transfer whose ordered root is wrong', async () => {
  const f = await fixture(); let sender, collector;
  try {
    sender = await f.WGLarge.createSender(new File([patterned(90)], 'wrong-root.bin'), { chunkBytes: 600 });
    const segment = await sender.loadSegment(0), store = await f.openStore(); collector = f.WGLarge.createCollector({ store });
    const forge = bytes => { bytes[12] ^= 1; new DataView(bytes.buffer).setUint32(bytes.length - 4, zlib.crc32(bytes.subarray(0, -4))); return bytes; };
    await collector.accept(forge(segment.manifestFrame()));
    await assert.rejects(collector.accept(forge(segment.frame(0))), { code: 'ROOT_MISMATCH' });
    assert.equal(store.state.completed[0], true); assert.equal(store.state.complete, false); assert.equal(collector.state.complete, false);
    assert.equal(f.WGLarge.parseFeedback(collector.createFeedback()).complete, false);
    assert.equal(f.backend.audit.closes.some(close => close.path.endsWith('received.zip')), false);
  } finally { collector?.dispose(); sender?.dispose(); await f.close(); }
});

// A real ZIP with one STORED entry and a correct CRC. Construction and validation
// use bounded buffers; neither the source nor final 200 MiB file becomes a Blob.
async function writeStoredZip(path, size) {
  const name = Buffer.from('payload.bin'), local = Buffer.alloc(30 + name.length), central = Buffer.alloc(46 + name.length), end = Buffer.alloc(22);
  const payloadBytes = size - local.length - central.length - end.length;
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x21, 12);
  local.writeUInt32LE(payloadBytes, 18); local.writeUInt32LE(payloadBytes, 22); local.writeUInt16LE(name.length, 26); name.copy(local, 30);
  const file = await open(path, 'wx'); let checksum = 0;
  try {
    await file.write(local, 0, local.length, 0);
    const buffer = Buffer.alloc(1024 * 1024);
    for (let offset = 0; offset < payloadBytes; offset += buffer.length) {
      const part = buffer.subarray(0, Math.min(buffer.length, payloadBytes - offset)); randomFillSync(part);
      checksum = zlib.crc32(part, checksum);
      let written = 0;
      while (written < part.length) written += (await file.write(part, written, part.length - written, local.length + offset + written)).bytesWritten;
    }
    buffer.fill(0); local.writeUInt32LE(checksum, 14); await file.write(local, 0, local.length, 0);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(checksum, 16); central.writeUInt32LE(payloadBytes, 20); central.writeUInt32LE(payloadBytes, 24);
    central.writeUInt16LE(name.length, 28); name.copy(central, 46);
    const centralOffset = local.length + payloadBytes;
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
    end.writeUInt32LE(central.length, 12); end.writeUInt32LE(centralOffset, 16);
    await file.write(central, 0, central.length, centralOffset); await file.write(end, 0, end.length, centralOffset + central.length);
    await file.sync();
  } finally { await file.close(); }
  return { checksum, payloadBytes };
}

test('200 MiB ZIP crosses the complete QR packet pipeline with bounded reads and an independently verified final digest',
  { skip: process.env.WGQR_FULL_SIZE_TEST !== '1', timeout: 600000 }, async t => {
    const f = await fixture(); let sender, collector;
    const started = performance.now();
    try {
      const path = join(f.directory, 'bulk-200MiB.zip');
      const zip = await writeStoredZip(path, FULL_SIZE), raw = await openDiskFile(path);
      assert.equal(raw.size, FULL_SIZE);
      const expected = await references(raw), input = boundedFile(raw);
      sender = await f.WGLarge.createSender(input.source, { chunkBytes: 600 });
      assert.equal(sender.descriptor.id, expected.root); assert.equal(sender.segmentCount, 100);
      const store = await f.openStore(); collector = f.WGLarge.createCollector({ store });
      let result, previous, packets = 0;
      for (let index = 0; index < sender.segmentCount; index++) {
        const segment = await sender.loadSegment(index);
        if (previous) assert.throws(() => previous.frame(0), { code: 'TRANSFER_DISPOSED' });
        assert.equal(segment.digest, expected.segments[index]);
        result = await sendSegment(collector, segment); packets += segment.total + Math.ceil(segment.total / 16);
        assert.equal(result.completedSegments, index + 1); assert.equal(store.state.digests[index], expected.segments[index]);
        assert.equal(result.savedBytes, (index + 1) * SEGMENT);
        if (index < 99) assert.equal(result.complete, false);
        previous = segment;
        if ((index + 1) % 25 === 0) console.log(`Large pipeline: ${(index + 1) * 2} MiB committed, ${packets} packets, ${((performance.now() - started) / 1000).toFixed(1)} s`);
      }
      assert.equal(result.kind, 'complete'); assert.equal(result.file.size, FULL_SIZE); assert.equal(result.bytes, undefined);
      assert.equal(await hashFile(result.file), expected.full);
      assert.equal(sender.acceptFeedback(collector.createFeedback({ suggestedRate: 20 })).complete, true);
      const header = Buffer.from(await result.file.slice(0, 30).arrayBuffer());
      assert.equal(header.readUInt32LE(0), 0x04034b50); assert.equal(header.readUInt32LE(14), zip.checksum);
      assert.equal(header.readUInt32LE(22), zip.payloadBytes);
      const footer = Buffer.from(await result.file.slice(FULL_SIZE - 22, FULL_SIZE).arrayBuffer());
      assert.equal(footer.readUInt32LE(0), 0x06054b50); assert.equal(footer.readUInt16LE(10), 1);
      assert.equal(input.audit.fullReads, 0); assert.equal(input.audit.maxActive, 1);
      assert.equal(input.audit.reads.length, 200, 'Hashing and playback each read exactly one segment at a time');
      assert.ok(input.audit.reads.every(read => read.bytes <= SEGMENT));
      assert.ok(f.backend.audit.reads.every(read => read.bytes <= SEGMENT));
      assert.ok(f.backend.audit.writes.every(write => write.bytes <= 256 * 1024));
      t.diagnostic(`Verified ${FULL_SIZE} bytes, ${packets} optical packets; SHA-256 ${expected.full}; bounded source reads ${input.audit.reads.length}.`);
    } finally { collector?.dispose(); sender?.dispose(); await f.close(); }
  });
