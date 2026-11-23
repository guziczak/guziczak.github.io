import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

const sources = await Promise.all(['qr-transfer.js', 'qr-resilient.js', 'qr-playback.js'].map(name =>
  readFile(new URL(`../../assets/${name}`, import.meta.url), 'utf8')));
const browser = createContext({ TextEncoder, TextDecoder, crypto: {
  getRandomValues: bytes => { for (let index = 0; index < bytes.length; index++) bytes[index] = index + 1; return bytes; },
  subtle: webcrypto.subtle
} }, { codeGeneration: { strings: false, wasm: false } });
for (const source of sources) runInContext(source, browser, { timeout: 3000 });
const api = browser.WGPlayback, wire = browser.WGResilient;
const pattern = length => Uint8Array.from({ length }, (_, index) => (index * 73 + Math.floor(index / 256)) % 256);
function transfer(total, compact = true, manifestInterval = 16) {
  return { total, blockCount: Math.ceil(total / 32), version: compact ? 3 : 2, manifestInterval,
    frame: index => Uint8Array.of(1, index & 255, index >>> 8),
    repairFrame: (block, serial) => Uint8Array.of(2, block, serial & 255, serial >>> 8),
    ...(compact ? { manifestFrame: () => Uint8Array.of(3) } : {}) };
}
const keys = batch => Array.from(batch.frames, frame => frame.key);
function referenceOrder(total, startIndex = 0, interleave = true) {
  const order = [];
  if (interleave) {
    for (let local = 0; local < 32; local++) for (let block = 0; block < Math.ceil(total / 32); block++) {
      if (block * 32 + local < total) order.push(block * 32 + local);
    }
  } else for (let index = 0; index < total; index++) order.push(index);
  const start = order.indexOf(startIndex);
  return [...order.slice(start), ...order.slice(0, start)];
}

test('periodic manifests count data symbols across single, dual and 4/6/9-slot grids and repairs', () => {
  for (const lanes of [1, 2, 4, 6, 9]) {
    const planner = api.create(transfer(37), { lanes });
    const packets = [];
    while (packets.length < 180) packets.push(...planner.next().frames);
    const sources = packets.filter(packet => packet.kind === 'source');
    assert.deepEqual(sources.map(packet => packet.index), referenceOrder(37));
    let sinceManifest = 16;
    for (const packet of packets) {
      if (packet.kind === 'manifest') { assert.equal(sinceManifest, 16); sinceManifest = 0; }
      else { sinceManifest++; assert.ok(sinceManifest <= 16); }
    }
    const repairs = packets.filter(packet => packet.kind === 'repair');
    assert.ok(repairs.length > 10);
    assert.deepEqual(repairs.slice(0, 6).map(packet => packet.block), [0, 1, 0, 1, 0, 1]);
    assert.deepEqual(repairs.slice(0, 6).map(packet => packet.serial), [0, 1, 2, 3, 4, 5]);
  }
});

test('manual stepping can show the chosen source immediately and wraps every source exactly once', () => {
  const planner = api.create(transfer(19), { lanes: 2, startIndex: 17, initialManifest: false });
  assert.deepEqual(keys(planner.next()), ['source:17', 'source:18']);
  const all = [17, 18];
  let firstManifestAfter = null;
  while (all.length < 19) {
    for (const frame of planner.next().frames) {
      if (frame.kind === 'manifest' && firstManifestAfter === null) firstManifestAfter = all.length;
      if (frame.kind === 'source') all.push(frame.index);
    }
  }
  assert.equal(firstManifestAfter, 16);
  assert.deepEqual(all, [17, 18, ...Array.from({ length: 17 }, (_, index) => index)]);
  assert.equal(api.create(transfer(5), { startIndex: -5, initialManifest: false }).next().frames[0].index, 0);
  assert.equal(api.create(transfer(5), { startIndex: 99, initialManifest: false }).next().frames[0].index, 4);
});

