import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

const source = await readFile(new URL('../../assets/qr-calibration.js', import.meta.url), 'utf8');
function runtime(globals = {}) {
  const browser = createContext({ TextEncoder, crypto: webcrypto, ...globals }, { codeGeneration: { strings: false, wasm: false } });
  runInContext(source, browser, { timeout: 3000 });
  return { browser, ...browser.WGCalibration };
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
function edit(bytes, change, repair = true) {
  const value = new Uint8Array(bytes), view = new DataView(value.buffer);
  change(value, view);
  if (repair) view.setUint32(value.length - 4, crc(value.subarray(0, -4)));
  return value;
}
function observeProfile(sender, observer, index, sequenceFilter = () => true, repeats = 1) {
  const { fps } = sender.profiles[index];
  for (let sequence = 0; sequence < fps * 4 * sender.lanes; sequence++) {
    if (!sequenceFilter(sequence)) continue;
    for (let copy = 0; copy < repeats; copy++) {
      observer.accept(sender.frame(index, sequence), index * 4000 + Math.floor(sequence / sender.lanes) * 1000 / fps + copy);
    }
  }
}

test('calibration uses bounded synthetic v3-sized symbols and immutable six-profile configuration', () => {
  assert.deepEqual(Array.from(api.profiles, profile => [profile.chunkBytes, profile.fps]),
    [[384, 2], [384, 5], [384, 10], [600, 2], [600, 5], [600, 10]]);
  const one = api.create({ lanes: 2, ecc: 'L' });
  const two = api.create({ lanes: 2, ecc: 'L', fileData: new TextEncoder().encode('PRIVATE FILE CONTENT') });
  assert.notEqual(one.id, two.id);
  assert.equal(one.version, 1);
  assert.equal(one.duration, 4000);
  assert.ok(Object.isFrozen(one.profiles));
  for (let index = 0; index < one.profiles.length; index++) {
    const { chunkBytes, fps } = one.profiles[index];
    const bytes = one.frame(index, fps * 4 * 2 - 1);
    assert.equal(bytes.length, chunkBytes + 40);
    assert.equal(Buffer.from(bytes.subarray(0, 8)).toString(), 'WGQR-CAL');
    assert.equal(new DataView(bytes.buffer).getUint32(bytes.length - 4), crc(bytes.subarray(0, -4)));
    assert.deepEqual(Buffer.from(bytes.subarray(36, -4)), Buffer.from(two.frame(index, fps * 8 - 1).subarray(36, -4)));
    assert.ok(bytes.subarray(36, -4).some(Boolean));
    const parsed = api.parse(bytes);
    assert.equal(parsed.id, one.id);
    assert.equal(parsed.lanes, 2);
    assert.equal(parsed.ecc, 'L');
    assert.equal(parsed.sequence, fps * 8 - 1);
    assert.equal(parsed.ended, false);
  }
  assert.equal(one.endFrame().length, 40);
  assert.equal(api.parse(one.endFrame()).ended, true);
  const detached = one.frame(0, 0);
  detached.fill(0);
  assert.equal(api.parse(one.frame(0, 0)).sequence, 0);
  for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'localStorage']) assert.equal(api.browser[name], undefined);
  assert.doesNotMatch(source, /\b(?:fetch|importScripts)\s*\(|\bnew\s+(?:WebSocket|Worker)\b/);
});

test('unique accepted bytes over the full four seconds determine the winning profile', () => {
  const sender = api.create(), observer = api.createObserver();
  observeProfile(sender, observer, 1, () => true, 5); // 20 unique 384-byte reads: 1920 B/s.
  observeProfile(sender, observer, 5, sequence => sequence < 3, 9); // Three quick reads, then failure: 450 B/s.
  assert.equal(observer.state.best, null);
  assert.throws(() => observer.createFeedback(), { code: 'CALIBRATION_INVALID' });
  observer.accept(sender.endFrame(), 24000);
  const state = observer.state;
  assert.equal(state.best.index, 1);
  assert.equal(state.best.bytesPerSecond, 1920);
  assert.equal(state.results[5].bytesPerSecond, 450);
  assert.equal(state.results[5].samples, 3);
  assert.equal(state.results[0].samples, 0);
  assert.equal(state.progress, 100);
  assert.equal(state.ended, true);
  const result = sender.acceptFeedback(observer.createFeedback());
  assert.deepEqual([result.chunkBytes, result.fps, result.samples, result.bytesPerSecond], [384, 5, 20, 1920]);
  observer.accept(sender.frame(5, 3), 25000);
  assert.equal(observer.state.results[5].samples, 3, 'The completed observation cannot gain late samples.');
  state.best.bytesPerSecond = 99999;
  state.results[1].samples = 0;
  assert.equal(observer.state.best.bytesPerSecond, 1920);
  assert.equal(observer.state.results[1].samples, 20);
});

