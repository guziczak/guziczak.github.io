import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

const [coreSource, calibrationSource, viewSource] = await Promise.all([
  'qr-core.js', 'qr-calibration.js', 'qr-calibration-view.js'
].map(name => readFile(new URL(`../../assets/${name}`, import.meta.url), 'utf8')));
const browser = createContext({ TextEncoder, crypto: webcrypto }, {
  codeGeneration: { strings: false, wasm: false }
});
for (const source of [coreSource, calibrationSource, viewSource]) runInContext(source, browser, { timeout: 3000 });
const { WGQR, WGCalibration: calibration, WGCalibrationView: presentation } = browser;
const plain = value => JSON.parse(JSON.stringify(value));
const allCells = model => model.groups.flatMap(group => group.layouts.flatMap(layout => layout.cells));
const cellAt = (model, index) => allCells(model).find(cell => cell.index === index);

function observeProfile(sender, observer, index, accept = () => true) {
  const profile = sender.profiles[index];
  const count = profile.fps * 4 * (profile.lanes || sender.lanes);
  for (let sequence = 0; sequence < count; sequence++) {
    if (accept(sequence)) observer.accept(sender.frame(index, sequence), index * 4000 + sequence);
  }
}

test('initial largest-grid setup leaves the complete plan pending with distinct portrait and landscape rows', () => {
  for (const extended of [false, true]) {
    const sender = calibration.create({ compareLayouts: true, extended, large: true });
    const observer = calibration.createObserver(), view = presentation.create();
    assert.equal(view.compute(observer.state), null);
    observer.accept(sender.alignmentFrame(0, sender.alignmentIndex, true), 0);
    const state = observer.state, model = view.compute(state);
    assert.equal(state.setup, true);
    assert.equal(state.latestMeasurementIndex, -1);
    assert.equal(model.phase, 'setup');
    assert.equal(model.current.index, extended ? 30 : 18);
    assert.equal(model.current.state, 'pending');
    assert.equal(model.current.active, true);
    assert.equal(model.measuredProfiles, 0);
    assert.equal(model.totalProfiles, extended ? 40 : 24);
    assert.deepEqual(plain(model.counts), { pending: model.totalProfiles, running: 0, passed: 0, failed: 0 });
    assert.deepEqual(plain(model.groups.map(group => group.chunkBytes)), [384, 600]);
    for (const group of model.groups) {
      assert.deepEqual(plain(group.frequencies), extended ? [2, 5, 10, 15, 20] : [2, 5, 10]);
      assert.deepEqual(plain(group.layouts.map(layout => layout.key)), ['1x1', '2x1', '1x2', '2x2']);
      assert.deepEqual(plain(group.layouts.map(layout => layout.lanes)), [1, 2, 2, 4]);
      for (const layout of group.layouts) {
        assert.deepEqual(plain(layout.cells.map(cell => cell.fps)), plain(group.frequencies));
        assert.ok(layout.cells.every(cell => cell.state === 'pending' && !cell.closed && cell.received === 0));
      }
    }
  }
});