test('restoring a displayed checkpoint discards prefetched advancement without skipping source frames', () => {
  for (const lanes of [1, 2, 4, 6, 9]) for (const interleave of [false, true]) {
    const planner = api.create(transfer(70), { lanes, interleave });
    const displayed = planner.next();
    const expected = Array.from({ length: 20 }, () => planner.next());
    assert.equal(planner.restore(displayed.checkpoint), true);
    for (const batch of expected) {
      const replayed = planner.next();
      assert.deepEqual(keys(replayed), keys(batch));
      for (let index = 0; index < batch.frames.length; index++) {
        assert.deepEqual(Buffer.from(replayed.frames[index].bytes), Buffer.from(batch.frames[index].bytes));
      }
    }
    assert.ok(Object.isFrozen(displayed.checkpoint));
    assert.ok(Object.isFrozen(displayed.checkpoint.repairBlocks));
    assert.equal(planner.restore({ ...displayed.checkpoint }), false);
    assert.equal(planner.restore(api.create(transfer(70), { lanes }).checkpoint()), false);
  }
});

test('feedback invalidates old checkpoints and targets requested pivots before further fountain repairs', () => {
  const planner = api.create(transfer(80), { lanes: 2 });
  const previous = planner.next().checkpoint;
  for (let index = 0; index < 4; index++) planner.next();
  planner.applyFeedback({ missingBlocks: [1, 1, 2], complete: false, repairTargets: [
    { blockIndex: 1, missingFrames: [35, 33, 35, -1, 0] },
    { blockIndex: 2, missingFrames: [79] },
    { blockIndex: 0, missingFrames: [1] }
  ] });
  assert.equal(planner.restore(previous), false);
  assert.equal(planner.targetedCount, 3);
  const frames = [...planner.next().frames, ...planner.next().frames, ...planner.next().frames];
  assert.deepEqual(frames.map(frame => frame.kind), ['manifest', 'target', 'target', 'target', 'repair', 'repair']);
  assert.deepEqual(frames.filter(frame => frame.kind === 'target').map(frame => frame.index), [35, 33, 79]);
  assert.deepEqual(frames.filter(frame => frame.kind === 'repair').map(frame => frame.block), [1, 2]);
});

test('complete and awaiting-digest ACKs stop all packet generation, including later manifests', () => {
  for (const lanes of [2, 9]) for (const complete of [false, true]) {
    const planner = api.create(transfer(3), { lanes });
    planner.next();
    planner.applyFeedback({ missingBlocks: [], complete });
    for (let index = 0; index < 40; index++) assert.equal(planner.next().frames.length, 0);
    if (complete) assert.equal(planner.phase, 'complete');
    planner.applyFeedback({ missingBlocks: [0], complete: false });
    assert.deepEqual(Array.from(planner.next().frames, frame => frame.kind), ['manifest', ...Array(lanes - 1).fill('repair')]);
  }
});

test('first-pass display estimates equal real planning at lane and manifest boundaries', () => {
  for (const total of [1, 2, 3, 15, 16, 17, 18, 31, 32, 33, 47, 63, 64, 65]) {
    for (const lanes of [1, 2]) {
      for (const interval of [0, 1, 3, 16]) {
        for (const initialManifest of [false, true]) {
          const planner = api.create(transfer(total, interval !== 0, interval || 16), { lanes, initialManifest });
          let displays = 0, sources = 0;
          while (sources < total) {
            sources += planner.next().frames.filter(frame => frame.kind === 'source').length;
            displays++;
          }
          assert.equal(api.firstPassDisplays(total, lanes, interval, initialManifest), displays,
            `total=${total}, lanes=${lanes}, interval=${interval}, initial=${initialManifest}`);
        }
      }
    }
  }
});

test('grid display estimates match planning where manifests and final sources cross 4/6/9-slot boundaries', () => {
  const cases = [[3, 4, 16, true], [4, 4, 16, true], [16, 4, 16, true], [17, 4, 16, true],
    [5, 6, 16, true], [6, 6, 16, true], [32, 6, 16, false], [33, 6, 16, true],
    [8, 9, 16, true], [9, 9, 16, true], [16, 9, 16, true], [17, 9, 16, true], [65, 9, 0, false]];
  for (const [total, lanes, interval, initialManifest] of cases) {
    const planner = api.create(transfer(total, interval !== 0, interval || 16), { lanes, initialManifest });
    let displays = 0;
    const indices = [];
    while (indices.length < total) {
      const batch = planner.next();
      assert.equal(batch.frames.length, lanes);
      indices.push(...batch.frames.filter(frame => frame.kind === 'source').map(frame => frame.index));
      displays++;
    }
    assert.equal(displays, api.firstPassDisplays(total, lanes, interval, initialManifest),
      `total=${total}, lanes=${lanes}, interval=${interval}, initial=${initialManifest}`);
    assert.deepEqual(indices, referenceOrder(total, 0, interval !== 0));
  }
});

