import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const source = await readFile(new URL('../../assets/qr-resilient.js', import.meta.url), 'utf8');
const legacySource = await readFile(new URL('../../assets/qr-transfer.js', import.meta.url), 'utf8');
const coreSource = await readFile(new URL('../../assets/qr-core.js', import.meta.url), 'utf8');
const utf8 = value => new TextEncoder().encode(value);
const pattern = length => Uint8Array.from({ length }, (_, index) => (index * 73 + Math.floor(index / 256)) % 256);
const assertBytes = (actual, expected) => assert.deepEqual(Buffer.from(actual), Buffer.from(expected));
function runtime(crypto = webcrypto, globals = {}) {
  const browser = createContext({ TextEncoder, TextDecoder, crypto, ...globals }, { codeGeneration: { strings: false, wasm: false } });
  runInContext(legacySource, browser, { timeout: 3000 });
  runInContext(source, browser, { timeout: 3000 });
  return { browser, legacy: browser.WGTransfer, ...browser.WGResilient };
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
function edit(frame, change, repair = true) {
  const copy = new Uint8Array(frame);
  const view = new DataView(copy.buffer);
  change(copy, view);
  if (repair) view.setUint32(copy.length - 4, crc(copy.subarray(0, -4)));
  return copy;
}
function shuffle(items, seed = 67) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const other = seed % (index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
async function repairUntilComplete(transfer, collector, blocks = Array.from({ length: transfer.blockCount }, (_, index) => index), limit = 256) {
  let result;
  for (const block of blocks) {
    for (let serial = 0; serial < limit; serial++) {
      result = await collector.accept(transfer.repairFrame(block, serial));
      assert.ok(result.received <= result.total);
      assert.ok(result.recovered <= result.received);
      if (result.kind === 'complete') return result;
      if (!transfer.acceptFeedback(collector.createFeedback({ suggestedRate: 2 })).missingBlocks.includes(block)) break;
      if (serial === limit - 1) assert.fail(`Repair generation ${block} failed to reach full rank`);
    }
  }
  return result;
}

test('bounded v2 API has lazy owned frames, fixed dimensions, independent CRC and correct SHA-256', async () => {
  assert.equal(api.MAX_FILE_BYTES, 10 * 1024 * 1024);
  assert.equal(api.DEFAULT_CHUNK_BYTES, 384);
  assert.equal(api.BLOCK_CHUNKS, 32);
  assert.deepEqual([...api.SUPPORTED_CHUNK_BYTES], [384, 600]);
  for (const name of ['fetch', 'XMLHttpRequest', 'Worker', 'WebSocket', 'localStorage']) assert.equal(typeof api.browser[name], 'undefined');
  assert.doesNotMatch(source, /\b(?:fetch|importScripts)\s*\(|\bnew\s+(?:Worker|WebSocket|Function)\b/);
  const bytes = pattern(384 * 33 + 7);
  const file = await api.createTransfer(bytes, '../Zażółć 🔑.conf');
  assert.equal(file.version, 2);
  assert.equal(file.name, 'Zażółć 🔑.conf');
  assert.equal(file.total, 34);
  assert.equal(file.blockCount, 2);
  assert.equal(file.frames, undefined);
  assert.equal(file.digest, createHash('sha256').update(bytes).digest('hex'));
  const frame = file.frame(31);
  const view = new DataView(frame.buffer);
  assert.equal(Buffer.from(frame.subarray(0, 8)).toString(), 'WGQR-XFR');
  assert.equal(frame[8], 2);
  assert.equal(view.getUint32(36), 0x80000000);
  assert.equal(view.getUint32(frame.length - 4), crc(frame.subarray(0, -4)));
  assert.ok(frame.length <= 588);
  const duplicate = file.frame(31);
  assert.notEqual(frame.buffer, duplicate.buffer);
  assertBytes(frame, duplicate);
  frame.fill(0);
  assertBytes(file.frame(31), duplicate);
  assertBytes(file.repairFrame(1, 56), file.repairFrame(1, 56));
  const another = await api.createTransfer(bytes, file.name);
  assert.notEqual(another.id, file.id);
});

test('systematic chunks preserve arbitrary bytes, final padding and both supported chunk sizes', async () => {
  for (const chunkBytes of [384, 600]) {
    for (const length of [1, chunkBytes - 1, chunkBytes, chunkBytes + 1, chunkBytes * 32, chunkBytes * 32 + 1]) {
      const bytes = pattern(length);
      const file = await api.createTransfer(bytes, 'plik.bin', { chunkBytes });
      const collector = api.createCollector();
      let result;
      for (let index = file.total - 1; index >= 0; index--) result = await collector.accept(file.frame(index));
      assert.equal(result.kind, 'complete');
      assert.equal(result.received, file.total);
      assert.equal(result.recovered, file.total);
      assert.equal(result.blocksComplete, file.blockCount);
      assert.equal(result.missingCount, 0);
      assertBytes(result.bytes, bytes);
    }
  }
});

test('repair-only reception works for K1, K2, K3, K31, K32 and multiple generations', async () => {
  for (const count of [1, 2, 3, 31, 32, 33, 65]) {
    const bytes = pattern(384 * count - 19);
    const file = await api.createTransfer(bytes, 'same-repairs.bin');
    const collector = api.createCollector();
    const result = await repairUntilComplete(file, collector);
    assert.equal(result.kind, 'complete');
    assertBytes(result.bytes, bytes);
  }
});

test('an independently formed dense triangular equation basis recovers bit31 and a full block', async () => {
  const bytes = pattern(32 * 384 - 37);
  const file = await api.createTransfer(bytes, 'basis.bin');
  const collector = api.createCollector();
  let result;
  for (let count = 32; count >= 1; count--) {
    const mask = count === 32 ? 0xffffffff : (2 ** count - 1) >>> 0;
    const frame = edit(file.frame(0), (encoded, view) => {
      view.setUint32(36, mask);
      const start = view.getUint16(10);
      encoded.fill(0, start, encoded.length - 4);
      for (let local = 0; local < count; local++) {
        for (let byte = 0; byte < 384; byte++) encoded[start + byte] ^= bytes[local * 384 + byte] || 0;
      }
    });
    result = await collector.accept(frame);
  }
  assert.equal(result.kind, 'complete');
  assertBytes(result.bytes, bytes);
});

test('more than half the originals may be lost with shuffled, duplicated and partly lost repairs', async () => {
  for (let trial = 0; trial < 5; trial++) {
    const bytes = pattern(384 * (90 + trial) - 17);
    const file = await api.createTransfer(bytes, 'loss.bin');
    const collector = api.createCollector();
    const packets = [];
    for (let index = 0; index < file.total; index++) if ((index + trial) % 3 === 0) packets.push(file.frame(index));
    for (let block = 0; block < file.blockCount; block++) {
      for (let serial = 0; serial < 128; serial++) if ((serial + trial) % 2 === 0) packets.push(file.repairFrame(block, serial));
    }
    packets.push(packets[0], packets[3], packets[0]);
    let result;
    for (const frame of shuffle(packets, trial + 10)) {
      result = await collector.accept(frame);
      assert.ok(result.received <= result.total);
      if (result.kind === 'complete') break;
    }
    assert.equal(result.kind, 'complete');
    assertBytes(result.bytes, bytes);
  }
});

test('rank, recovered chunks and bounded missing blocks are independent of duplicate traffic', async () => {
  const file = await api.createTransfer(pattern(384 * 32 * 23 + 2), 'progress.bin');
  const collector = api.createCollector();
  const first = await collector.accept(file.frame(0));
  assert.equal(first.received, 1);
  assert.equal(first.recovered, 0);
  assert.equal(first.blocksComplete, 0);
  assert.equal(first.missingCount, 24);
  assert.equal(first.missing.length, 18);
  const duplicate = await collector.accept(file.frame(0));
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.received, 1);
  for (let index = 1; index < 32; index++) await collector.accept(file.frame(index));
  assert.equal(collector.state.received, 32);
  assert.equal(collector.state.recovered, 32);
  assert.equal(collector.state.blocksComplete, 1);
  const ignored = await collector.accept(file.repairFrame(0, 100));
  assert.equal(ignored.duplicate, true);
  assert.equal(ignored.received, 32);
  const state = collector.state;
  state.missing.length = 0;
  state.received = 500000;
  assert.equal(collector.state.missing.length, 18);
  assert.equal(collector.state.received, 32);
});

test('strict frame bounds reject forged masks, dimensions, names and oversized declarations before allocation', async () => {
  const file = await api.createTransfer(pattern(384 + 7), 'ok.bin');
  const frame = file.frame(0);
  for (const [change, code] of [
    [(bytes) => { bytes[9] = 1; }, 'MALFORMED_FRAME'],
    [(_, view) => view.setUint16(10, 1), 'MALFORMED_FRAME'],
    [(_, view) => view.setUint32(28, 0), 'MALFORMED_FRAME'],
    [(_, view) => view.setUint32(28, api.MAX_FILE_BYTES + 1), 'FILE_TOO_LARGE'],
    [(_, view) => view.setUint32(28, 0xffffffff), 'FILE_TOO_LARGE'],
    [(_, view) => view.setUint16(32, 512), 'MALFORMED_FRAME'],
    [(_, view) => view.setUint16(34, 65535), 'MALFORMED_FRAME'],
    [(_, view) => view.setUint32(36, 0), 'MALFORMED_FRAME'],
    [(_, view) => view.setUint32(36, 4), 'MALFORMED_FRAME'],
    [(_, view) => view.setUint16(44, 65535), 'MALFORMED_FRAME'],
    [(_, view) => view.setUint16(46, 32), 'MALFORMED_FRAME'],
    [(bytes) => { bytes[80] = 0xff; }, 'MALFORMED_FRAME'],
    [(bytes) => { bytes[80] = 47; }, 'MALFORMED_FRAME'],
    [(bytes) => { bytes[8] = 99; }, 'UNSUPPORTED_VERSION']
  ]) {
    const collector = api.createCollector();
    await assert.rejects(collector.accept(edit(frame, change)), { code });
    assert.equal(collector.state, null);
  }
  for (const truncated of [utf8('WGQR-XFR'), frame.subarray(0, 20), frame.subarray(0, frame.length - 1)]) {
    const collector = api.createCollector();
    await assert.rejects(collector.accept(truncated), { code: 'MALFORMED_FRAME' });
    assert.equal(collector.state, null);
  }
});

test('corruption and inconsistent dependent equations do not destroy accepted progress', async () => {
  const file = await api.createTransfer(pattern(384 * 3), 'conflict.bin');
  const collector = api.createCollector();
  await collector.accept(file.frame(0));
  const changePayload = (bytes, view) => { bytes[view.getUint16(10)] ^= 128; };
  await assert.rejects(collector.accept(edit(file.frame(1), changePayload, false)), { code: 'CRC_MISMATCH' });
  await assert.rejects(collector.accept(edit(file.frame(0), changePayload)), { code: 'CHUNK_CONFLICT' });
  assert.equal(collector.state.received, 1);
  await collector.accept(file.frame(1));
  const completed = await collector.accept(file.frame(2));
  assertBytes(completed.bytes, pattern(384 * 3));
});

test('foreign sessions and v1/v2 cannot mix, even when their identifiers are forged equal', async () => {
  const bytes = pattern(384 * 3);
  const one = await api.createTransfer(bytes, 'one.bin');
  const two = await api.createTransfer(bytes, 'two.bin');
  const old = await api.legacy.createTransfer(bytes, 'old.bin');
  const collector = api.createCollector();
  await collector.accept(one.frame(0));
  assert.equal((await collector.accept(two.frame(0))).kind, 'foreign');
  assert.equal((await collector.accept(old.frames[0])).kind, 'foreign');
  const forgedOld = edit(old.frames[0], value => value.set(Buffer.from(one.id, 'hex'), 12));
  assert.equal((await collector.accept(forgedOld)).kind, 'foreign');
  await assert.rejects(collector.accept(edit(one.frame(1), value => { value[48] ^= 1; })), { code: 'METADATA_CONFLICT' });
  assert.equal(collector.state.id, one.id);
  assert.equal(collector.state.received, 1);
  collector.reset();
  await collector.accept(old.frames[0]);
  assert.equal((await collector.accept(one.frame(0))).kind, 'foreign');
  assert.equal(collector.state.version, 1);
});

test('wrong whole-file digest and nonzero final padding invalidate the incomplete file', async () => {
  const file = await api.createTransfer(pattern(385), 'digest.bin');
  const collector = api.createCollector();
  const changeHash = bytes => { bytes[48] ^= 1; };
  await collector.accept(edit(file.frame(0), changeHash));
  await assert.rejects(collector.accept(edit(file.frame(1), changeHash)), { code: 'DIGEST_MISMATCH' });
  assert.equal(collector.state, null);
  await collector.accept(file.frame(0));
  await assert.rejects(collector.accept(edit(file.frame(1), (bytes, view) => { bytes[view.getUint16(10) + 1] = 1; })), { code: 'DIGEST_MISMATCH' });
  assert.equal(collector.state, null);
});

test('reset during digest wipes owned contents and cannot resurrect the prior session', async () => {
  const file = await api.createTransfer(pattern(385), 'old.bin');
  const next = await api.createTransfer(pattern(800), 'new.bin');
  let release;
  let hashingInput;
  const gated = runtime({
    getRandomValues: bytes => webcrypto.getRandomValues(bytes),
    subtle: { digest: (algorithm, bytes) => {
      hashingInput = bytes;
      const copy = new Uint8Array(bytes);
      return new Promise(resolve => { release = async () => resolve(await webcrypto.subtle.digest(algorithm, copy)); });
    } }
  });
  const collector = gated.createCollector();
  await collector.accept(file.frame(0));
  const pending = collector.accept(file.frame(1));
  const rejects = assert.rejects(pending, { code: 'TRANSFER_RESET' });
  assert.equal(collector.state.received, 2);
  assert.equal(collector.state.complete, false);
  assert.equal(file.acceptFeedback(collector.createFeedback()).complete, false);
  collector.reset();
  assert.ok(hashingInput.every(byte => byte === 0));
  assert.equal(collector.state, null);
  await collector.accept(next.frame(0));
  await release();
  await rejects;
  assert.equal(collector.state.id, next.id);
  assert.equal(collector.state.received, 1);
});

test('reset/dispose wipe retained equation rows and sender-owned plaintext', async () => {
  const owned = [];
  class TrackedBytes extends Uint8Array {
    constructor(...args) { super(...args); owned.push(this); }
  }
  const tracked = runtime(webcrypto, { Uint8Array: TrackedBytes });
  const file = await api.createTransfer(pattern(1200), 'rows.bin');
  const collector = tracked.createCollector();
  const start = owned.length;
  await collector.accept(file.repairFrame(0, 12));
  collector.dispose();
  const sensitive = owned.slice(start).filter(bytes => bytes.length >= 384);
  assert.ok(sensitive.length >= 2);
  for (const bytes of sensitive) assert.ok(bytes.every(byte => byte === 0));
  const original = pattern(1307);
  const first = owned.length;
  const sender = await tracked.createTransfer(original, 'dispose.bin');
  const content = owned.slice(first).find(bytes => bytes.length === original.length);
  assert.ok(content);
  sender.dispose();
  sender.dispose();
  assert.ok(content.every(byte => byte === 0));
  assertBytes(original, pattern(1307));
  assert.throws(() => sender.frame(0), { code: 'TRANSFER_DISPOSED' });
  assert.throws(() => sender.repairFrame(0, 0), { code: 'TRANSFER_DISPOSED' });
  assert.throws(() => sender.acceptFeedback(new Uint8Array()), { code: 'TRANSFER_DISPOSED' });
});

test('concurrent completion duplicates share digest work and transient crypto failure can retry', async () => {
  const file = await api.createTransfer(pattern(385), 'retry.bin');
  let hashes = 0;
  const counted = runtime({
    getRandomValues: bytes => webcrypto.getRandomValues(bytes),
    subtle: { digest: (...args) => { hashes++; return webcrypto.subtle.digest(...args); } }
  }).createCollector();
  await counted.accept(file.frame(0));
  const [left, right] = await Promise.all([counted.accept(file.frame(1)), counted.accept(file.frame(1))]);
  assert.equal(hashes, 1);
  assertBytes(left.bytes, right.bytes);
  let failures = 1;
  const retried = runtime({
    getRandomValues: bytes => webcrypto.getRandomValues(bytes),
    subtle: { digest: (...args) => failures-- > 0 ? Promise.reject(new Error('temporary')) : webcrypto.subtle.digest(...args) }
  }).createCollector();
  await retried.accept(file.frame(0));
  await assert.rejects(retried.accept(file.frame(1)), /temporary/);
  assert.equal(retried.state.complete, false);
  assert.equal(retried.state.recovered, 2);
  const completed = await retried.accept(file.repairFrame(0, 6));
  assertBytes(completed.bytes, pattern(385));
});

test('legacy v1 and ordinary raw configuration/binary QR remain byte-preserving', async () => {
  for (const bytes of [utf8('[Interface]\r\n# Zażółć 🔑\r\n  \r\n'), pattern(255), utf8('WGQR-AC')]) {
    const result = await api.createCollector().accept(bytes);
    assert.equal(result.kind, 'plain');
    assertBytes(result.bytes, bytes);
  }
  const frozen = Buffer.from('V0dRUi1YRlIBAABSlEBocNGfZgKXB1k4IpoYFwAAACAAAAABAlgACgAAeTD+ii78v0LLvsVpa5XdIPvqRPznTjsOGhRooGk2c3RhcnkuY29uZltJbnRlcmZhY2VdDQojIFphxbzDs8WCxIcg8J+UkQ0KI6GTEw==', 'base64');
  const complete = await api.createCollector().accept(frozen);
  assert.equal(complete.kind, 'complete');
  assert.equal(complete.version, 1);
  assert.equal(complete.name, 'stary.conf');
  const bytes = pattern(600 * 35 + 2);
  const old = await api.legacy.createTransfer(bytes, 'legacy.bin');
  const collector = api.createCollector();
  let result;
  for (const frame of shuffle(old.frames)) result = await collector.accept(frame);
  assert.equal(result.kind, 'complete');
  assert.equal(result.blocksComplete, 2);
  assert.equal(result.recovered, old.total);
  assertBytes(result.bytes, bytes);
  collector.reset();
  const bad = old.frames.map(frame => edit(frame, value => { value[40] ^= 1; }));
  for (const frame of bad.slice(0, -1)) await collector.accept(frame);
  await assert.rejects(collector.accept(bad.at(-1)), { code: 'DIGEST_MISMATCH' });
  assert.equal(collector.state, null);
});

test('feedback contains completed blocks, guides selective repair, and confirms only verified completion', async () => {
  const bytes = pattern(384 * 97 - 2);
  const file = await api.createTransfer(bytes, 'feedback.bin');
  const collector = api.createCollector();
  for (let index = 0; index < 96; index++) if (Math.floor(index / 32) % 2 === 0) await collector.accept(file.frame(index));
  const ack = collector.createFeedback({ suggestedRate: 5 });
  assert.equal(Buffer.from(ack.subarray(0, 8)).toString(), 'WGQR-ACK');
  assert.ok(ack.length <= 187);
  assert.equal(new DataView(ack.buffer).getUint32(ack.length - 4), crc(ack.subarray(0, -4)));
  const feedback = file.acceptFeedback(ack);
  assert.deepEqual([...feedback.missingBlocks], [1, 3]);
  assert.equal(feedback.complete, false);
  assert.equal(feedback.suggestedRate, 5);
  const complete = await repairUntilComplete(file, collector, feedback.missingBlocks);
  assertBytes(complete.bytes, bytes);
  const done = file.acceptFeedback(collector.createFeedback({ suggestedRate: 1 }));
  assert.equal(done.complete, true);
  assert.deepEqual([...done.missingBlocks], []);
  assert.equal(done.suggestedRate, 1);
  const detached = collector.createFeedback();
  detached.fill(0);
  assert.equal(file.acceptFeedback(collector.createFeedback()).complete, true);
});

test('ACK must match identity/hash/dimensions and rejects malformed or contradictory flags/bitmaps', async () => {
  const file = await api.createTransfer(pattern(384 * 40), 'ack.bin');
  const other = await api.createTransfer(pattern(384 * 40), 'ack.bin');
  const collector = api.createCollector();
  await collector.accept(file.frame(0));
  const ack = collector.createFeedback();
  assert.throws(() => other.acceptFeedback(ack), { code: 'FEEDBACK_SESSION_MISMATCH' });
  for (const change of [bytes => { bytes[12] ^= 1; }, bytes => { bytes[40] ^= 1; }, (_, view) => view.setUint32(28, file.size - 1)]) {
    assert.throws(() => file.acceptFeedback(edit(ack, change)), { code: 'FEEDBACK_SESSION_MISMATCH' });
  }
  for (const change of [
    bytes => { bytes[8] = 2; }, bytes => { bytes[9] = 3; }, bytes => { bytes[10] = 2; },
    bytes => { bytes[10] = 1; }, bytes => { bytes[11] = 3; }, bytes => { bytes[76] = 128; },
    (_, view) => view.setUint16(72, 65535), (_, view) => view.setUint16(74, 1),
    (_, view) => view.setUint32(28, 0xffffffff), (_, view) => view.setUint32(36, 65535)
  ]) assert.throws(() => file.acceptFeedback(edit(ack, change)), { code: 'MALFORMED_FEEDBACK' });
  assert.throws(() => file.acceptFeedback(edit(ack, bytes => { bytes[40] ^= 1; }, false)), { code: 'CRC_MISMATCH' });
  assert.throws(() => file.acceptFeedback(ack.subarray(0, -1)), { code: 'MALFORMED_FEEDBACK' });
  await assert.rejects(collector.accept(ack), { code: 'FEEDBACK_FRAME' });
  await assert.rejects(api.createCollector().accept(utf8('WGQR-ACKgarbage')), { code: 'FEEDBACK_FRAME' });
  assert.ok(api.isReserved(ack));
  assert.ok(api.isReserved(file.frame(0)));
  assert.equal(api.isReserved(utf8('normal')), false);
  assert.equal(collector.state.received, 1);
});

test('invalid inputs and callback-free disposal have explicit bounds without new dependencies', async () => {
  await assert.rejects(api.createTransfer(new Uint8Array(), 'empty'), { code: 'EMPTY_INPUT' });
  await assert.rejects(api.createTransfer(new Uint8Array(api.MAX_FILE_BYTES + 1), 'big'), { code: 'FILE_TOO_LARGE' });
  await assert.rejects(api.createTransfer('text', 'bad'), { code: 'INVALID_INPUT' });
  await assert.rejects(api.createTransfer(utf8('x'), 'x', { chunkBytes: 1 }), { code: 'INVALID_INPUT' });
  await assert.rejects(api.createTransfer(utf8('x'), 'x', null), { code: 'INVALID_INPUT' });
  await assert.rejects(runtime(null).createTransfer(utf8('x'), 'x'), { code: 'CRYPTO_UNAVAILABLE' });
  const collector = api.createCollector();
  assert.throws(() => collector.createFeedback(), { code: 'NO_TRANSFER' });
  await assert.rejects(collector.accept(new Uint8ClampedArray(10)), { code: 'INVALID_INPUT' });
  const file = await api.createTransfer(pattern(1000), 'safe.bin');
  for (const value of [-1, 3, 1.5, NaN, Infinity]) assert.throws(() => file.frame(value), { code: 'INVALID_INPUT' });
  for (const value of [-1, 1, 1.5, NaN]) assert.throws(() => file.repairFrame(value, 0), { code: 'INVALID_INPUT' });
  for (const value of [-1, 0x100000000, 1.5]) assert.throws(() => file.repairFrame(0, value), { code: 'INVALID_INPUT' });
  await collector.accept(file.frame(0));
  assert.throws(() => collector.createFeedback({ suggestedRate: 3 }), { code: 'INVALID_INPUT' });
  assert.throws(() => collector.createFeedback(null), { code: 'INVALID_INPUT' });
});

test('the exact 10 MiB boundary reconstructs with 27307 chunks/854 blocks and bounded feedback', async context => {
  const bytes = pattern(api.MAX_FILE_BYTES);
  const started = performance.now();
  const file = await api.createTransfer(bytes, 'maximum.bin');
  assert.equal(file.total, 27307);
  assert.equal(file.blockCount, 854);
  assert.equal(file.frames, undefined);
  const collector = api.createCollector();
  let result;
  for (let index = file.total - 1; index >= 0; index--) {
    result = await collector.accept(file.frame(index));
    if (index === file.total - 1) {
      assert.ok(result.missing.length <= 18);
      const ack = collector.createFeedback();
      assert.equal(ack.length, 187);
      assert.equal(file.acceptFeedback(ack).missingBlocks.length, 854);
    }
  }
  assert.equal(result.kind, 'complete');
  assert.equal(result.received, 27307);
  assert.equal(result.blocksComplete, 854);
  assertBytes(result.bytes, bytes);
  context.diagnostic(`10 MiB systematic encode+collect: ${(performance.now() - started).toFixed(1)} ms.`);
  file.dispose();
  collector.dispose();
});

test('binary v2/v3 repair, manifests and ACK survive QR matrix → PNG → jsQR without text conversion', async () => {
  runInContext(coreSource, api.browser, { timeout: 3000 });
  const { encodeBytes, decodePixels } = api.browser.WGQR;
  function throughQr(bytes) {
    const qr = encodeBytes(bytes);
    const scale = 5;
    const side = (qr.size + 8) * scale;
    const png = new PNG({ width: side, height: side });
    png.data.fill(255);
    for (let row = 0; row < qr.size; row++) {
      for (let column = 0; column < qr.size; column++) {
        if (!qr.data[row * qr.size + column]) continue;
        for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) {
          const offset = (((row + 4) * scale + y) * side + (column + 4) * scale + x) * 4;
          png.data[offset] = png.data[offset + 1] = png.data[offset + 2] = 0;
        }
      }
    }
    const reopened = PNG.sync.read(PNG.sync.write(png));
    const decoded = decodePixels(new Uint8ClampedArray(reopened.data), side, side);
    assert.ok(decoded);
    assertBytes(decoded.bytes, bytes);
    return decoded.bytes;
  }
  const original = Uint8Array.from([0xef, 0xbb, 0xbf, ...utf8('[Interface]\r\n# Zażółć 🔑\r\n'), ...pattern(900)]);
  for (const compact of [false, true]) {
    const file = await api.createTransfer(original, 'real.conf', { compact });
    const collector = api.createCollector();
    if (compact) assert.equal((await collector.accept(throughQr(file.manifestFrame()))).kind, 'manifest');
    let result;
    for (let serial = 0; serial < 40; serial++) {
      result = await collector.accept(throughQr(file.repairFrame(0, serial)));
      if (result.kind === 'complete') break;
    }
    assert.equal(result.kind, 'complete');
    assertBytes(result.bytes, original);
    assert.equal(file.acceptFeedback(throughQr(collector.createFeedback({ suggestedRate: 2 }))).complete, true);
  }
});

test('compact v3 has an independently specified binary layout and smaller data symbols', async () => {
  const deterministic = runtime({
    getRandomValues: bytes => { for (let index = 0; index < bytes.length; index++) bytes[index] = index; return bytes; },
    subtle: webcrypto.subtle
  });
  const bytes = pattern(17);
  for (const chunkBytes of [384, 600]) {
    const file = await deterministic.createTransfer(bytes, 'a.bin', { compact: true, chunkBytes });
    assert.equal(file.version, 3);
    assert.equal(file.manifestInterval, 16);
    const expected = Buffer.alloc(36 + chunkBytes + 4);
    expected.write('WGQR-XFR');
    expected[8] = 3;
    expected.writeUInt16BE(36, 10);
    for (let index = 0; index < 16; index++) expected[12 + index] = index;
    expected.writeUInt32BE(1, 30);
    expected.writeUInt16BE(1, 34);
    expected.set(bytes, 36);
    expected.writeUInt32BE(crc(expected.subarray(0, -4)), expected.length - 4);
    assertBytes(file.frame(0), expected);
    assert.equal(file.frame(0).length, chunkBytes + 40);
    const manifest = Buffer.alloc(85);
    manifest.write('WGQR-XFR');
    manifest[8] = 3;
    manifest[9] = 1;
    manifest.writeUInt16BE(81, 10);
    for (let index = 0; index < 16; index++) manifest[12 + index] = index;
    manifest.writeUInt32BE(bytes.length, 28);
    manifest.writeUInt16BE(chunkBytes, 32);
    manifest.writeUInt16BE(1, 34);
    manifest.writeUInt32BE(1, 36);
    manifest.writeUInt16BE(5, 40);
    manifest.set(createHash('sha256').update(bytes).digest(), 44);
    manifest.write('a.bin', 76);
    manifest.writeUInt32BE(crc(manifest.subarray(0, -4)), manifest.length - 4);
    assertBytes(file.manifestFrame(), manifest);
    const collector = api.createCollector();
    const metadata = await collector.accept(manifest);
    assert.equal(metadata.kind, 'manifest');
    assert.equal(metadata.size, bytes.length);
    assert.equal(metadata.received, 0);
    assert.equal(metadata.complete, false);
    assertBytes((await collector.accept(expected)).bytes, bytes);
    const detached = file.manifestFrame();
    detached.fill(0);
    assertBytes(file.manifestFrame(), manifest);
    const maximumName = await api.createTransfer(bytes, 'n'.repeat(120), { compact: true, chunkBytes });
    assert.equal(maximumName.manifestFrame().length, 200);
    assert.equal(maximumName.frame(0).length, chunkBytes + 40);
    const legacy = await api.createTransfer(bytes, 'n'.repeat(120), { chunkBytes });
    assert.equal(legacy.frame(0).length - maximumName.frame(0).length, 164);
    file.dispose();
    assert.throws(() => file.manifestFrame(), { code: 'TRANSFER_DISPOSED' });
  }
  await assert.rejects(api.createTransfer(bytes, 'bad', { compact: 1 }), { code: 'INVALID_INPUT' });
});

test('dropped manifests and late join never invent progress, and paired reordered symbols recover byte-exactly', async () => {
  for (const chunkBytes of [384, 600]) {
    const bytes = pattern(chunkBytes * 68 + 9);
    const file = await api.createTransfer(bytes, 'late-join.bin', { compact: true, chunkBytes });
    const collector = api.createCollector();
    for (let index = 0; index < 16; index++) {
      const result = await collector.accept(file.frame(index));
      assert.equal(result.kind, 'pending');
      assert.equal(result.reason, 'manifest');
      assert.equal(result.packetType, 'single');
      assert.equal(collector.state, null);
    }
    assert.throws(() => collector.createFeedback(), { code: 'NO_TRANSFER' });
    const joined = await collector.accept(file.manifestFrame());
    assert.equal(joined.received, 0);
    for (const index of shuffle(Array.from({ length: file.total - 16 }, (_, index) => index + 16))) {
      const result = await collector.accept(file.frame(index));
      assert.equal(result.packetType, 'single');
      if (index % 7 === 0) {
        assert.equal((await collector.accept(file.frame(index))).duplicate, true);
        const repeated = await collector.accept(file.manifestFrame());
        assert.equal(repeated.kind, 'manifest');
        assert.equal(repeated.received, result.received);
      }
    }
    const feedback = file.acceptFeedback(collector.createFeedback());
    assert.deepEqual([...feedback.missingBlocks], [0]);
    assert.deepEqual([...feedback.repairTargets[0].missingFrames], Array.from({ length: 16 }, (_, index) => index));
    let complete;
    // Two display lanes may arrive in either order; neither lane is a protocol session.
    for (let index = 0; index < 16; index += 2) {
      await collector.accept(file.frame(index + 1));
      complete = await collector.accept(file.frame(index));
    }
    assert.equal(complete.kind, 'complete');
    assert.equal(complete.received, file.total);
    assertBytes(complete.bytes, bytes);
  }
});

test('compact repair-only reception works after lost metadata and identifies mixed equations', async () => {
  const bytes = pattern(384 * 33 - 7);
  const file = await api.createTransfer(bytes, 'repair-only.bin', { compact: true });
  const collector = api.createCollector();
  assert.equal((await collector.accept(file.repairFrame(0, 1))).kind, 'pending');
  await collector.accept(file.manifestFrame());
  let mixed = false;
  let complete;
  for (const block of [1, 0]) {
    for (let serial = 2; serial < 160; serial++) {
      complete = await collector.accept(file.repairFrame(block, serial));
      mixed ||= complete.packetType === 'mixed';
      if (!file.acceptFeedback(collector.createFeedback()).missingBlocks.includes(block)) break;
    }
  }
  assert.ok(mixed);
  assert.equal(complete.kind, 'complete');
  assertBytes(complete.bytes, bytes);
});

test('compact metadata, data bounds, CRC and session isolation reject malformed inputs without replacing progress', async () => {
  const file = await api.createTransfer(pattern(385), 'ok.bin', { compact: true });
  const manifest = file.manifestFrame();
  for (const [change, code] of [
    [bytes => { bytes[9] = 2; }, 'MALFORMED_FRAME'],
    [(_, view) => view.setUint16(10, 1), 'MALFORMED_FRAME'],
    [(_, view) => view.setUint32(28, 0), 'MALFORMED_FRAME'],
    [(_, view) => view.setUint32(28, api.MAX_FILE_BYTES + 1), 'FILE_TOO_LARGE'],
    [(_, view) => view.setUint16(32, 512), 'MALFORMED_FRAME'],
    [(_, view) => view.setUint16(34, 2), 'MALFORMED_FRAME'],
    [(_, view) => view.setUint32(36, 100), 'MALFORMED_FRAME'],
    [(_, view) => view.setUint16(40, 121), 'MALFORMED_FRAME'],
    [(_, view) => view.setUint16(42, 1), 'MALFORMED_FRAME'],
    [bytes => { bytes[76] = 0xff; }, 'MALFORMED_FRAME'],
    [bytes => { bytes[76] = 47; }, 'MALFORMED_FRAME']
  ]) {
    const collector = api.createCollector();
    await assert.rejects(collector.accept(edit(manifest, change)), { code });
    assert.equal(collector.state, null);
  }
  for (const change of [
    bytes => { bytes[9] = 2; }, (_, view) => view.setUint16(10, 40),
    (_, view) => view.setUint16(28, 65535), (_, view) => view.setUint32(30, 0),
    (_, view) => view.setUint32(30, 4), (_, view) => view.setUint16(34, 0),
    (_, view) => view.setUint16(34, 33)
  ]) {
    const collector = api.createCollector();
    await assert.rejects(collector.accept(edit(file.frame(0), change)), { code: 'MALFORMED_FRAME' });
    assert.equal(collector.state, null);
  }
  const collector = api.createCollector();
  await assert.rejects(collector.accept(edit(manifest, bytes => { bytes[44] ^= 1; }, false)), { code: 'CRC_MISMATCH' });
  await assert.rejects(collector.accept(edit(file.frame(0), bytes => { bytes[36] ^= 1; }, false)), { code: 'CRC_MISMATCH' });
  await assert.rejects(collector.accept(file.frame(0).subarray(0, -1)), { code: 'MALFORMED_FRAME' });
  await collector.accept(manifest);
  await collector.accept(file.frame(0));
  await assert.rejects(collector.accept(edit(file.frame(1), (_, view) => view.setUint16(34, 3))), { code: 'METADATA_CONFLICT' });
  await assert.rejects(collector.accept(edit(manifest, bytes => { bytes[44] ^= 1; })), { code: 'METADATA_CONFLICT' });
  const other = await api.createTransfer(pattern(385), 'other.bin', { compact: true });
  assert.equal((await collector.accept(other.frame(0))).kind, 'foreign');
  assert.equal((await collector.accept(other.manifestFrame())).kind, 'foreign');
  const v2 = await api.createTransfer(pattern(385), 'old.bin');
  assert.equal((await collector.accept(edit(v2.frame(0), bytes => bytes.set(Buffer.from(file.id, 'hex'), 12)))).kind, 'foreign');
  assert.equal(collector.state.received, 1);
  assertBytes((await collector.accept(file.frame(1))).bytes, pattern(385));
});

test('compact ACK targets missing pivots and each requested systematic chunk increases the reported rank', async () => {
  const bytes = pattern(384 * 48 - 1);
  const file = await api.createTransfer(bytes, 'targeted.bin', { compact: true });
  const collector = api.createCollector();
  await collector.accept(file.manifestFrame());
  for (let serial = 0; serial < 12; serial++) await collector.accept(file.repairFrame(0, serial));
  const ack = collector.createFeedback({ suggestedRate: 10 });
  assert.equal(ack[8], 2);
  assert.equal(ack[9], 3);
  assert.equal(new DataView(ack.buffer).getUint16(74), 2);
  const feedback = file.acceptFeedback(ack);
  assert.equal(feedback.suggestedRate, 10);
  assert.equal(feedback.complete, false);
  let result;
  for (const target of feedback.repairTargets) {
    for (const index of shuffle(target.missingFrames)) {
      const previous = collector.state.received;
      result = await collector.accept(file.frame(index));
      assert.equal(result.received, previous + 1);
    }
  }
  assert.equal(result.kind, 'complete');
  assertBytes(result.bytes, bytes);
  const completed = file.acceptFeedback(collector.createFeedback());
  assert.equal(completed.complete, true);
  assert.equal(completed.repairTargets.length, 0);
  await assert.rejects(collector.accept(ack), { code: 'FEEDBACK_FRAME' });
});

test('compact ACK target bounds and conflicting entries are checked, including at 10 MiB', async () => {
  const file = await api.createTransfer(pattern(384 * 35), 'targets.bin', { compact: true });
  const collector = api.createCollector();
  await collector.accept(file.manifestFrame());
  const ack = collector.createFeedback();
  const first = 76 + new DataView(ack.buffer).getUint16(72);
  for (const change of [
    bytes => { bytes[8] = 1; }, bytes => { bytes[9] = 2; },
    (_, view) => view.setUint16(74, 17), (_, view) => view.setUint16(first, 2),
    (_, view) => view.setUint32(first + 2, 0),
    (_, view) => view.setUint16(first + 6, 0),
    (_, view) => view.setUint32(first + 8, 8),
    bytes => { bytes[76] = 1; }
  ]) assert.throws(() => file.acceptFeedback(edit(ack, change)), { code: 'MALFORMED_FEEDBACK' });
  assert.throws(() => file.acceptFeedback(edit(ack, bytes => { bytes[12] ^= 1; })), { code: 'FEEDBACK_SESSION_MISMATCH' });
  const maximum = await api.createTransfer(new Uint8Array(api.MAX_FILE_BYTES), 'maximum.bin', { compact: true });
  const bounded = api.createCollector();
  await bounded.accept(maximum.manifestFrame());
  assert.equal(bounded.state.total, 27307);
  assert.equal(bounded.state.blockCount, 854);
  const largestAck = bounded.createFeedback();
  assert.equal(largestAck.length, 283);
  const targets = maximum.acceptFeedback(largestAck).repairTargets;
  assert.equal(targets.length, 16);
  assert.ok(targets.every(target => target.missingFrames.length <= 32));
  const last = await bounded.accept(maximum.frame(maximum.total - 1));
  assert.equal(last.received, 1);
  targets[0].missingFrames.length = 0;
  assert.equal(maximum.acceptFeedback(bounded.createFeedback()).repairTargets[0].missingFrames.length, 32);
  bounded.dispose();
  maximum.dispose();
});

test('compact final digest, padding and reset protection remain byte-exact', async () => {
  const file = await api.createTransfer(pattern(385), 'hash.bin', { compact: true });
  const collector = api.createCollector();
  await collector.accept(edit(file.manifestFrame(), bytes => { bytes[44] ^= 1; }));
  await collector.accept(file.frame(0));
  await assert.rejects(collector.accept(file.frame(1)), { code: 'DIGEST_MISMATCH' });
  assert.equal(collector.state, null);
  await collector.accept(file.manifestFrame());
  await collector.accept(file.frame(0));
  await assert.rejects(collector.accept(edit(file.frame(1), bytes => { bytes[37] = 1; })), { code: 'DIGEST_MISMATCH' });
  assert.equal(collector.state, null);
  let release;
  let hashed;
  const gated = runtime({ getRandomValues: bytes => webcrypto.getRandomValues(bytes), subtle: { digest: (algorithm, bytes) => {
    hashed = bytes;
    const copy = new Uint8Array(bytes);
    return new Promise(resolve => { release = async () => resolve(await webcrypto.subtle.digest(algorithm, copy)); });
  } } }).createCollector();
  await gated.accept(file.manifestFrame());
  await gated.accept(file.frame(0));
  const finishing = gated.accept(file.frame(1));
  const rejected = assert.rejects(finishing, { code: 'TRANSFER_RESET' });
  const beforeHash = file.acceptFeedback(gated.createFeedback());
  assert.equal(beforeHash.complete, false);
  assert.equal(beforeHash.missingBlocks.length, 0);
  assert.equal(beforeHash.repairTargets.length, 0);
  gated.reset();
  assert.ok(hashed.every(byte => byte === 0));
  const next = await api.createTransfer(pattern(700), 'next.bin', { compact: true });
  await gated.accept(next.manifestFrame());
  await release();
  await rejected;
  assert.equal(gated.state.id, next.id);
  assert.equal(gated.state.received, 0);
});