test('live reads revise the model; coverage passes only after the profile closes and missing profiles fail', () => {
  const sender = calibration.create({ compareLayouts: true });
  const observer = calibration.createObserver(), view = presentation.create();
  observer.accept(sender.alignmentFrame(0, sender.alignmentIndex, true), 0);
  const setup = view.compute(observer.state);
  observer.accept(sender.alignmentFrame(0, 0), 1);
  let model = view.compute(observer.state);
  assert.equal(model.phase, 'settling');
  assert.equal(model.current.index, 0);
  assert.equal(model.setup, false);
  assert.equal(model.counts.pending, 24);
  assert.notEqual(model.revision, setup.revision);

  observer.accept(sender.frame(0, 0), 10);
  model = view.compute(observer.state);
  assert.equal(model.phase, 'measuring');
  assert.equal(model.current.state, 'running');
  assert.equal(model.current.received, 1);
  assert.equal(model.current.bytesPerSecond, 96);
  const firstRead = model.revision;
  observer.accept(sender.frame(0, 0), 11);
  assert.equal(view.compute(observer.state).revision, firstRead, 'A duplicate does not redraw fabricated progress.');
  observer.accept(sender.frame(0, 1), 12);
  assert.notEqual(view.compute(observer.state).revision, firstRead, 'A new read within this same profile is visible.');

  observeProfile(sender, observer, 0);
  model = view.compute(observer.state);
  assert.equal(model.current.coverage, 100);
  assert.equal(model.current.closed, false);
  assert.equal(model.current.state, 'running');
  assert.equal(model.counts.passed, 0);
  observer.accept(sender.alignmentFrame(0, 1), 4100);
  model = view.compute(observer.state);
  assert.equal(cellAt(model, 0).state, 'passed');
  assert.equal(cellAt(model, 0).closed, true);
  assert.equal(model.current.state, 'pending');
  assert.deepEqual(plain(model.counts), { pending: 23, running: 0, passed: 1, failed: 0 });

  observer.accept(sender.frame(1, 0), 4200);
  observer.accept(sender.alignmentFrame(0, 3), 13000);
  model = view.compute(observer.state);
  assert.equal(model.current.index, 3);
  assert.equal(cellAt(model, 1).state, 'failed');
  assert.equal(cellAt(model, 1).received, 1);
  assert.equal(cellAt(model, 1).missing, 19);
  assert.equal(cellAt(model, 2).state, 'failed');
  assert.equal(cellAt(model, 2).received, 0);
  assert.deepEqual(plain(model.counts), { pending: 21, running: 0, passed: 1, failed: 2 });

  observer.accept(sender.endFrame(), 120000);
  model = view.compute(observer.state);
  assert.equal(model.phase, 'finished');
  assert.equal(model.ended, true);
  assert.equal(model.current.active, false);
  assert.deepEqual(plain(model.counts), { pending: 0, running: 0, passed: 1, failed: 23 });
  assert.ok(allCells(model).every(cell => cell.closed));
});

test('setup can enter profile zero, while late setup, settle and older measurement frames cannot rewind the map', () => {
  const sender = calibration.create({ compareLayouts: true });
  const view = presentation.create();
  const direct = calibration.createObserver();
  direct.accept(sender.alignmentFrame(0, sender.alignmentIndex, true), 0);
  direct.accept(sender.frame(0, 0), 1);
  assert.equal(direct.state.setup, false);
  assert.equal(direct.state.latestMeasurementIndex, 0);
  assert.equal(direct.state.currentIndex, 0);
  assert.equal(view.compute(direct.state).phase, 'measuring');

  const observer = calibration.createObserver();
  observer.accept(sender.alignmentFrame(0, sender.alignmentIndex, true), 0);
  observer.accept(sender.alignmentFrame(0, 0), 1);
  observer.accept(sender.alignmentFrame(0, sender.alignmentIndex, true), 2);
  assert.equal(observer.state.setup, false, 'A delayed setup cannot restore preview after settling began.');
  assert.equal(observer.state.currentIndex, 0);
  observer.accept(sender.frame(0, 0), 3);
  observer.accept(sender.alignmentFrame(0, 3), 4);
  const settled = view.compute(observer.state);
  observer.accept(sender.alignmentFrame(0, 1), 5);
  observer.accept(sender.alignmentFrame(0, sender.alignmentIndex, true), 6);
  assert.equal(observer.state.currentIndex, 3);
  assert.equal(view.compute(observer.state).revision, settled.revision);
  observer.accept(sender.frame(0, 1), 7);
  const lateRead = view.compute(observer.state);
  assert.equal(lateRead.current.index, 3);
  assert.equal(lateRead.phase, 'settling');
  assert.equal(cellAt(lateRead, 0).received, 2, 'Late valid data can complete an older result without rewinding its status.');
  assert.equal(cellAt(lateRead, 0).state, 'failed');

  const lateJoin = calibration.createObserver();
  lateJoin.accept(sender.alignmentFrame(0, 3), 0);
  lateJoin.accept(sender.alignmentFrame(0, 1), 1);
  lateJoin.accept(sender.frame(0, 0), 2);
  assert.equal(lateJoin.state.currentIndex, 3);
  assert.equal(lateJoin.state.phase, 'alignment');
  assert.equal(view.compute(lateJoin.state).counts.failed, 3);
  lateJoin.accept(sender.alignmentFrame(0, sender.alignmentIndex), 3);
  assert.equal(lateJoin.state.currentIndex, sender.alignmentIndex,
    'Plain settling for a later profile still permits joining after completely missed profiles.');
});