test('real compact streams survive a lost first manifest and permanently unreadable grid slots', async () => {
  for (const lanes of [1, 2, 4, 6, 9]) {
    const bytes = pattern(384 * 67 + 7);
    const sender = await wire.createTransfer(bytes, 'lane-loss.bin', { compact: true });
    const planner = api.create(sender, { lanes }), collector = wire.createCollector();
    let complete, pending = 0;
    for (let display = 0; display < 500 && !complete; display++) {
      const frames = planner.next().frames;
      for (let lane = frames.length - 1; lane >= 0; lane--) {
        if ((display === 0 && frames[lane].kind === 'manifest') || (lanes > 1 && lane % 2 === 0)) continue;
        if (lanes === 1 && display % 7 === 0) continue;
        const result = await collector.accept(frames[lane].bytes);
        if (result.kind === 'pending') pending++;
        if (result.kind === 'complete') { complete = result; break; }
      }
    }
    assert.ok(pending > 0);
    assert.equal(complete?.kind, 'complete');
    assert.deepEqual(Buffer.from(complete.bytes), Buffer.from(bytes));
  }
});

test('real targeted feedback can finish a partial file without sending already complete blocks', async () => {
  for (const lanes of [2, 4, 6, 9]) {
    const bytes = pattern(600 * 35 - 7), sender = await wire.createTransfer(bytes, 'target.bin', { compact: true, chunkBytes: 600 });
    const collector = wire.createCollector(), planner = api.create(sender, { lanes });
    await collector.accept(sender.manifestFrame());
    for (let index = 0; index < sender.total; index++) {
      if (![5, 12, 30, 33].includes(index)) await collector.accept(sender.frame(index));
    }
    const saved = planner.next().checkpoint;
    planner.next();
    const feedback = sender.acceptFeedback(collector.createFeedback());
    planner.applyFeedback(feedback);
    assert.equal(planner.restore(saved), false);
    let complete;
    const targeted = [];
    for (let display = 0; display < 6 && !complete; display++) {
      for (const frame of planner.next().frames) {
        if (frame.kind === 'target') targeted.push(frame.index);
        const result = await collector.accept(frame.bytes);
        if (result.kind === 'complete') { complete = result; break; }
      }
    }
    assert.deepEqual(targeted, [5, 12, 30, 33]);
    assert.deepEqual(Buffer.from(complete.bytes), Buffer.from(bytes));
    planner.applyFeedback(sender.acceptFeedback(collector.createFeedback()));
    assert.equal(planner.next().frames.length, 0);
    sender.dispose(); collector.dispose();
  }
});

test('invalid planning inputs do not create an unbounded or unusable source sequence', () => {
  for (const value of [null, {}, transfer(0), { ...transfer(3), blockCount: 0 },
    { ...transfer(3), frame: null }, { ...transfer(3), manifestFrame: undefined }, transfer(3, true, 0)]) {
    assert.throws(() => api.create(value), { name: 'TypeError' });
  }
  for (const options of [{ lanes: 0 }, { lanes: 10 }, { lanes: 1.5 }, { startIndex: NaN }, { initialManifest: 1 }, { interleave: 1 }]) {
    assert.throws(() => api.create(transfer(3), options), { name: 'TypeError' });
  }
  const planner = api.create(transfer(3));
  for (const feedback of [null, {}, { missingBlocks: [-1] }, { missingBlocks: [1] },
    { missingBlocks: [0], complete: true }, { missingBlocks: [0], repairTargets: {} }]) {
    assert.throws(() => planner.applyFeedback(feedback), { name: 'TypeError' });
  }
  for (const args of [[0], [1, 10], [1, 1, -1], [1, 1, 1.5]]) assert.equal(api.firstPassDisplays(...args), 0);
});