test('dual layouts count independent symbols but require three distinct display steps', () => {
  const sender = api.create({ lanes: 2 }), observer = api.createObserver();
  observeProfile(sender, observer, 5, sequence => sequence < 4, 4);
  observer.accept(sender.endFrame(), 24000);
  assert.equal(observer.state.results[5].samples, 4);
  assert.equal(observer.state.results[5].steps, 2);
  assert.equal(observer.state.best, null);
  assert.throws(() => observer.createFeedback(), { code: 'CALIBRATION_INVALID' });
  observer.reset();
  // Only one lane is readable, but it is readable across three separate displays.
  observeProfile(sender, observer, 5, sequence => [0, 2, 4].includes(sequence), 4);
  observer.accept(sender.endFrame(), 24000);
  const selected = sender.acceptFeedback(observer.createFeedback());
  assert.equal(selected.samples, 3);
  assert.equal(selected.bytesPerSecond, 450);
  assert.equal(selected.lanes, 2);
  observer.reset();
  observeProfile(sender, observer, 5);
  observer.accept(sender.endFrame(), 24000);
  assert.equal(sender.acceptFeedback(observer.createFeedback()).bytesPerSecond, 12000);
});

test('late join and entirely missed profiles are handled conservatively without fictitious measurements', () => {
  const sender = api.create(), observer = api.createObserver();
  observeProfile(sender, observer, 3, sequence => sequence >= 6);
  observeProfile(sender, observer, 4);
  observeProfile(sender, observer, 5, sequence => sequence < 3);
  observer.accept(sender.endFrame(), 24000);
  assert.equal(observer.state.results[0].bytesPerSecond, 0);
  assert.equal(observer.state.results[3].samples, 2);
  assert.equal(observer.state.best.index, 4);
  assert.equal(sender.acceptFeedback(observer.createFeedback()).bytesPerSecond, 3000);
  const empty = api.createObserver();
  empty.accept(sender.endFrame(), 24000);
  assert.equal(empty.state.ended, true);
  assert.equal(empty.state.best, null);
  assert.throws(() => empty.createFeedback(), { code: 'CALIBRATION_INVALID' });
});

test('a throughput tie prefers the lower display rate', () => {
  const sender = api.create(), observer = api.createObserver();
  observeProfile(sender, observer, 2, sequence => sequence < 25); // 2400 B/s.
  observeProfile(sender, observer, 4, sequence => sequence < 16); // 2400 B/s.
  observer.accept(sender.endFrame(), 24000);
  const selected = sender.acceptFeedback(observer.createFeedback());
  assert.equal(selected.chunkBytes, 600);
  assert.equal(selected.fps, 5);
});

test('foreign identities, layout and ECC cannot replace an active calibration or its recommendation', () => {
  const sender = api.create(), foreign = api.create(), observer = api.createObserver();
  observer.accept(sender.frame(0), 0);
  for (const bytes of [foreign.frame(0), foreign.endFrame(),
    edit(sender.frame(0), value => { value[8] = 2; }),
    edit(sender.frame(0), value => { value[11] = 2; }),
    edit(sender.frame(0), value => { value[9] = 2; })]) {
    const result = observer.accept(bytes, 1);
    assert.equal(result.foreign, true);
    assert.equal(result.id, sender.id);
    assert.equal(result.ended, false);
    assert.equal(result.results[0].samples, 1);
  }
  observeProfile(sender, observer, 1);
  observer.accept(sender.endFrame(), 24000);
  assert.throws(() => foreign.acceptFeedback(observer.createFeedback()), { code: 'CALIBRATION_INVALID' });
});

test('malformed profiles, flags, sequence bounds and CRC fail before observer state changes', () => {
  const sender = api.create(), frame = sender.frame(0), observer = api.createObserver();
  for (const change of [
    value => { value[8] = 3; }, value => { value[9] = 4; }, value => { value[10] = 6; },
    value => { value[11] = 3; }, (_, view) => view.setUint16(28, 8),
    (_, view) => view.setUint16(30, 1), (_, view) => view.setUint16(32, 3999),
    value => { value[34] = 1; }, value => { value[35] = 2; }
  ]) {
    assert.throws(() => observer.accept(edit(frame, change), 0), { code: 'CALIBRATION_INVALID' });
    assert.equal(observer.state, null);
  }
  assert.throws(() => observer.accept(edit(frame, value => { value[36] ^= 1; }, false), 0), { code: 'CALIBRATION_INVALID' });
  assert.throws(() => observer.accept(frame.subarray(0, -1), 0), { code: 'CALIBRATION_INVALID' });
  assert.throws(() => observer.accept(edit(sender.endFrame(), value => { value[10] = 0; }), 0), { code: 'CALIBRATION_INVALID' });
  for (const time of [NaN, Infinity, -1]) assert.throws(() => observer.accept(frame, time), { code: 'CALIBRATION_INVALID' });
  assert.equal(observer.accept(new TextEncoder().encode('ordinary file bytes'), 0), null);
  assert.equal(api.isReserved(frame), true);
  assert.equal(api.isReserved(new TextEncoder().encode('WGQR-SET')), true);
  assert.equal(api.isReserved(new TextEncoder().encode('WGQR-CA')), false);
});