test('real byte-mode encoder gives exact payload density and is called at most twice per session', () => {
  for (const ecc of ['M', 'L']) {
    for (const large of [false, true]) {
      const sender = calibration.create({ compareLayouts: true, extended: true, ecc, large });
      const observer = calibration.createObserver(), calls = [];
      const view = presentation.create({ encodeBytes(payload, options) {
        const qr = WGQR.encodeBytes(payload, options);
        calls.push({ payload, options, qr });
        return qr;
      } });
      observer.accept(sender.alignmentFrame(0, sender.alignmentIndex, true), 0);
      const model = view.compute(observer.state);
      assert.equal(calls.length, 2, 'Forty cells require only two distinct QR densities.');
      for (const group of model.groups) {
        const index = sender.profiles.findIndex(profile => profile.chunkBytes === group.chunkBytes);
        const frame = sender.frame(index, 0);
        const qr = WGQR.encodeBytes(frame, { errorCorrectionLevel: ecc });
        assert.equal(group.payloadBytes, frame.length);
        assert.equal(group.modules, qr.size);
        assert.equal(group.qrVersion, qr.version);
        assert.equal(group.modules, 17 + 4 * group.qrVersion, 'Module count excludes the surrounding quiet zone.');
        for (const layout of group.layouts) {
          for (const cell of layout.cells) assert.equal(cell.modules, qr.size);
        }
        frame.fill(0); qr.data.fill(0);
      }
      assert.ok(calls.every(call => call.options.errorCorrectionLevel === ecc));
      assert.ok(calls.every(call => call.payload.every(byte => byte === 0) && call.qr.data.every(byte => byte === 0)),
        'Only scalar dimensions survive; synthetic inputs and temporary matrices are cleared.');
      observeProfile(sender, observer, 0);
      view.compute(observer.state);
      view.compute(observer.state, { fromImages: true });
      observer.accept(sender.alignmentFrame(0, 10), 60000);
      view.compute(observer.state);
      observer.accept(sender.endFrame(), 200000);
      view.compute(observer.state);
      assert.equal(calls.length, 2, 'Live updates, layout changes and image mode share the session density cache.');
      view.reset();
      view.compute(observer.state);
      assert.equal(calls.length, 4, 'Explicit reset discards only cached scalar dimensions.');
    }
  }
});

test('images preserve packet coverage while exposing no measured byte rate or recommendation', () => {
  const sender = calibration.create({ grid: { columns: 3, rows: 3 }, ecc: 'L', extended: true });
  const observer = calibration.createObserver(), view = presentation.create();
  observeProfile(sender, observer, 9);
  observer.accept(sender.endFrame(), 50000);
  assert.equal(observer.state.best.bytesPerSecond, 108000);
  const camera = view.compute(observer.state);
  const images = view.compute(observer.state, { fromImages: true });
  assert.equal(camera.rateVerified, true);
  assert.equal(images.rateVerified, false);
  assert.equal(images.fromImages, true);
  assert.notEqual(images.revision, camera.revision);
  assert.equal(images.counts.passed, 1);
  assert.equal(images.counts.failed, 9);
  assert.equal(images.current.received, 720);
  assert.equal(images.current.coverage, 100);
  assert.equal(images.current.bytesPerSecond, null);
  for (const cell of allCells(images)) {
    assert.equal(cell.bytesPerSecond, null);
    assert.equal(cell.minBytesPerSecond, null);
    assert.equal(cell.maxBytesPerSecond, null);
    assert.ok(cell.perSecond.every(window => window.bytesPerSecond === null));
  }
  assert.equal(images.best, undefined);
  assert.equal(images.fastest, undefined);
  assert.equal(images.recommendation, undefined);
  assert.equal(observer.state.best.bytesPerSecond, 108000, 'Presentation never mutates the protocol snapshot.');
});

