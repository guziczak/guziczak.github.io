import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext, runInThisContext } from 'node:vm';
import { Worker as NodeWorker } from 'node:worker_threads';

const [coreSource, encoderSource, workerSource] = await Promise.all([
  'qr-core.js', 'qr-encoder.js', 'qr-encoder-worker.js'
].map(name => readFile(new URL(`../../assets/${name}`, import.meta.url), 'utf8')));
runInThisContext(coreSource, { filename: 'qr-core.js' });
const { WGQR } = globalThis;
const workerUrl = './assets/qr-encoder-worker.js?v=1';

function createEncoder({ Worker, encode = WGQR.encodeBytes, timeoutMs = 3000, url = workerUrl } = {}) {
  const browser = { Uint8Array, ArrayBuffer, Worker, setTimeout, clearTimeout };
  browser.window = browser;
  runInNewContext(encoderSource, browser, { filename: 'qr-encoder.js' });
  return browser.WGEncoder.create({ encode, workerUrl: url, timeoutMs });
}

function data(length, seed = 1) {
  const bytes = Uint8Array.from({ length }, (_, index) => (index * 73 + seed + Math.floor(index / 256)) % 256);
  bytes.set([0, 255, 239, 187, 191, 192, 128, 13, 10].slice(0, length));
  return bytes;
}

function assertRoundTrip(matrix, expected, level) {
  assert.equal(matrix.level, level);
  assert.equal(matrix.version, (matrix.size - 17) / 4);
  const scale = 3, side = (matrix.size + 8) * scale;
  const pixels = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let y = 0; y < matrix.size; y++) for (let x = 0; x < matrix.size; x++) {
    if (!matrix.data[y * matrix.size + x]) continue;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const offset = (((y + 4) * scale + dy) * side + (x + 4) * scale + dx) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 0;
    }
  }
  const decoded = WGQR.decodePixels(pixels, side, side, { inversionAttempts: 'dontInvert' });
  assert.ok(decoded, 'The generated matrix must be readable by the actual QR decoder');
  assert.deepEqual(decoded.bytes, expected);
}

function silentWorkers(instances) {
  return class {
    constructor() { this.messages = []; this.inputCopies = []; instances.push(this); }
    postMessage(message) {
      this.messages.push(structuredClone(message));
      this.inputCopies.push(...message.frames.map(frame => frame.bytes));
    }
    terminate() { this.terminated = true; }
    reply(matrices) { this.onmessage({ data: { id: this.messages.at(-1).id, matrices } }); }
  };
}

test('fallback copies input before returning, preserves byte mode and ECC, and clears its temporary buffers', async () => {
  const held = [], levels = [];
  const encoder = createEncoder({ encode(bytes, options) {
    held.push(bytes); levels.push(options.errorCorrectionLevel);
    return WGQR.encodeBytes(bytes, options);
  } });
  try {
    const first = data(384), second = data(640, 2);
    const expected = [first.slice(), second.slice()];
    const result = encoder.encodeBatch([{ bytes: first, errorCorrectionLevel: 'M' }, { bytes: second, errorCorrectionLevel: 'L' }]);
    first.fill(0); second.fill(0);
    const matrices = await result;
    assert.deepEqual(levels, ['M', 'L']); assert.equal(matrices.length, 2);
    assertRoundTrip(matrices[0], expected[0], 'M'); assertRoundTrip(matrices[1], expected[1], 'L');
    assert.ok(held.every(bytes => bytes.every(byte => byte === 0)), 'Copies must be cleared after successful encoding');
    const unchanged = data(70); const snapshot = unchanged.slice();
    const [matrix] = await encoder.encodeBatch([{ bytes: unchanged }]);
    assert.deepEqual(unchanged, snapshot); assertRoundTrip(matrix, snapshot, 'M');
  } finally { encoder.dispose(); }
});