test('source interleaving rotates to the requested index and covers every partial-block source once', () => {
  const cases = [];
  for (const total of [1, 2, 31, 32, 33, 34, 63, 64, 65, 95, 96, 97]) {
    for (const startIndex of new Set([0, Math.min(31, total - 1), Math.min(32, total - 1), total - 1])) {
      for (const lanes of [1, 2]) cases.push({ total, startIndex, lanes });
    }
  }
  cases.push({ total: 67, startIndex: 31, lanes: 4 }, { total: 65, startIndex: 64, lanes: 6 },
    { total: 97, startIndex: 32, lanes: 9 });
  cases.push({ total: 27307, startIndex: 27306, lanes: 2 });
  for (const { total, startIndex, lanes } of cases) {
    const planner = api.create(transfer(total), { startIndex, lanes, initialManifest: false });
    assert.equal(planner.interleave, true);
    const sourceIndices = [];
    while (sourceIndices.length < total) {
      for (const frame of planner.next().frames) if (frame.kind === 'source') sourceIndices.push(frame.index);
    }
    assert.equal(sourceIndices[0], startIndex);
    assert.deepEqual(sourceIndices, referenceOrder(total, startIndex));
    assert.equal(new Set(sourceIndices).size, total);
  }
});

test('v2 stays sequential and explicit interleave:false preserves compact comparison mode', () => {
  for (const compact of [false, true]) {
    const planner = api.create(transfer(69, compact), { startIndex: 35, lanes: 2, interleave: false });
    assert.equal(planner.interleave, false);
    const indices = [];
    while (indices.length < 69) {
      for (const frame of planner.next().frames) if (frame.kind === 'source') indices.push(frame.index);
    }
    assert.deepEqual(indices, referenceOrder(69, 35, false));
  }
  assert.equal(api.create(transfer(69, false)).interleave, false);
});

test('interleaving reduces the repair tail for a deterministic contiguous burst, while targeted ACK restores equal losses', async context => {
  const bytes = pattern(384 * 32 * 8);
  async function simulate(interleave, withFeedback) {
    const sender = await wire.createTransfer(bytes, 'burst.bin', { compact: true });
    const planner = api.create(sender, { interleave }), collector = wire.createCollector();
    const firstPass = api.firstPassDisplays(sender.total, 1, sender.manifestInterval);
    for (let display = 0; display < firstPass; display++) {
      const frame = planner.next().frames[0];
      // 33 adjacent displays lose exactly 32 data symbols and one manifest.
      // The initial manifest was already received, so both modes lose equal information.
      if (display >= 35 && display < 68) continue;
      await collector.accept(frame.bytes);
    }
    assert.equal(collector.state.received, sender.total - 32);
    const incompleteBlocks = collector.state.missingCount;
    if (withFeedback) planner.applyFeedback(sender.acceptFeedback(collector.createFeedback()));
    let dataSymbols = 0, displays = 0, result;
    while (displays < 1000) {
      const frame = planner.next().frames[0];
      displays++;
      if (frame.kind !== 'manifest') dataSymbols++;
      result = await collector.accept(frame.bytes);
      if (result.kind === 'complete') break;
    }
    assert.equal(result.kind, 'complete');
    assert.deepEqual(Buffer.from(result.bytes), Buffer.from(bytes));
    sender.dispose(); collector.dispose();
    return { incompleteBlocks, dataSymbols, displays };
  }
  const sequential = await simulate(false, false), interleaved = await simulate(true, false);
  assert.equal(sequential.incompleteBlocks, 1);
  assert.equal(interleaved.incompleteBlocks, 8);
  assert.ok(interleaved.dataSymbols < sequential.dataSymbols);
  const feedbackSequential = await simulate(false, true), feedbackInterleaved = await simulate(true, true);
  assert.equal(feedbackSequential.dataSymbols, 32);
  assert.equal(feedbackInterleaved.dataSymbols, 32);
  context.diagnostic(JSON.stringify({ model: '8 full blocks; 33 adjacent displays lost; no later loss',
    sequential, interleaved, feedbackSequential, feedbackInterleaved }));
});