test('legacy one- and two-QR sessions keep the same map semantics without setup or guessed success', () => {
  for (const extended of [false, true]) {
    const sender = calibration.create({ lanes: extended ? 2 : 1, extended });
    const observer = calibration.createObserver(), view = presentation.create();
    observeProfile(sender, observer, 1, sequence => sequence < 3);
    let model = view.compute(observer.state);
    assert.equal(model.setup, false);
    assert.equal(model.phase, 'measuring');
    assert.equal(model.current.state, 'running');
    assert.equal(model.counts.failed, 1, 'A later first read closes the entirely missed first profile.');
    assert.equal(model.groups[0].layouts[0].key, extended ? '2x1' : '1x1');
    observer.accept(sender.endFrame(), 50000);
    model = view.compute(observer.state);
    assert.equal(model.counts.passed, 0, 'Legacy minimum-sample feedback is not a full-coverage pass.');
    assert.equal(model.counts.failed, sender.profiles.length);
  }
});

test('reset and new sessions replace the cached plan; models cannot mutate snapshots or later density output', () => {
  let encodes = 0;
  const view = presentation.create({ encodeBytes(...args) { encodes++; return WGQR.encodeBytes(...args); } });
  const first = calibration.create({ compareLayouts: true });
  const observer = calibration.createObserver();
  observer.accept(first.frame(0, 0), 0);
  const state = observer.state, original = plain(state);
  const model = view.compute(state), firstKey = model.key;
  assert.equal(encodes, 2);
  model.groups[0].modules = 1;
  model.groups[0].layouts[0].grid.columns = 3;
  model.groups[0].layouts[0].cells[0].perSecond[0].received = 999;
  model.current.grid.rows = 3;
  assert.deepEqual(plain(state), original);
  const fresh = view.compute(state);
  assert.notEqual(fresh.groups[0].modules, 1);
  assert.equal(fresh.groups[0].layouts[0].grid.columns, 1);
  assert.equal(fresh.current.grid.rows, 1);
  assert.equal(fresh.current.perSecond[0].received, 1);
  assert.equal(encodes, 2);

  observer.reset();
  assert.equal(view.compute(observer.state), null);
  const second = calibration.create({ grid: { columns: 1, rows: 3 }, large: true, ecc: 'L' });
  observer.accept(second.alignmentFrame(0, 0, true), 0);
  const changed = view.compute(observer.state);
  assert.notEqual(changed.key, firstKey);
  assert.equal(changed.groups[0].layouts.length, 1);
  assert.equal(changed.groups[0].layouts[0].key, '1x3');
  assert.equal(changed.groups[0].payloadBytes, 476);
  assert.equal(changed.current.state, 'pending');
  assert.equal(encodes, 4);
  assert.doesNotMatch(viewSource, /\b(?:document|fetch|XMLHttpRequest|setTimeout|setInterval)\b|\bnew\s+(?:Worker|WebSocket)\b/);
});

