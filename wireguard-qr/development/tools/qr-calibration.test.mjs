import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
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
  const { fps, lanes = sender.lanes } = sender.profiles[index];
  for (let sequence = 0; sequence < fps * 4 * lanes; sequence++) {
    if (!sequenceFilter(sequence)) continue;
    for (let copy = 0; copy < repeats; copy++) {
      observer.accept(sender.frame(index, sequence), index * 4000 + Math.floor(sequence / lanes) * 1000 / fps + copy);
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
  assert.equal(one.large, false);
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
  assert.throws(() => api.create({ large: 1 }), { code: 'CALIBRATION_INVALID' });
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

test('large calibration includes the exact 52-byte v4 envelope in both densities and keeps useful-byte rates', () => {
  for (const extended of [false, true]) for (const ecc of ['M', 'L']) {
    const sender = api.create({ lanes: 2, extended, ecc, large: true }), observer = api.createObserver();
    assert.equal(sender.large, true);
    for (const index of [0, sender.profiles.length - 1]) {
      const profile = sender.profiles[index], frame = sender.frame(index, 0), parsed = api.parse(frame);
      assert.equal(frame.length, profile.chunkBytes + 92);
      assert.equal(frame[9], 4 | (ecc === 'L' ? 2 : 0));
      assert.equal(parsed.large, true); assert.equal(parsed.ecc, ecc); assert.equal(parsed.chunkBytes, profile.chunkBytes);
      assert.equal(parsed.version, extended ? 2 : 1);
    }
    const index = sender.profiles.length - 1;
    observeProfile(sender, observer, index, sequence => sequence < 6);
    observer.accept(sender.endFrame(), sender.profiles.length * sender.duration);
    assert.equal(sender.endFrame().length, 40); assert.equal(api.parse(sender.endFrame()).large, true);
    assert.equal(observer.state.large, true);
    const feedback = observer.createFeedback(); assert.equal(feedback[11], 2 | (ecc === 'L' ? 1 : 0));
    const chosen = sender.acceptFeedback(feedback);
    assert.equal(chosen.large, true); assert.equal(chosen.ecc, ecc); assert.equal(chosen.bytesPerSecond, 900);
    assert.equal(chosen.samples, 6, 'Envelope bytes do not count as useful file bytes');
  }
});

test('large flags require matching frame length and cannot switch the active calibration or its result', () => {
  const large = api.create({ extended: true, lanes: 2, large: true });
  const ordinary = api.create({ extended: true, lanes: 2 });
  for (const [sender, bitChange] of [[large, value => { value[9] &= ~4; }], [ordinary, value => { value[9] |= 4; }]]) {
    const observer = api.createObserver();
    assert.throws(() => observer.accept(edit(sender.frame(0), bitChange), 0), { code: 'CALIBRATION_INVALID' });
    assert.equal(observer.state, null);
    assert.throws(() => observer.accept(edit(sender.frame(0), value => { value[9] |= 8; }), 0), { code: 'CALIBRATION_INVALID' });
  }
  const observer = api.createObserver();
  observer.accept(ordinary.frame(0), 0);
  const changedEnd = edit(ordinary.endFrame(), value => { value[9] |= 4; });
  assert.equal(observer.accept(changedEnd, 40000).foreign, true);
  assert.equal(observer.state.large, false); assert.equal(observer.state.ended, false);
  observeProfile(ordinary, observer, 1); observer.accept(ordinary.endFrame(), 40000);
  const normalFeedback = observer.createFeedback(); assert.equal(normalFeedback[11] & 2, 0);
  assert.throws(() => ordinary.acceptFeedback(edit(normalFeedback, value => { value[11] |= 2; })), { code: 'CALIBRATION_INVALID' });
  observer.reset(); observeProfile(large, observer, 9, sequence => sequence < 6); observer.accept(large.endFrame(), 40000);
  const largeFeedback = observer.createFeedback();
  for (const change of [value => { value[11] &= ~2; }, value => { value[11] |= 4; }]) {
    assert.throws(() => large.acceptFeedback(edit(largeFeedback, change)), { code: 'CALIBRATION_INVALID' });
  }
});

test('v3 current-grid plans cover every 1..3 by 1..3 grid without changing legacy callers', () => {
  for (const columns of [1, 2, 3]) for (const rows of [1, 2, 3]) for (const extended of [false, true]) {
    const input = { columns, rows };
    const sender = api.create({ grid: input, extended });
    input.columns = 99;
    assert.equal(sender.version, 3); assert.equal(sender.compareLayouts, false); assert.equal(sender.extended, extended);
    assert.equal(sender.profiles.length, extended ? 10 : 6);
    assert.equal(sender.duration * sender.profiles.length, extended ? 40000 : 24000);
    assert.equal(sender.alignmentIndex, 0); assert.equal(sender.alignmentLanes, columns * rows);
    assert.ok(Object.isFrozen(sender.profiles));
    for (let index = 0; index < sender.profiles.length; index++) {
      const profile = sender.profiles[index];
      assert.ok(Object.isFrozen(profile)); assert.ok(Object.isFrozen(profile.grid));
      assert.deepEqual([profile.grid.columns, profile.grid.rows, profile.lanes], [columns, rows, columns * rows]);
      const last = profile.fps * 4 * profile.lanes - 1;
      const frame = sender.frame(index, last), parsed = api.parse(frame);
      assert.equal(frame[11], (columns << 4) | rows);
      assert.equal(frame[9], extended ? 16 : 0);
      assert.equal(parsed.version, 3); assert.equal(parsed.compareLayouts, false); assert.equal(parsed.extended, extended);
      assert.equal(parsed.alignment, false); assert.equal(parsed.lanes, columns * rows);
      assert.equal(parsed.slot, profile.lanes - 1); assert.equal(parsed.step, profile.fps * 4 - 1); assert.equal(parsed.window, 3);
      assert.throws(() => sender.frame(index, last + 1), { code: 'CALIBRATION_INVALID' });
    }
    assert.equal(api.parse(sender.endFrame()).window, null);
  }
  assert.equal(api.create({ compareLayouts: false }).version, 1);
  assert.equal(api.create({ extended: true, compareLayouts: false }).version, 2);
  for (const grid of [null, {}, { columns: 0, rows: 1 }, { columns: 6, rows: 1 },
    { columns: 1, rows: 4 }, { columns: 1.5, rows: 2 }, { columns: 2, rows: '2' }]) {
    assert.throws(() => api.create({ grid }), { code: 'CALIBRATION_INVALID' });
  }
  assert.throws(() => api.create({ compareLayouts: 1 }), { code: 'CALIBRATION_INVALID' });
  assert.throws(() => api.create().alignmentFrame(), { code: 'CALIBRATION_INVALID' });
});

test('v3 comparison groups profiles by four explicit grids and prepares the largest grid first', () => {
  for (const extended of [false, true]) {
    const sender = api.create({ grid: { columns: 3, rows: 3 }, compareLayouts: true, extended });
    const base = extended ? api.fastProfiles : api.profiles;
    const grids = [[1, 1], [2, 1], [1, 2], [2, 2]];
    assert.equal(sender.version, 3); assert.equal(sender.profiles.length, base.length * 4);
    assert.equal(sender.duration * sender.profiles.length, extended ? 160000 : 96000);
    assert.equal(sender.alignmentIndex, base.length * 3); assert.equal(sender.alignmentLanes, 4);
    for (let index = 0; index < sender.profiles.length; index++) {
      const profile = sender.profiles[index], expected = base[index % base.length];
      const [columns, rows] = grids[Math.floor(index / base.length)];
      assert.deepEqual([profile.grid.columns, profile.grid.rows, profile.lanes, profile.chunkBytes, profile.fps],
        [columns, rows, columns * rows, expected.chunkBytes, expected.fps]);
      const parsed = api.parse(sender.frame(index, profile.fps * 4 * profile.lanes - 1));
      assert.equal(parsed.compareLayouts, true); assert.equal(parsed.extended, extended);
      assert.equal(parsed.index, index); assert.equal(parsed.lanes, columns * rows);
    }
    const alignment = api.parse(sender.alignmentFrame());
    assert.equal(alignment.index, sender.alignmentIndex);
    assert.deepEqual([alignment.grid.columns, alignment.grid.rows, alignment.chunkBytes, alignment.fps], [2, 2, 384, 2]);
    assert.equal(api.parse(sender.endFrame()).index, sender.profiles.length - 1);
  }
});

test('alignment supplies independent full-sized slots for every profile without counting samples or rewinding progress', () => {
  const sender = api.create({ compareLayouts: true, large: true, ecc: 'L' }), observer = api.createObserver();
  for (let index = 0; index < sender.profiles.length; index++) {
    const profile = sender.profiles[index], payloads = new Set();
    for (let lane = 0; lane < profile.lanes; lane++) {
      const frame = sender.alignmentFrame(lane, index), parsed = api.parse(frame);
      assert.equal(frame.length, profile.chunkBytes + 92);
      assert.equal(parsed.alignment, true); assert.equal(parsed.ended, false);
      assert.equal(parsed.index, index); assert.equal(parsed.sequence, lane); assert.equal(parsed.slot, lane);
      assert.equal(parsed.step, null); assert.equal(parsed.window, null);
      assert.equal(parsed.ecc, 'L'); assert.equal(parsed.large, true);
      payloads.add(Buffer.from(frame).toString('hex'));
    }
    assert.equal(payloads.size, profile.lanes);
    assert.throws(() => sender.alignmentFrame(profile.lanes, index), { code: 'CALIBRATION_INVALID' });
  }
  for (let repeat = 0; repeat < 5; repeat++) for (let lane = 0; lane < sender.alignmentLanes; lane++) {
    observer.accept(sender.alignmentFrame(lane, sender.alignmentIndex, true), repeat * 100000 + lane);
  }
  assert.equal(observer.state.phase, 'alignment'); assert.equal(observer.state.currentIndex, 18);
  assert.equal(observer.state.progress, 0); assert.equal(observer.state.measuredProfiles, 0);
  assert.equal(observer.state.totalProfiles, 24); assert.ok(observer.state.results.every(result => result.samples === 0));
  assert.equal(observer.state.best, null); assert.equal(observer.state.fastest, null);
  assert.throws(() => observer.createFeedback(), { code: 'CALIBRATION_INVALID' });

  observer.accept(sender.frame(0, 0), 600000);
  assert.equal(observer.state.phase, 'measuring'); assert.equal(observer.state.currentIndex, 0); assert.equal(observer.state.lanes, 1);
  const progress = observer.state.progress;
  observer.accept(sender.alignmentFrame(0, 0), 600001);
  assert.equal(observer.state.phase, 'measuring', 'A delayed preparation frame cannot rewind this measurement.');
  observer.accept(sender.alignmentFrame(0, 1), 600002);
  assert.equal(observer.state.phase, 'alignment'); assert.equal(observer.state.currentIndex, 1);
  assert.equal(observer.state.progress, progress); assert.equal(observer.state.results[0].samples, 1);
  observer.accept(sender.frame(0, 1), 600003);
  assert.equal(observer.state.phase, 'alignment'); assert.equal(observer.state.currentIndex, 1);
  assert.equal(observer.state.results[0].samples, 2, 'A late measurement still belongs to its original profile.');
  observer.accept(sender.frame(1, 0), 600004);
  assert.equal(observer.state.phase, 'measuring'); assert.equal(observer.state.currentIndex, 1);
  assert.equal(observer.state.measuredProfiles, 2);
  observer.accept(sender.endFrame(), 700000);
  assert.equal(observer.state.phase, 'finished'); assert.equal(observer.state.progress, 100);
  observer.accept(sender.alignmentFrame(), 700001);
  assert.equal(observer.state.phase, 'finished'); assert.equal(observer.state.results[0].samples, 2);
  observer.reset(); assert.equal(observer.state, null);
  observer.accept(sender.alignmentFrame(), 800000);
  assert.equal(observer.state.phase, 'alignment'); assert.ok(observer.state.results.every(result => result.samples === 0));
  sender.dispose();
  assert.throws(() => sender.alignmentFrame(), { code: 'CALIBRATION_INVALID' });
});

test('v3 reports exact unique coverage in four sender windows despite duplicates and delayed out-of-order reads', () => {
  const sender = api.create({ grid: { columns: 3, rows: 2 } }), observer = api.createObserver();
  // 5 displays/s, six independent slots: 30 expected symbols per second.
  for (let sequence = 119; sequence >= 0; sequence--) {
    if (sequence === 30 || (sequence >= 60 && sequence < 75)) continue;
    for (let repeat = 0; repeat < 3; repeat++) observer.accept(sender.frame(1, sequence), 900000 + repeat);
  }
  observer.accept(sender.endFrame(), 900100);
  const result = observer.state.results[1];
  assert.deepEqual([result.expected, result.received, result.samples, result.missing], [120, 104, 104, 16]);
  assert.equal(result.coverage, 104 * 100 / 120); assert.equal(result.bytesPerSecond, 9984);
  assert.deepEqual(Array.from(result.perSecond, window => [window.expected, window.received, window.missing]),
    [[30, 30, 0], [30, 29, 1], [30, 15, 15], [30, 30, 0]]);
  assert.deepEqual(Array.from(result.perSecond, window => window.bytesPerSecond), [11520, 11136, 5760, 11520]);
  assert.equal(result.minBytesPerSecond, 5760); assert.equal(result.maxBytesPerSecond, 11520);
  assert.equal(result.stable, false); assert.equal(observer.state.best, null);
  assert.equal(observer.state.fastest.index, 1);
  assert.throws(() => observer.createFeedback(), { code: 'CALIBRATION_INVALID' });
  result.perSecond[0].received = 9999;
  assert.equal(observer.state.results[1].perSecond[0].received, 30, 'Snapshots cannot alter counted symbols.');
});

test('v3 setup previews cannot masquerade as a later settling period after measurement starts', () => {
  const sender = api.create({ compareLayouts: true }), observer = api.createObserver();
  const setup = sender.alignmentFrame(0, sender.alignmentIndex, true);
  const parsed = api.parse(setup);
  assert.equal(parsed.setup, true); assert.equal(parsed.alignment, true); assert.equal(parsed.index, 18);
  assert.equal(setup[9], 32 | 8 | 64);
  observer.accept(setup, 0);
  assert.equal(observer.state.currentIndex, 18); assert.equal(observer.state.phase, 'alignment');
  observer.accept(sender.frame(0), 5000);
  const progress = observer.state.progress;
  observer.accept(setup, 5001);
  assert.equal(observer.state.currentIndex, 0); assert.equal(observer.state.phase, 'measuring');
  assert.equal(observer.state.lanes, 1); assert.equal(observer.state.progress, progress);
  assert.equal(observer.state.results[0].samples, 1); assert.equal(observer.state.results[18].samples, 0);

  const settle = sender.alignmentFrame(0, 18);
  assert.equal(api.parse(settle).setup, false);
  observer.accept(settle, 90000);
  assert.equal(observer.state.currentIndex, 18); assert.equal(observer.state.phase, 'alignment');
  assert.equal(observer.state.lanes, 4); assert.equal(observer.state.progress, progress);
  observer.accept(sender.frame(18), 91000);
  assert.equal(observer.state.currentIndex, 18); assert.equal(observer.state.phase, 'measuring');
  assert.equal(observer.state.results[18].samples, 1);
  assert.throws(() => sender.alignmentFrame(0, 0, 1), { code: 'CALIBRATION_INVALID' });
  assert.throws(() => api.parse(edit(setup, value => { value[9] &= ~8; })), { code: 'CALIBRATION_INVALID' });
  assert.throws(() => api.parse(edit(setup, value => { value[8] = 2; value[11] = 2; })), { code: 'CALIBRATION_INVALID' });
});

test('v3 recommends a complete profile while a faster profile with gaps remains informational', () => {
  const sender = api.create({ compareLayouts: true }), observer = api.createObserver();
  observeProfile(sender, observer, 0); // Complete 1x1 / 384 B / 2 Hz: 768 B/s.
  observeProfile(sender, observer, 23, sequence => sequence < 159); // One missing 2x2 / 600 B / 10 Hz symbol.
  assert.equal(observer.state.best, null);
  observer.accept(sender.endFrame(), 96000);
  const state = observer.state;
  assert.equal(state.lanes, 4); assert.equal(state.phase, 'finished');
  assert.equal(state.best.index, 0); assert.equal(state.best.stable, true); assert.equal(state.best.coverage, 100);
  assert.equal(state.fastest.index, 23); assert.equal(state.fastest.missing, 1); assert.equal(state.fastest.stable, false);
  const feedback = observer.createFeedback();
  assert.equal(feedback[10], 0x11, 'SET describes the winning grid, not the grid of the final marker.');
  const selected = sender.acceptFeedback(feedback);
  assert.deepEqual([selected.grid.columns, selected.grid.rows, selected.lanes, selected.samples, selected.steps, selected.bytesPerSecond],
    [1, 1, 1, 8, 8, 768]);
  assert.equal(selected.compareLayouts, true);
});

test('all four compared grids belong to one v3 session, including equal-area horizontal and vertical pairs', () => {
  const sender = api.create({ compareLayouts: true }), observer = api.createObserver();
  for (const index of [0, 6, 12, 18]) {
    const profile = sender.profiles[index];
    const aligned = observer.accept(sender.alignmentFrame(0, index), index * 5000);
    assert.equal(aligned.foreign, undefined); assert.equal(aligned.phase, 'alignment');
    assert.deepEqual([aligned.grid.columns, aligned.grid.rows], [profile.grid.columns, profile.grid.rows]);
    observeProfile(sender, observer, index);
    assert.equal(observer.state.currentIndex, index); assert.equal(observer.state.lanes, profile.lanes);
  }
  observer.accept(sender.endFrame(), 120000);
  assert.equal(observer.state.measuredProfiles, 4); assert.equal(observer.state.totalProfiles, 24);
  assert.equal(observer.state.best.index, 18); assert.equal(observer.state.best.bytesPerSecond, 3072);
  for (const index of [0, 6, 12, 18]) {
    assert.equal(observer.state.results[index].coverage, 100);
    assert.ok(observer.state.results[index].perSecond.every(window => window.coverage === 100));
  }
});

test('v3 SET represents 108000 B/s and verifies full coverage, session, plan, selected grid, ECC and envelope', () => {
  const sender = api.create({ grid: { columns: 3, rows: 3 }, extended: true, ecc: 'L', large: true });
  const observer = api.createObserver();
  observeProfile(sender, observer, 9);
  observer.accept(sender.endFrame(), 50000);
  const feedback = observer.createFeedback(), view = new DataView(feedback.buffer);
  assert.equal(feedback.length, 40); assert.equal(feedback[8], 3); assert.equal(feedback[10], 0x33);
  assert.equal(feedback[11], 1 | 2 | 8); assert.equal(view.getUint16(28), 720);
  assert.equal(view.getUint32(30), 108000); assert.equal(view.getUint16(34), 80);
  const selected = sender.acceptFeedback(feedback);
  assert.deepEqual([selected.lanes, selected.samples, selected.steps, selected.bytesPerSecond], [9, 720, 80, 108000]);
  assert.ok(observer.state.best.perSecond.every(window => window.received === 180 && window.coverage === 100));
  for (const change of [
    value => { value[8] = 2; }, value => { value[8] = 4; }, value => { value[9] = 10; },
    value => { value[9] = 7; }, value => { value[10] = 0x32; },
    value => { value[11] ^= 1; }, value => { value[11] ^= 2; }, value => { value[11] ^= 4; },
    value => { value[11] ^= 8; }, value => { value[11] |= 16; }, value => { value[12] ^= 1; },
    (_, changed) => changed.setUint16(28, 721), (_, changed) => changed.setUint16(34, 79),
    (_, changed) => changed.setUint32(30, 108001),
    (_, changed) => { changed.setUint16(28, 719); changed.setUint32(30, 107850); }
  ]) assert.throws(() => sender.acceptFeedback(edit(feedback, change)), { code: 'CALIBRATION_INVALID' });
  assert.throws(() => sender.acceptFeedback(edit(feedback, value => { value[28] ^= 1; }, false)), { code: 'CALIBRATION_INVALID' });
  assert.throws(() => sender.acceptFeedback(feedback.subarray(0, -1)), { code: 'CALIBRATION_INVALID' });

  const rectangular = api.create({ grid: { columns: 3, rows: 2 } }), otherObserver = api.createObserver();
  observeProfile(rectangular, otherObserver, 0); otherObserver.accept(rectangular.endFrame(), 30000);
  const rectangularFeedback = otherObserver.createFeedback();
  assert.throws(() => rectangular.acceptFeedback(edit(rectangularFeedback, value => { value[10] = 0x23; })),
    { code: 'CALIBRATION_INVALID' }, 'Equal area does not make a transposed grid the same profile.');
});

test('v3 malformed grids, profile encodings and alignment flags fail before observer state changes', () => {
  const sender = api.create({ grid: { columns: 3, rows: 2 } }), observer = api.createObserver();
  const frame = sender.frame(0);
  for (const change of [
    value => { value[8] = 5; }, value => { value[9] |= 64; }, value => { value[9] |= 128; }, value => { value[10] = 6; },
    value => { value[11] = 0; }, value => { value[11] = 0x41; }, value => { value[11] = 0x14; },
    value => { value[34] = 1; }, value => { value[35] = 1; },
    (_, view) => view.setUint16(28, 48), (_, view) => view.setUint16(30, 1),
    (_, view) => view.setUint16(32, 3999), value => { value[9] |= 1 | 8; },
    (value, view) => { value[9] |= 8; view.setUint16(28, 6); }
  ]) {
    assert.throws(() => observer.accept(edit(frame, change), 0), { code: 'CALIBRATION_INVALID' });
    assert.equal(observer.state, null);
  }
  assert.throws(() => observer.accept(edit(sender.endFrame(), value => { value[10] = 0; value[34] = 0; value[35] = 0; }), 30000),
    { code: 'CALIBRATION_INVALID' });
  const compared = api.create({ compareLayouts: true });
  assert.throws(() => observer.accept(edit(compared.frame(6), value => { value[11] = 0x12; }), 30000),
    { code: 'CALIBRATION_INVALID' });
  assert.equal(observer.state, null);
});

test('v3 foreign session options cannot change an active trial or reuse its recommendation', () => {
  const sender = api.create({ grid: { columns: 1, rows: 1 } }), observer = api.createObserver();
  observer.accept(sender.alignmentFrame(), 0);
  for (const change of [
    value => { value[12] ^= 1; }, value => { value[11] = 0x21; },
    value => { value[9] ^= 2; }, value => { value[9] |= 16; }, value => { value[9] |= 32; }
  ]) {
    const result = observer.accept(edit(sender.alignmentFrame(), change), 1);
    assert.equal(result.foreign, true); assert.equal(result.phase, 'alignment');
    assert.equal(result.id, sender.id); assert.equal(result.progress, 0);
    assert.ok(result.results.every(profile => profile.samples === 0));
  }
  assert.equal(observer.accept(edit(sender.endFrame(), value => { value[9] |= 4; }), 24000).foreign, true);
  observeProfile(sender, observer, 0); observer.accept(sender.endFrame(), 30000);
  const foreign = api.create({ grid: { columns: 1, rows: 1 } });
  assert.throws(() => foreign.acceptFeedback(observer.createFeedback()), { code: 'CALIBRATION_INVALID' });
  assert.equal(observer.state.best.coverage, 100);
});

test('v1, v2 and v3 CAL/SET bytes match reference hashes captured before adding v4', () => {
  const fixed = runtime({ crypto: { getRandomValues(value) {
    for (let i = 0; i < value.length; i++) value[i] = i;
    return value;
  } } });
  const cases = [
    [{}, 'f3179c40de67c306005baf5aba605e671444aac3a88a5b895f3ecbd5df6716cc'],
    [{ extended: true, lanes: 2, ecc: 'L', large: true }, '4793f8c25d74721fb8b12882562e2c608adf15b24d9e1cd319005f8af2feab07'],
    [{ compareLayouts: true }, 'fdb40dbba09f17d643b67f4a534f2fedc9e797bcf549ae56e0dec0ff048a4cdc'],
    [{ grid: { columns: 3, rows: 3 }, extended: true, ecc: 'L', large: true }, '0efccad4b1226d63ca91b955191c0e56fd143343527f40cb80e8490df2979f00']
  ];
  for (const [options, expected] of cases) {
    const sender = fixed.create(options), observer = fixed.createObserver(), hash = createHash('sha256');
    assert.equal(sender.allLayouts, false);
    for (let index = 0; index < sender.profiles.length; index++) {
      const profile = sender.profiles[index], lanes = profile.lanes || sender.lanes;
      hash.update(sender.frame(index, 0));
      hash.update(sender.frame(index, profile.fps * 4 * lanes - 1));
      if (sender.version === 3) for (let lane = 0; lane < lanes; lane++) {
        hash.update(sender.alignmentFrame(lane, index));
        hash.update(sender.alignmentFrame(lane, index, true));
      }
    }
    observeProfile(sender, observer, sender.profiles.length - 1);
    const end = sender.endFrame();
    hash.update(end); observer.accept(end, 999999); hash.update(observer.createFeedback());
    assert.equal(hash.digest('hex'), expected, `Version ${sender.version} retained its exact wire format.`);
  }
});

test('v4 all-grid plans cover every 1..5 by 1..3 grid with bounded indices and immutable public limits', () => {
  const order = [[1, 1], [1, 2], [2, 1], [1, 3], [3, 1], [2, 2], [4, 1], [5, 1],
    [2, 3], [3, 2], [4, 2], [3, 3], [5, 2], [4, 3], [5, 3]];
  assert.deepEqual(Array.from(api.allGrids, grid => [grid.columns, grid.rows]), order);
  assert.deepEqual([api.limits.columns, api.limits.rows, api.limits.lanes], [5, 3, 15]);
  assert.ok(Object.isFrozen(api.allGrids) && api.allGrids.every(Object.isFrozen) && Object.isFrozen(api.limits));
  for (const extended of [false, true]) {
    const sender = api.create({ allLayouts: true, extended, grid: { columns: 4, rows: 2 }, large: true });
    const base = extended ? api.fastProfiles : api.profiles;
    assert.equal(sender.version, 4);
    assert.equal(sender.allLayouts, true); assert.equal(sender.compareLayouts, false);
    assert.equal(sender.profiles.length, extended ? 150 : 90);
    assert.equal(sender.alignmentIndex, extended ? 140 : 84);
    assert.equal(sender.alignmentLanes, 15);
    assert.ok(Object.isFrozen(sender.profiles));
    for (let index = 0; index < sender.profiles.length; index++) {
      const profile = sender.profiles[index], [columns, rows] = order[Math.floor(index / base.length)];
      assert.ok(Object.isFrozen(profile) && Object.isFrozen(profile.grid));
      assert.deepEqual([profile.grid.columns, profile.grid.rows, profile.lanes, profile.chunkBytes, profile.fps],
        [columns, rows, columns * rows, base[index % base.length].chunkBytes, base[index % base.length].fps]);
      const count = profile.fps * 4 * profile.lanes;
      const parsed = api.parse(sender.frame(index, count - 1));
      assert.equal(parsed.version, 4); assert.equal(parsed.allLayouts, true); assert.equal(parsed.compareLayouts, false);
      assert.equal(parsed.extended, extended); assert.equal(parsed.window, 3);
      assert.equal(parsed.step, profile.fps * 4 - 1); assert.equal(parsed.slot, profile.lanes - 1);
      assert.throws(() => sender.frame(index, count), { code: 'CALIBRATION_INVALID' });
    }
    const end = api.parse(sender.endFrame());
    assert.equal(end.index, sender.profiles.length - 1); assert.equal(end.sequence, 65535);
    assert.deepEqual([end.grid.columns, end.grid.rows], [5, 3]);
  }
});

test('v4 current-grid trials support four and five columns while v3 grids and four-layout comparison stay unchanged', () => {
  for (const columns of [4, 5]) for (const rows of [1, 2, 3]) {
    const sender = api.create({ grid: { columns, rows } });
    assert.equal(sender.version, 4); assert.equal(sender.profiles.length, 6);
    assert.equal(sender.allLayouts, false); assert.equal(sender.compareLayouts, false);
    assert.equal(sender.alignmentLanes, columns * rows); assert.equal(sender.alignmentIndex, 0);
    const parsed = api.parse(sender.frame(5, 0));
    assert.deepEqual([parsed.grid.columns, parsed.grid.rows, parsed.lanes], [columns, rows, columns * rows]);
    assert.throws(() => api.parse(edit(sender.frame(0), value => { value[8] = 3; })), { code: 'CALIBRATION_INVALID' },
      'The wider grid never becomes valid under the old version-3 header.');
  }
  const quick = api.create({ grid: { columns: 5, rows: 3 }, compareLayouts: true });
  assert.equal(quick.version, 3); assert.equal(quick.profiles.length, 24); assert.equal(quick.allLayouts, false);
  assert.deepEqual(Array.from(quick.profiles.filter((_, index) => index % 6 === 0), profile =>
    [profile.grid.columns, profile.grid.rows]), [[1, 1], [2, 1], [1, 2], [2, 2]]);
  assert.equal(api.create({ grid: { columns: 3, rows: 2 }, allLayouts: false }).version, 3);
  assert.throws(() => api.create({ allLayouts: 1 }), { code: 'CALIBRATION_INVALID' });
  assert.throws(() => api.create({ allLayouts: true, compareLayouts: true }), { code: 'CALIBRATION_INVALID' });
});

test('v4 setup uses distinct header-only slots; settling and measurement retain the full optical density', () => {
  for (const large of [false, true]) {
    const sender = api.create({ allLayouts: true, large, ecc: 'L' }), observer = api.createObserver();
    const payloads = new Set();
    for (let lane = 0; lane < 15; lane++) {
      const frame = sender.alignmentFrame(lane, sender.alignmentIndex, true), parsed = api.parse(frame);
      assert.equal(frame.length, 40); assert.equal(parsed.version, 4);
      assert.equal(parsed.setup, true); assert.equal(parsed.alignment, true); assert.equal(parsed.ended, false);
      assert.equal(parsed.large, large); assert.equal(parsed.ecc, 'L'); assert.equal(parsed.sequence, lane);
      assert.equal(parsed.slot, lane); assert.equal(parsed.step, null); assert.equal(parsed.window, null);
      payloads.add(Buffer.from(frame).toString('hex'));
      observer.accept(frame, lane);
    }
    assert.equal(payloads.size, 15);
    assert.equal(observer.state.allLayouts, true); assert.equal(observer.state.setup, true);
    assert.equal(observer.state.measuredProfiles, 0); assert.equal(observer.state.totalProfiles, 90);
    assert.equal(observer.state.progress, 0); assert.equal(observer.state.best, null);
    assert.ok(observer.state.results.every(result => result.received === 0));
    const settle = sender.alignmentFrame(14, sender.alignmentIndex);
    assert.equal(settle.length, large ? 476 : 424);
    assert.equal(api.parse(settle).setup, false);
    assert.equal(sender.frame(sender.alignmentIndex, 14).length, settle.length);
    observer.accept(sender.alignmentFrame(0, 0), 100);
    assert.equal(observer.state.setup, false); assert.equal(observer.state.currentIndex, 0);
    observer.accept(sender.alignmentFrame(0, sender.alignmentIndex, true), 101);
    assert.equal(observer.state.currentIndex, 0, 'A delayed short setup cannot restore the largest-grid preview.');
  }
});

test('v4 SET round-trips a fully covered profile in each of the fifteen layouts', () => {
  const sender = api.create({ allLayouts: true, ecc: 'M', large: true });
  for (const grid of api.allGrids) {
    const index = sender.profiles.findIndex(profile => profile.grid === grid && profile.chunkBytes === 600 && profile.fps === 2);
    const observer = api.createObserver();
    observer.accept(sender.alignmentFrame(0, sender.alignmentIndex, true), 0);
    observeProfile(sender, observer, index);
    observer.accept(sender.endFrame(), 500000);
    const state = observer.state, feedback = observer.createFeedback(), selected = sender.acceptFeedback(feedback);
    assert.equal(state.allLayouts, true); assert.equal(state.best.index, index);
    assert.equal(feedback.length, 40); assert.equal(feedback[8], 4); assert.ok(feedback[11] & 16);
    assert.deepEqual([selected.grid.columns, selected.grid.rows, selected.lanes], [grid.columns, grid.rows, grid.columns * grid.rows]);
    assert.equal(selected.allLayouts, true); assert.equal(selected.compareLayouts, false);
    assert.equal(selected.samples, grid.columns * grid.rows * 8); assert.equal(selected.steps, 8);
    assert.equal(selected.bytesPerSecond, grid.columns * grid.rows * 1200);
    assert.ok(state.results.filter(result => result.index !== index).every(result => result.received === 0 && !result.stable));
  }
});

test('v4 maximum profile reports 1200 distinct symbols and 180000 B/s with strict feedback identity and bounds', () => {
  const sender = api.create({ allLayouts: true, extended: true, ecc: 'L', large: true }), observer = api.createObserver();
  const index = sender.profiles.length - 1;
  observeProfile(sender, observer, index);
  observer.accept(sender.endFrame(), 800000);
  const state = observer.state, feedback = observer.createFeedback(), selected = sender.acceptFeedback(feedback);
  assert.equal(state.best.index, 149);
  assert.deepEqual([selected.lanes, selected.samples, selected.steps, selected.bytesPerSecond], [15, 1200, 80, 180000]);
  assert.equal(new DataView(feedback.buffer, feedback.byteOffset, feedback.byteLength).getUint32(30), 180000);
  for (const change of [
    value => { value[8] = 3; }, value => { value[9] = 150; }, value => { value[10] = 0x43; },
    value => { value[11] ^= 1; }, value => { value[11] ^= 2; }, value => { value[11] |= 4; },
    value => { value[11] ^= 8; }, value => { value[11] &= ~16; }, value => { value[11] |= 32; },
    value => { value[12] ^= 1; }, (_, view) => view.setUint16(28, 1199), (_, view) => view.setUint16(28, 1201),
    (_, view) => view.setUint32(30, 179999), (_, view) => view.setUint16(34, 79)
  ]) assert.throws(() => sender.acceptFeedback(edit(feedback, change)), { code: 'CALIBRATION_INVALID' });
  observer.reset();
  observeProfile(sender, observer, index, sequence => sequence !== 300);
  observer.accept(sender.endFrame(), 800000);
  assert.equal(observer.state.fastest.received, 1199);
  assert.equal(observer.state.best, null);
  assert.throws(() => observer.createFeedback(), { code: 'CALIBRATION_INVALID' }, 'One lost symbol prevents a pass, even at the largest rate.');
});

test('v4 rejects invalid grids, all/compare ambiguity, short measurement frames and sequence/index overflow before state changes', () => {
  const sender = api.create({ allLayouts: true, extended: true, large: true });
  const observer = api.createObserver(), last = sender.frame(149, 1199);
  const setup = sender.alignmentFrame(14, sender.alignmentIndex, true);
  for (const value of [
    edit(last, value => { value[8] = 5; }), edit(last, value => { value[9] |= 32; }),
    edit(last, value => { value[10] = 150; }), edit(last, value => { value[11] = 0x63; }),
    edit(last, value => { value[11] = 0x54; }), edit(last, value => { value[11] = 0x50; }),
    edit(last, value => { value[11] = 0x43; }), edit(last, (_, view) => view.setUint16(28, 1200)),
    edit(last, value => { value[9] |= 64; }), edit(last, value => { value[9] |= 72; }),
    edit(setup, value => { value[9] &= ~64; }), edit(setup, value => { value[9] &= ~8; }),
    edit(setup, (_, view) => view.setUint16(28, 15)),
    edit(sender.endFrame(), value => { value[10] = 148; }),
    edit(sender.endFrame(), (_, view) => view.setUint16(28, 1199))
  ]) {
    assert.throws(() => observer.accept(value, 0), { code: 'CALIBRATION_INVALID' });
    assert.equal(observer.state, null);
  }
  const v3 = api.create({ grid: { columns: 3, rows: 3 } });
  for (const grid of [0x41, 0x43, 0x51, 0x53]) {
    assert.throws(() => api.parse(edit(v3.frame(0), value => { value[11] = grid; })), { code: 'CALIBRATION_INVALID' });
  }
  assert.throws(() => api.parse(edit(v3.frame(0), value => { value[9] |= 128; })), { code: 'CALIBRATION_INVALID' });
});

test('v4 observers retain the exact all-layout session when other plans or identities arrive', () => {
  const fixed = runtime({ crypto: { getRandomValues(value) { return value.fill(7); } } });
  const sender = fixed.create({ allLayouts: true }), observer = fixed.createObserver();
  observer.accept(sender.alignmentFrame(0, sender.alignmentIndex, true), 0);
  observer.accept(sender.frame(0), 1);
  const previous = observer.state;
  for (const options of [
    { grid: { columns: 5, rows: 3 } }, { allLayouts: true, extended: true },
    { allLayouts: true, ecc: 'L' }, { allLayouts: true, large: true }, { compareLayouts: true }
  ]) {
    const other = fixed.create(options);
    assert.equal(other.id, sender.id, 'Even an identical trial ID does not relax plan validation.');
    const state = observer.accept(other.frame(0), 2);
    assert.equal(state.foreign, true); assert.equal(state.allLayouts, true);
    assert.equal(state.results.length, 90); assert.equal(state.results[0].received, 1);
    assert.equal(state.currentIndex, previous.currentIndex);
  }
  const forged = edit(sender.frame(0), value => { value[12] ^= 1; });
  assert.equal(observer.accept(forged, 3).foreign, true);
});