// Execute the actual browser worker in a Node thread. The bridge only adapts
// importScripts/postMessage and audits input clearing plus output buffer transfer.
const threadWorkers = [];
class LocalEncoderWorker {
  constructor(url) {
    assert.equal(url, workerUrl);
    const script = new URL('../../assets/qr-encoder-worker.js', import.meta.url).href;
    this.audits = []; this.auditWaiters = [];
    threadWorkers.push(this);
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
      let transferred = 0, detached = false;
      globalThis.postMessage = (message, buffers = []) => {
        transferred = buffers.length;
        parentPort.postMessage(message, buffers);
        detached = buffers.every(buffer => buffer.byteLength === 0);
      };
      runInThisContext(readFileSync(new URL(script), 'utf8'));
      parentPort.on('message', request => {
        globalThis.onmessage({ data: request });
        parentPort.postMessage({ audit: {
          cleared: request.frames.every(frame => frame.bytes.every(byte => byte === 0)),
          transferred, detached
        } });
      });
    `, { eval: true });
    this.thread.on('message', message => {
      if (message.audit) {
        this.audits.push(message.audit);
        for (const resolve of this.auditWaiters.splice(0)) resolve();
      } else this.onmessage?.({ data: message });
    });
    this.thread.on('error', error => this.onerror?.({ error, preventDefault() {} }));
  }
  postMessage(message) { this.thread.postMessage(message); }
  terminate() { void this.thread.terminate(); }
  async audit(index) {
    while (!this.audits[index]) await new Promise(resolve => this.auditWaiters.push(resolve));
    return this.audits[index];
  }
}

test('actual worker generates byte-exact matrices in order, transfers their buffers, and retains no request bytes', async () => {
  const before = threadWorkers.length;
  let fallbackCalls = 0;
  const encoder = createEncoder({ Worker: LocalEncoderWorker, encode() { fallbackCalls++; throw new Error('Unexpected fallback'); } });
  try {
    const storage = data(700, 3);
    const first = storage.subarray(13, 397), second = storage.subarray(18, 658);
    const expected = [first.slice(), second.slice()];
    const pending = encoder.encodeBatch([{ bytes: first, errorCorrectionLevel: 'M' }, { bytes: second, errorCorrectionLevel: 'L' }]);
    storage.fill(0);
    const matrices = await pending;
    assertRoundTrip(matrices[0], expected[0], 'M'); assertRoundTrip(matrices[1], expected[1], 'L');
    assert.deepEqual(await threadWorkers[before].audit(0), { cleared: true, transferred: 2, detached: true });
    const next = data(600, 4);
    const [matrix] = await encoder.encodeBatch([{ bytes: next, errorCorrectionLevel: 'M' }]);
    assertRoundTrip(matrix, next, 'M');
    assert.deepEqual(await threadWorkers[before].audit(1), { cleared: true, transferred: 1, detached: true });
    assert.equal(fallbackCalls, 0); assert.equal(threadWorkers.length, before + 1, 'The healthy worker should be reused');
  } finally { encoder.dispose(); }
});

test('one pending batch is enforced; reset/dispose reject it and stale replies cannot affect a replacement', async () => {
  const workers = []; let fallbacks = 0;
  const encoder = createEncoder({ Worker: silentWorkers(workers), encode(...args) { fallbacks++; return WGQR.encodeBytes(...args); } });
  try {
    const source = data(128);
    const pending = encoder.encodeBatch([{ bytes: source }]);
    const cancelled = assert.rejects(pending, error => error.name === 'AbortError' && error.code === 'ENCODER_RESET');
    await assert.rejects(encoder.encodeBatch([{ bytes: source }]), { code: 'ENCODER_BUSY' });
    assert.equal(workers[0].messages.length, 1);
    encoder.reset(); await cancelled;
    assert.equal(workers[0].terminated, true); assert.ok(workers[0].inputCopies.every(bytes => bytes.every(byte => byte === 0)));
    const next = encoder.encodeBatch([{ bytes: source }]);
    const stale = WGQR.encodeBytes(source);
    workers[0].reply([stale]); workers[0].onerror({ preventDefault() {} });
    assert.ok(stale.data.every(byte => byte === 0)); assert.equal(workers[1].terminated, undefined);
    workers[1].reply([WGQR.encodeBytes(source)]);
    assertRoundTrip((await next)[0], source, 'M'); assert.equal(fallbacks, 0);
    const final = encoder.encodeBatch([{ bytes: source }]);
    const stopped = assert.rejects(final, error => error.name === 'AbortError' && error.code === 'ENCODER_DISPOSED');
    encoder.dispose(); await stopped;
    assert.equal(workers[1].terminated, true);
    encoder.reset(); await assert.rejects(encoder.encodeBatch([{ bytes: source }]), { code: 'ENCODER_DISPOSED' });
    assert.equal(fallbacks, 0);
  } finally { encoder.dispose(); }
});

test('an immediate reset also cancels a fallback before the synchronous encoder reads its bytes', async () => {
  let calls = 0;
  const encoder = createEncoder({ encode(...args) { calls++; return WGQR.encodeBytes(...args); } });
  try {
    const pending = encoder.encodeBatch([{ bytes: data(100) }]);
    const cancelled = assert.rejects(pending, { code: 'ENCODER_RESET' });
    encoder.reset(); await cancelled; assert.equal(calls, 0);
    const source = data(100, 2); assertRoundTrip((await encoder.encodeBatch([{ bytes: source }]))[0], source, 'M');
    assert.equal(calls, 1);
  } finally { encoder.dispose(); }
});

test('worker startup, posting, runtime, deserialization and explicit failures retry the same retained bytes', async t => {
  for (const kind of ['constructor', 'post', 'error', 'messageerror', 'failed']) await t.test(kind, async () => {
    let created = 0, terminated = 0, calls = 0; const held = [];
    const Worker = class {
      constructor() { created++; if (kind === 'constructor') throw new Error('blocked'); }
      postMessage(request) {
        if (kind === 'post') throw new Error('clone failed');
        queueMicrotask(() => {
          if (kind === 'error') this.onerror({ preventDefault() {} });
          else if (kind === 'messageerror') this.onmessageerror();
          else this.onmessage({ data: { id: request.id, failed: true } });
        });
      }
      terminate() { terminated++; }
    };
    const encoder = createEncoder({ Worker, encode(bytes, options) { calls++; held.push(bytes); return WGQR.encodeBytes(bytes, options); } });
    try {
      const source = data(120, 8), expected = source.slice();
      const first = encoder.encodeBatch([{ bytes: source, errorCorrectionLevel: 'L' }]); source.fill(0);
      assertRoundTrip((await first)[0], expected, 'L');
      const next = data(90); await encoder.encodeBatch([{ bytes: next }]);
      assert.equal(calls, 2); assert.equal(created, 1, 'Known worker failure must not stall every later batch');
      assert.equal(terminated, kind === 'constructor' ? 0 : 1);
      assert.ok(held.every(bytes => bytes.every(byte => byte === 0)));
    } finally { encoder.dispose(); }
  });
});

test('a silent worker times out once and falls back without losing the batch', async () => {
  const workers = []; let calls = 0;
  const encoder = createEncoder({ Worker: silentWorkers(workers), timeoutMs: 5,
    encode(...args) { calls++; return WGQR.encodeBytes(...args); } });
  try {
    const source = data(180);
    assertRoundTrip((await encoder.encodeBatch([{ bytes: source }]))[0], source, 'M');
    assert.equal(workers[0].terminated, true); assert.equal(calls, 1);
    encoder.reset(); await encoder.encodeBatch([{ bytes: source }]);
    assert.equal(workers.length, 1); assert.equal(calls, 2);
  } finally { encoder.dispose(); }
});

test('malformed worker matrices are discarded and only validated fallback matrices reach the caller', async t => {
  const source = data(90), correct = WGQR.encodeBytes(source);
  const corruptions = {
    size: matrix => ({ ...matrix, size: 20 }),
    lattice: matrix => ({ ...matrix, size: 22, data: new Uint8Array(22 * 22) }),
    oversized: matrix => ({ ...matrix, size: 181, data: new Uint8Array(181 * 181) }),
    length: matrix => ({ ...matrix, data: new Uint8Array(matrix.data.length - 1) }),
    type: matrix => ({ ...matrix, data: new Uint8ClampedArray(matrix.data) }),
    nonbinary: matrix => { matrix.data[0] = 2; return matrix; },
    level: matrix => ({ ...matrix, level: 'L' }),
    version: matrix => ({ ...matrix, version: matrix.version + 1 }),
    missing: () => null
  };
  for (const [name, corrupt] of Object.entries(corruptions)) await t.test(name, async () => {
    const workers = []; let calls = 0;
    const encoder = createEncoder({ Worker: silentWorkers(workers), encode(...args) { calls++; return WGQR.encodeBytes(...args); } });
    try {
      const pending = encoder.encodeBatch([{ bytes: source }]);
      workers[0].reply([corrupt({ ...correct, data: correct.data.slice() })]);
      const [matrix] = await pending;
      assert.equal(calls, 1); assert.equal(workers[0].terminated, true);
      assert.deepEqual(matrix.data, correct.data); assert.equal(matrix.size, correct.size); assert.equal(matrix.level, 'M');
    } finally { encoder.dispose(); }
  });
});

test('wrong response counts fall back, while an unrelated request id cannot satisfy the active batch', async () => {
  const workers = [];
  const encoder = createEncoder({ Worker: silentWorkers(workers) });
  try {
    const source = data(120); const pending = encoder.encodeBatch([{ bytes: source }]);
    const unrelated = WGQR.encodeBytes(source);
    workers[0].onmessage({ data: { id: workers[0].messages[0].id + 1, matrices: [unrelated] } });
    assert.ok(unrelated.data.every(byte => byte === 0)); assert.equal(workers[0].terminated, undefined);
    workers[0].reply([]);
    assertRoundTrip((await pending)[0], source, 'M'); assert.equal(workers[0].terminated, true);
  } finally { encoder.dispose(); }
});

test('invalid requests are rejected before worker creation and never occupy the queue', async () => {
  const workers = []; const encoder = createEncoder({ Worker: silentWorkers(workers) });
  try {
    const cases = [
      [null, 'INVALID_INPUT'], [[], 'INVALID_INPUT'], [[{}, {}, {}], 'INVALID_INPUT'],
      [[{ bytes: new Uint8ClampedArray(8) }], 'INVALID_INPUT'], [[{ bytes: new Uint8Array() }], 'EMPTY_INPUT'],
      [[{ bytes: data(30), errorCorrectionLevel: 'H' }], 'INVALID_OPTIONS'],
      [[{ bytes: new Uint8Array(2332), errorCorrectionLevel: 'M' }], 'INPUT_TOO_LARGE'],
      [[{ bytes: new Uint8Array(2954) }], 'INPUT_TOO_LARGE']
    ];
    for (const [batch, code] of cases) await assert.rejects(encoder.encodeBatch(batch), { code });
    assert.equal(workers.length, 0);
    const source = data(70); const pending = encoder.encodeBatch([{ bytes: source }]);
    workers[0].reply([WGQR.encodeBytes(source)]); assertRoundTrip((await pending)[0], source, 'M');
    for (const timeoutMs of [0, -1, 1.5, 10001, Infinity]) assert.throws(() => createEncoder({ timeoutMs }), /ustawienia/);
  } finally { encoder.dispose(); }
});

test('fallback failures reject without retaining partial matrices or payload copies', async () => {
  let held, first; let calls = 0;
  const encoder = createEncoder({ encode(bytes, options) {
    calls++; held = bytes;
    if (calls === 1) { first = WGQR.encodeBytes(bytes, options); return first; }
    throw Object.assign(new Error('Encoder failed'), { code: 'CORE_FAILURE' });
  } });
  try {
    await assert.rejects(encoder.encodeBatch([{ bytes: data(60) }, { bytes: data(90) }]), { code: 'CORE_FAILURE' });
    assert.ok(first.data.every(byte => byte === 0)); assert.ok(held.every(byte => byte === 0));
  } finally { encoder.dispose(); }
  const invalid = createEncoder({ encode: () => ({ size: 21, data: new Uint8Array(441).fill(2), level: 'M', version: 1 }) });
  try { await assert.rejects(invalid.encodeBatch([{ bytes: data(20) }]), { code: 'ENCODER_INVALID_MATRIX' }); }
  finally { invalid.dispose(); }
});

test('the worker reports only failure metadata and clears an invalid request without calling the core encoder', () => {
  const replies = []; let calls = 0;
  const browser = { Uint8Array, ArrayBuffer, WGQR: { encodeBytes() { calls++; throw new Error('Sensitive error text'); } },
    importScripts(name) { assert.equal(name, 'qr-core.js?v=3'); }, postMessage(reply) { replies.push(reply); } };
  browser.self = browser;
  runInNewContext(workerSource, browser, { filename: 'qr-encoder-worker.js' });
  const bytes = data(60);
  browser.onmessage({ data: { id: 7, frames: [{ bytes, errorCorrectionLevel: 'H' }] } });
  assert.equal(calls, 0); assert.ok(bytes.every(byte => byte === 0));
  assert.deepEqual(JSON.parse(JSON.stringify(replies)), [{ id: 7, failed: true }]);
});