test('v4 all-grid map has 90 or 150 pending cells and describes the actual short setup QR separately', () => {
  for (const extended of [false, true]) {
    const sender = calibration.create({ allLayouts: true, extended, large: true, ecc: 'M' });
    const observer = calibration.createObserver();
    const calls = [];
    const view = presentation.create({ encodeBytes(payload, options) {
      const qr = WGQR.encodeBytes(payload, options);
      calls.push({ payload, qr });
      return qr;
    } });
    const setup = sender.alignmentFrame(14, sender.alignmentIndex, true);
    observer.accept(setup, 0);
    const model = view.compute(observer.state);
    const actual = WGQR.encodeBytes(setup, { errorCorrectionLevel: 'M' });
    assert.equal(model.allLayouts, true);
    assert.equal(model.phase, 'setup');
    assert.equal(model.current.index, extended ? 140 : 84);
    assert.deepEqual(plain(model.current.grid), { columns: 5, rows: 3 });
    assert.equal(model.current.lanes, 15);
    assert.equal(model.current.chunkBytes, 0);
    assert.equal(model.current.payloadBytes, 40);
    assert.equal(model.current.headerOnly, true);
    assert.equal(model.current.modules, actual.size);
    assert.equal(model.current.qrVersion, actual.version);
    assert.equal(model.current.plannedChunkBytes, 384);
    assert.equal(model.current.plannedModules, model.groups[0].modules);
    assert.ok(model.current.modules < model.current.plannedModules);
    assert.equal(model.totalProfiles, extended ? 150 : 90);
    assert.deepEqual(plain(model.counts), { pending: model.totalProfiles, running: 0, passed: 0, failed: 0 });
    assert.equal(allCells(model).length, model.totalProfiles);
    assert.equal(model.groups.length, 2);
    for (const group of model.groups) {
      assert.equal(group.layouts.length, 15);
      assert.equal(group.layouts.at(-1).key, '5x3');
      assert.deepEqual(plain(group.layouts.map(layout => layout.grid)), plain(calibration.allGrids));
      assert.deepEqual(plain(group.frequencies), extended ? [2, 5, 10, 15, 20] : [2, 5, 10]);
      for (const layout of group.layouts) {
        assert.equal(layout.cells.length, group.frequencies.length);
        assert.ok(layout.cells.every(cell => !cell.closed && cell.state === 'pending' && cell.payloadBytes > 40));
      }
    }
    assert.equal(calls.length, 3, 'Two measurement densities plus one small header density cover the full plan.');
    assert.ok(calls.every(call => call.qr.data.every(byte => byte === 0) && call.payload.every(byte => byte === 0)));
    observer.accept(sender.alignmentFrame(0, 0), 1);
    const settling = view.compute(observer.state);
    assert.equal(settling.phase, 'settling');
    assert.equal(settling.current.headerOnly, undefined);
    assert.equal(settling.current.chunkBytes, 384);
    assert.equal(settling.current.payloadBytes, 476);
    assert.equal(settling.current.modules, settling.groups[0].modules);
    observer.accept(sender.frame(0, 0), 2);
    view.compute(observer.state);
    view.compute(observer.state, { fromImages: true });
    assert.equal(calls.length, 3, 'Changing phase or source does not encode any of the 150 cells again.');
    setup.fill(0); actual.data.fill(0);
  }
});

test('v4 END closes the full plan, including every unreadable dense grid, without inventing failed reads during setup', () => {
  const sender = calibration.create({ allLayouts: true, extended: true, large: true });
  const observer = calibration.createObserver(), view = presentation.create();
  observer.accept(sender.alignmentFrame(0, sender.alignmentIndex, true), 0);
  assert.equal(view.compute(observer.state).counts.failed, 0);
  observeProfile(sender, observer, 0);
  let model = view.compute(observer.state);
  assert.equal(model.counts.passed, 0); assert.equal(model.counts.running, 1);
  assert.equal(model.counts.pending, 149);
  observer.accept(sender.endFrame(), 800000);
  model = view.compute(observer.state);
  assert.deepEqual(plain(model.counts), { pending: 0, running: 0, passed: 1, failed: 149 });
  for (const group of model.groups) {
    for (const key of ['3x2', '4x2', '5x3']) {
      const layout = group.layouts.find(item => item.key === key);
      assert.ok(layout.cells.every(cell => cell.closed && cell.state === 'failed'
        && cell.received === 0 && cell.missing === cell.expected));
    }
  }
  assert.equal(model.current.index, 149);
  assert.equal(model.current.state, 'failed');
  assert.equal(model.current.headerOnly, undefined);
  const selected = sender.acceptFeedback(observer.createFeedback());
  assert.deepEqual([selected.grid.columns, selected.grid.rows, selected.allLayouts], [1, 1, true]);
  const images = view.compute(observer.state, { fromImages: true });
  assert.equal(images.rateVerified, false);
  assert.ok(allCells(images).every(cell => cell.bytesPerSecond === null));
});