test('feedback verifies session, layout, ECC, sample count and measured rate', () => {
  const sender = api.create(), observer = api.createObserver();
  observeProfile(sender, observer, 1);
  observer.accept(sender.endFrame(), 24000);
  const ack = observer.createFeedback();
  assert.equal(ack.length, 40);
  assert.equal(Buffer.from(ack.subarray(0, 8)).toString(), 'WGQR-SET');
  assert.equal(api.isFeedback(ack), true);
  assert.equal(new DataView(ack.buffer).getUint32(36), crc(ack.subarray(0, 36)));
  for (const change of [
    value => { value[8] = 2; }, value => { value[9] = 6; }, value => { value[10] = 2; },
    value => { value[11] = 1; }, value => { value[12] ^= 1; },
    (_, view) => view.setUint16(28, 2), (_, view) => view.setUint16(28, 21),
    (_, view) => view.setUint16(30, 6000), value => { value[32] = 1; }
  ]) assert.throws(() => sender.acceptFeedback(edit(ack, change)), { code: 'CALIBRATION_INVALID' });
  assert.throws(() => sender.acceptFeedback(edit(ack, value => { value[28] ^= 1; }, false)), { code: 'CALIBRATION_INVALID' });
  assert.throws(() => sender.acceptFeedback(ack.subarray(0, -1)), { code: 'CALIBRATION_INVALID' });
});

test('reset/dispose erase owned calibration identity buffers and permit a fresh observation', () => {
  const allocations = [];
  class TrackedBytes extends Uint8Array { constructor(...args) { super(...args); allocations.push(this); } }
  const tracked = runtime({ Uint8Array: TrackedBytes });
  const initial = allocations.length;
  const sender = tracked.create(), observer = tracked.createObserver();
  observer.accept(sender.frame(0), 0);
  const ids = allocations.slice(initial).filter(value => value.length === 16 && value.buffer.byteLength === 16);
  assert.equal(ids.length, 2);
  observer.dispose();
  sender.dispose();
  assert.ok(ids.every(value => value.every(byte => byte === 0)));
  assert.equal(observer.state, null);
  assert.throws(() => sender.frame(0), { code: 'CALIBRATION_INVALID' });
  assert.throws(() => sender.endFrame(), { code: 'CALIBRATION_INVALID' });
  assert.throws(() => sender.acceptFeedback(new Uint8Array()), { code: 'CALIBRATION_INVALID' });
  const next = api.create();
  assert.equal(observer.accept(next.frame(0), 1).id, next.id);
  assert.throws(() => api.create({ lanes: 3 }), { code: 'CALIBRATION_INVALID' });
  assert.throws(() => api.create({ ecc: 'H' }), { code: 'CALIBRATION_INVALID' });
  assert.throws(() => api.create({ extended: 1 }), { code: 'CALIBRATION_INVALID' });
  assert.throws(() => next.frame(0, 8), { code: 'CALIBRATION_INVALID' });
  assert.throws(() => next.frame(0, 0, true), { code: 'CALIBRATION_INVALID' });
  assert.throws(() => runtime({ crypto: null }).create(), { code: 'CALIBRATION_INVALID' });
});

test('extended v2 calibration adds 15 and 20 Hz profiles while keeping the legacy six-profile prefix', () => {
  const expected = [[384, 2], [384, 5], [384, 10], [600, 2], [600, 5], [600, 10],
    [384, 15], [384, 20], [600, 15], [600, 20]];
  assert.deepEqual(Array.from(api.fastProfiles, profile => [profile.chunkBytes, profile.fps]), expected);
  const sender = api.create({ extended: true, lanes: 2, ecc: 'L' });
  assert.equal(sender.version, 2); assert.equal(sender.duration * sender.profiles.length, 40000);
  assert.ok(Object.isFrozen(sender.profiles)); assert.ok(sender.profiles.every(Object.isFrozen));
  for (let index = 0; index < sender.profiles.length; index++) {
    const [chunkBytes, fps] = expected[index];
    const last = fps * 4 * sender.lanes - 1;
    const frame = sender.frame(index, last), parsed = api.parse(frame);
    assert.equal(frame.length, chunkBytes + 40); assert.equal(parsed.version, 2);
    assert.equal(parsed.index, index); assert.equal(parsed.chunkBytes, chunkBytes); assert.equal(parsed.fps, fps);
    assert.equal(parsed.sequence, last); assert.equal(parsed.lanes, 2); assert.equal(parsed.ecc, 'L');
    assert.throws(() => sender.frame(index, last + 1), { code: 'CALIBRATION_INVALID' });
  }
  const end = api.parse(sender.endFrame());
  assert.equal(end.version, 2); assert.equal(end.index, 9); assert.equal(end.ended, true);
  assert.equal(api.create().profiles.length, 6, 'Old callers retain their 24-second, version-1 trial');
});

test('extended dual calibration counts 160 distinct symbols at 20 Hz and returns a matching v2 result', () => {
  const sender = api.create({ extended: true, lanes: 2, ecc: 'L' }), observer = api.createObserver();
  observeProfile(sender, observer, 8); // 120 symbols of 600 B: 18000 B/s.
  observeProfile(sender, observer, 9, () => true, 3); // 160 unique symbols: 24000 B/s.
  assert.equal(observer.state.best, null); assert.equal(observer.state.results.length, 10);
  observer.accept(sender.endFrame(), 40000);
  const state = observer.state;
  assert.equal(state.version, 2); assert.equal(state.best.index, 9); assert.equal(state.best.steps, 80);
  assert.equal(state.best.samples, 160); assert.equal(state.best.bytesPerSecond, 24000);
  const feedback = observer.createFeedback(); assert.equal(feedback[8], 2);
  const selected = sender.acceptFeedback(feedback);
  assert.deepEqual([selected.chunkBytes, selected.fps, selected.lanes, selected.ecc, selected.samples, selected.bytesPerSecond],
    [600, 20, 2, 'L', 160, 24000]);
  for (const change of [
    value => { value[8] = 1; }, value => { value[8] = 3; }, value => { value[9] = 10; },
    (_, view) => view.setUint16(28, 161), (_, view) => view.setUint16(30, 24001)
  ]) assert.throws(() => sender.acceptFeedback(edit(feedback, change)), { code: 'CALIBRATION_INVALID' });
});

test('fast calibration still prefers measured useful throughput when 20 Hz loses symbols', () => {
  const sender = api.create({ extended: true, lanes: 2 }), observer = api.createObserver();
  observeProfile(sender, observer, 8, sequence => sequence < 100); // 15000 B/s.
  observeProfile(sender, observer, 9, sequence => sequence < 60, 5); // Only 9000 B/s, regardless of repeated reads.
  observer.accept(sender.endFrame(), 40000);
  const selected = sender.acceptFeedback(observer.createFeedback());
  assert.equal(selected.fps, 15); assert.equal(selected.bytesPerSecond, 15000);
  assert.equal(observer.state.results[9].samples, 60);
});

test('extended profiles reject unsupported versions and malformed bounds before observation state changes', () => {
  const sender = api.create({ extended: true, lanes: 2 }), observer = api.createObserver();
  const frame = sender.frame(9, 159);
  for (const change of [
    value => { value[8] = 0; }, value => { value[8] = 1; }, value => { value[8] = 3; },
    value => { value[8] = 255; }, value => { value[10] = 10; },
    value => { value[35] = 5; }, value => { value[35] = 3; },
    (_, view) => view.setUint16(28, 160)
  ]) {
    assert.throws(() => observer.accept(edit(frame, change), 39000), { code: 'CALIBRATION_INVALID' });
    assert.equal(observer.state, null);
  }
  assert.throws(() => observer.accept(edit(sender.endFrame(), value => { value[10] = 5; value[35] = 2; }), 40000),
    { code: 'CALIBRATION_INVALID' });
  assert.equal(observer.state, null);
  const legacy = api.create();
  observer.accept(legacy.frame(0), 0);
  const sameIdentityNewVersion = edit(legacy.frame(0), value => { value[8] = 2; });
  assert.equal(observer.accept(sameIdentityNewVersion, 1).foreign, true);
  assert.equal(observer.state.version, 1); assert.equal(observer.state.results.length, 6);
  observer.reset(); observer.accept(sender.frame(9, 0), 36000);
  assert.equal(observer.state.version, 2); assert.equal(observer.state.results.length, 10);
});