test('v6 maps include 5×4 and only landscape layouts, including all unreadable profiles after END', () => {
  for (const options of [
    { allLayouts: true, extended: false },
    { allLayouts: true, extended: true },
    { compareLayouts: true, extended: true }
  ]) {
    const sender = calibration.create({ ...options, landscapeOnly: true, large: true });
    const observer = calibration.createObserver();
    let encodes = 0;
    const view = presentation.create({ encodeBytes(...args) { encodes++; return WGQR.encodeBytes(...args); } });
    const setup = sender.alignmentFrame(0, sender.alignmentIndex, true);
    observer.accept(setup, 0);
    let model = view.compute(observer.state);
    const grids = options.allLayouts ? calibration.landscapeGrids : calibration.landscapeComparedGrids;
    const count = grids.length * (options.extended ? 10 : 6);
    assert.equal(model.landscapeOnly, true);
    assert.equal(model.totalProfiles, count);
    assert.equal(allCells(model).length, count);
    assert.deepEqual(plain(model.counts), { pending: count, running: 0, passed: 0, failed: 0 });
    assert.equal(model.current.headerOnly, true);
    assert.equal(model.current.payloadBytes, 40);
    assert.equal(model.current.chunkBytes, 0);
    assert.equal(model.current.lanes, options.allLayouts ? 20 : 6);
    if (options.allLayouts) {
      assert.equal(count, options.extended ? 110 : 66);
      assert.deepEqual(plain(model.current.grid), { columns: 5, rows: 4 });
    }
    const actual = WGQR.encodeBytes(setup, { errorCorrectionLevel: 'M' });
    assert.equal(model.current.modules, actual.size);
    actual.data.fill(0); setup.fill(0);
    for (const group of model.groups) {
      assert.deepEqual(plain(group.layouts.map(layout => layout.grid)), plain(grids));
      assert.ok(group.layouts.every(layout => layout.lanes === 1 || layout.grid.columns > layout.grid.rows));
      assert.ok(group.layouts.every(layout => !['1x2', '1x3', '2x2', '2x3', '3x3'].includes(layout.key)));
    }
    observeProfile(sender, observer, 0);
    model = view.compute(observer.state);
    assert.equal(model.current.state, 'running');
    assert.equal(model.current.headerOnly, undefined);
    observer.accept(sender.endFrame(), 600000);
    model = view.compute(observer.state);
    assert.deepEqual(plain(model.counts), { pending: 0, running: 0, passed: 1, failed: count - 1 });
    assert.ok(allCells(model).filter(cell => cell.lanes > 1).every(cell => cell.closed
      && cell.state === 'failed' && cell.received === 0 && cell.missing === cell.expected));
    assert.equal(encodes, 3, 'Landscape filtering does not add any QR dimension encodes.');
    const images = view.compute(observer.state, { fromImages: true });
    assert.equal(images.landscapeOnly, true); assert.equal(images.rateVerified, false);
    assert.ok(allCells(images).every(cell => cell.bytesPerSecond === null));
    const selected = sender.acceptFeedback(observer.createFeedback());
    assert.deepEqual([selected.grid.columns, selected.grid.rows, selected.landscapeOnly], [1, 1, true]);
  }
});

test('recorded v5 plans still render ten layouts and never acquire the new 5×4 row', async () => {
  const references = JSON.parse(await readFile(new URL('./qr-calibration-v5-fixtures.json', import.meta.url), 'utf8'));
  for (const reference of references.cases.filter(item => item.options.allLayouts)) {
    const observer = calibration.createObserver(), view = presentation.create();
    observer.accept(new Uint8Array(Buffer.from(reference.setup, 'base64')), 0);
    let model = view.compute(observer.state);
    assert.equal(model.landscapeOnly, true);
    assert.equal(model.totalProfiles, reference.options.extended ? 100 : 60);
    assert.equal(model.current.lanes, 15);
    assert.deepEqual(plain(model.current.grid), { columns: 5, rows: 3 });
    assert.equal(model.current.headerOnly, true);
    assert.equal(model.counts.pending, reference.profileCount);
    for (const group of model.groups) {
      assert.equal(group.layouts.length, 10);
      assert.equal(group.layouts.at(-1).key, '5x3');
      assert.ok(group.layouts.every(layout => layout.grid.rows <= 3));
    }
    observer.accept(new Uint8Array(Buffer.from(reference.end, 'base64')), 600000);
    model = view.compute(observer.state);
    assert.deepEqual(plain(model.counts), { pending: 0, running: 0, passed: 0, failed: reference.profileCount });
  }
});
