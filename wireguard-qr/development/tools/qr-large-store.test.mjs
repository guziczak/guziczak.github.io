import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm, unlink, open as openFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { createHash, webcrypto } from 'node:crypto';
import { runInThisContext } from 'node:vm';
import { createDiskBackend } from './qr-large-store-fs.mjs';

const source = await readFile(new URL('../../assets/qr-large-store.js', import.meta.url), 'utf8');
const SEGMENT = 2 * 1024 * 1024;
const MAX = 200 * 1024 * 1024;
const COPY = 256 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function load(backend, overrides = {}) {
  const previous = globalThis.window;
  const browser = { navigator: { storage: backend.storage, locks: backend.locks }, crypto: webcrypto, ...overrides };
  globalThis.window = browser;
  try { runInThisContext(source, { filename: 'qr-large-store.js' }); }
  finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
  return browser.WGLargeStore;
}
function descriptor(size = SEGMENT + 137, id = hash('synthetic archive descriptor')) {
  return { version: 4, id, name: 'próba.zip', size, segmentBytes: SEGMENT, segmentCount: Math.ceil(size / SEGMENT) };
}
function bytesFor(length, seed = 1) {
  return Uint8Array.from({ length }, (_, index) => (index * 73 + (index >>> 8) + seed) & 255);
}
async function fixture(t) {
  const path = await mkdtemp(join(process.cwd(), '.large-store-test-'));
  const backend = await createDiskBackend(path);
  const stores = [];
  const api = load(backend);
  t.after(async () => {
    for (const store of stores) await store.dispose();
    await rm(path, { recursive: true, force: true });
  });
  return { path, backend, api, local: name => join(path, 'wgqr-large-v4', name),
    async open(options) { const store = await api.open(options); stores.push(store); return store; } };
}
async function saveAll(store, value, seed = 1) {
  await store.begin(value);
  const expected = createHash('sha256');
  const digests = [];
  for (let index = 0; index < value.segmentCount; index++) {
    const bytes = bytesFor(Math.min(SEGMENT, value.size - index * SEGMENT), seed + index);
    expected.update(bytes);
    digests.push(hash(bytes));
    await store.putSegment(index, bytes, digests[index]);
    bytes.fill(0);
  }
  return { hash: expected.digest('hex'), digests };
}
async function fileHash(path) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}
async function corruptByte(path, position = 0) {
  const handle = await openFile(path, 'r+');
  try { await handle.write(new Uint8Array([199]), 0, 1, position); }
  finally { await handle.close(); }
}

test('disk-backed segments resume and assemble byte-exactly without a full-file buffer', async t => {
  const f = await fixture(t), value = descriptor(SEGMENT * 2 + 137);
  const progress = [];
  const first = await f.open({ onProgress: value => progress.push(value) });
  assert.equal(first.state.descriptor, null);
  assert.equal(first.persistent, false);
  const expected = await saveAll(first, value);
  assert.equal(first.state.savedBytes, value.size);
  assert.equal(first.state.complete, false);
  assert.deepEqual(first.state.digests, expected.digests);
  await assert.rejects(first.file(), { code: 'STORE_INCOMPLETE' });
  await first.dispose();
  const resumed = await f.open({ onProgress: value => progress.push(value) });
  assert.deepEqual(resumed.state.completed, [true, true, true]);
  assert.deepEqual(resumed.state.descriptor, value);
  const file = await resumed.finish({ onProgress: value => progress.push(value) });
  assert.equal(file.size, value.size);
  assert.equal(resumed.state.complete, true);
  assert.equal(await fileHash(file.path), expected.hash);
  assert.ok(f.backend.audit.reads.every(read => read.bytes <= SEGMENT), 'No 200 MiB-style whole-file arrayBuffer is permitted.');
  assert.ok(f.backend.audit.writes.every(write => write.bytes <= COPY), 'The output must be written in bounded pieces.');
  assert.ok(progress.some(value => value.phase === 'verify'));
  assert.ok(progress.some(value => value.phase === 'assemble' && value.completedBytes === file.size));
  assert.ok(progress.some(value => value.phase === 'verify-file' && value.completedBytes === file.size));
  await resumed.dispose();
  const complete = await f.open();
  assert.equal(complete.state.complete, true);
  assert.equal(await fileHash((await complete.file()).path), expected.hash);
});

test('a single origin-wide lock prevents another tab or store from writing the active session', async t => {
  const f = await fixture(t);
  const first = await f.open();
  await first.begin(descriptor(400));
  const anotherPage = load(f.backend);
  await assert.rejects(anotherPage.open(), { code: 'STORE_BUSY' });
  await first.dispose();
  const second = await f.open();
  assert.equal(second.state.descriptor.size, 400);
});

test('descriptor limits, exact session identity and immutable snapshots cannot overwrite saved data', async t => {
  const f = await fixture(t), store = await f.open(), value = descriptor(400);
  for (const invalid of [
    { ...value, version: 3 }, { ...value, id: value.id.toUpperCase() }, { ...value, name: '../x.zip' },
    { ...value, name: 'ą'.repeat(61) }, { ...value, name: '\ud800.zip' }, { ...value, size: 0 },
    { ...value, size: MAX + 1, segmentCount: 101 }, { ...value, segmentCount: 2 },
    { ...value, segmentBytes: SEGMENT / 2 }, { ...value, ignored: 1 }
  ]) await assert.rejects(store.begin(invalid), { code: 'STORE_INVALID_DESCRIPTOR' });
  await store.begin(value);
  const bytes = bytesFor(400);
  await store.putSegment(0, bytes, hash(bytes));
  const before = await readFile(f.local('state.json'), 'utf8');
  for (const changed of [{ ...value, id: hash('other session') }, { ...value, name: 'inny.zip' }, { ...value, size: 399 }]) {
    await assert.rejects(store.begin(changed), { code: 'STORE_SESSION_CONFLICT' });
  }
  assert.equal(await readFile(f.local('state.json'), 'utf8'), before);
  assert.throws(() => { store.state.completed[0] = false; }, TypeError);
  assert.throws(() => { store.state.descriptor.name = 'other'; }, TypeError);
  assert.equal(store.state.savedBytes, 400);
});

test('quota is checked before begin, optional estimates do not block, and persisted is informational', async t => {
  const f = await fixture(t);
  f.backend.setPersistent(true);
  const store = await f.open(), value = descriptor(MAX);
  assert.equal(store.persistent, true);
  f.backend.setEstimate({ quota: value.size * 2, usage: 0 });
  await assert.rejects(store.begin(value), { code: 'STORE_QUOTA' });
  assert.equal(store.state.descriptor, null);
  f.backend.setEstimate({ quota: value.size * 2 + SEGMENT, usage: 0 });
  await store.begin(value);
  assert.equal(store.state.completed.length, 100);
  await store.clear();
  f.backend.setEstimate(null);
  await store.begin(descriptor(1));
  assert.equal(store.state.descriptor.size, 1);
});

test('segment length, SHA-256 and conflicting digests are rejected before progress changes', async t => {
  const f = await fixture(t), store = await f.open();
  await store.begin(descriptor(300));
  const bytes = bytesFor(300), digest = hash(bytes);
  await assert.rejects(store.putSegment(-1, bytes, digest), { code: 'STORE_INVALID_SEGMENT' });
  await assert.rejects(store.putSegment(1, bytes, digest), { code: 'STORE_INVALID_SEGMENT' });
  await assert.rejects(store.putSegment(0, bytes.subarray(0, 299), digest), { code: 'STORE_INVALID_SEGMENT' });
  await assert.rejects(store.putSegment(0, bytes, hash('wrong')), { code: 'STORE_DIGEST_MISMATCH' });
  assert.equal(store.state.savedBytes, 0);
  await store.putSegment(0, bytes, digest);
  const writes = f.backend.audit.writes.length;
  await store.putSegment(0, bytes, digest);
  assert.equal(f.backend.audit.writes.length, writes, 'A valid duplicate must not rewrite disk.');
  await assert.rejects(store.putSegment(0, bytesFor(300, 9), hash(bytesFor(300, 9))), { code: 'STORE_SEGMENT_CONFLICT' });
  assert.equal(store.state.savedBytes, 300);
});

test('a segment is committed only after both its data close and metadata close succeed', async t => {
  for (const target of ['segment-000.bin', 'state.json']) await t.test(target, async t => {
    const f = await fixture(t), store = await f.open();
    await store.begin(descriptor(400));
    const entered = deferred(), release = deferred();
    f.backend.faults.before = async event => {
      if (event.op === 'close' && event.path.endsWith(target)) { entered.resolve(); await release.promise; }
    };
    const bytes = bytesFor(400); let finished = false;
    const put = store.putSegment(0, bytes, hash(bytes)).then(value => { finished = true; return value; });
    await entered.promise;
    assert.equal(finished, false);
    assert.equal(store.state.completed[0], false);
    assert.equal(JSON.parse(await readFile(f.local('state.json'), 'utf8')).digests[0], null);
    await assert.rejects(store.putSegment(0, bytes, hash(bytes)), { code: 'STORE_BUSY' });
    release.resolve();
    await put;
    bytes.fill(0);
    assert.equal(store.state.savedBytes, 400);
    assert.equal(hash(await readFile(f.local('segment-000.bin'))), store.state.digests[0]);
  });
});

test('write/close/quota failures never acknowledge an uncommitted segment and retry after reopen', async t => {
  for (const [op, target] of [['write', 'segment-000.bin'], ['close', 'segment-000.bin'], ['close', 'state.json']]) await t.test(`${op}:${target}`, async t => {
    const f = await fixture(t), store = await f.open();
    const value = descriptor(500), bytes = bytesFor(500), digest = hash(bytes);
    await store.begin(value);
    f.backend.faults.before = event => {
      if (event.op === op && event.path.endsWith(target)) throw new DOMException('disk full', 'QuotaExceededError');
    };
    await assert.rejects(store.putSegment(0, bytes, digest), { code: 'STORE_QUOTA' });
    assert.equal(store.state.completed[0], false);
    assert.equal(store.state.savedBytes, 0);
    f.backend.faults.before = null;
    await store.dispose();
    const resumed = await f.open();
    assert.deepEqual(resumed.state.completed, [false]);
    await resumed.putSegment(0, bytes, digest);
    assert.equal(resumed.state.savedBytes, 500);
  });
});

test('resume invalidates missing and corrupt segments but retains every verified segment', async t => {
  const f = await fixture(t), store = await f.open(), value = descriptor(SEGMENT * 2 + 123);
  await saveAll(store, value);
  await store.dispose();
  await unlink(f.local('segment-000.bin'));
  await corruptByte(f.local('segment-001.bin'), 17);
  const resumed = await f.open();
  assert.deepEqual(resumed.state.completed, [false, false, true]);
  assert.equal(resumed.state.savedBytes, 123);
  assert.equal(resumed.state.complete, false);
  assert.deepEqual(JSON.parse(await readFile(f.local('state.json'), 'utf8')).digests.slice(0, 2), [null, null]);
  await assert.rejects(resumed.finish(), { code: 'STORE_INCOMPLETE' });
});

test('begin of the same descriptor revalidates an existing session instead of trusting memory', async t => {
  const f = await fixture(t), store = await f.open(), value = descriptor(240);
  await saveAll(store, value);
  await unlink(f.local('segment-000.bin'));
  const state = await store.begin(value);
  assert.deepEqual(state.completed, [false]);
  assert.equal(state.savedBytes, 0);
});

test('malformed metadata and orphaned files block begin until explicit clear', async t => {
  for (const variant of ['invalid-json', 'oversize', 'extra-field', 'orphan']) await t.test(variant, async t => {
    const f = await fixture(t), store = await f.open();
    await store.dispose();
    const valid = { format: 1, descriptor: descriptor(100), digests: [null], complete: false };
    if (variant === 'orphan') await writeFile(f.local('segment-000.bin'), new Uint8Array([1]));
    else await writeFile(f.local('state.json'), variant === 'invalid-json' ? '{broken'
      : variant === 'oversize' ? ' '.repeat(16385) : JSON.stringify({ ...valid, complete: true, extra: 1 }));
    const opened = await f.open();
    assert.equal(opened.state.corrupt, true);
    await assert.rejects(opened.begin(descriptor(300)), { code: 'STORE_CORRUPT' });
    await opened.clear();
    assert.equal(opened.state.corrupt, false);
    assert.equal(opened.state.descriptor, null);
    await opened.begin(descriptor(300));
    assert.equal(opened.state.descriptor.size, 300);
  });
});

test('a corrupt final file is never offered as complete and can be rebuilt from retained segments', async t => {
  const f = await fixture(t), store = await f.open(), value = descriptor(SEGMENT + 37);
  const expected = await saveAll(store, value);
  await store.finish();
  await store.dispose();
  await corruptByte(f.local('received.zip'), SEGMENT + 3);
  const resumed = await f.open();
  assert.equal(resumed.state.complete, false);
  assert.deepEqual(resumed.state.completed, [true, true]);
  await assert.rejects(resumed.file(), { code: 'STORE_INCOMPLETE' });
  const file = await resumed.finish();
  assert.equal(await fileHash(file.path), expected.hash);
});

test('a segment corrupted after reception is invalidated during final assembly', async t => {
  const f = await fixture(t), store = await f.open(), value = descriptor(SEGMENT + 37);
  await saveAll(store, value);
  await corruptByte(f.local('segment-001.bin'), 3);
  await assert.rejects(store.finish(), { code: 'STORE_DIGEST_MISMATCH' });
  assert.equal(store.state.complete, false);
  assert.deepEqual(store.state.completed, [true, false]);
  assert.equal(store.state.savedBytes, SEGMENT);
  await assert.rejects(store.file(), { code: 'STORE_INCOMPLETE' });
});

test('an already complete transfer can be reopened for download without requiring more free space', async t => {
  const f = await fixture(t), store = await f.open(), value = descriptor(137);
  await saveAll(store, value);
  await store.finish();
  f.backend.setEstimate({ quota: 100, usage: 100 });
  await store.begin(value);
  assert.equal((await store.file()).size, value.size);
});

test('final output and complete metadata must both close successfully before file is exposed', async t => {
  for (const target of ['received.zip', 'state.json']) await t.test(target, async t => {
    const f = await fixture(t), store = await f.open(), value = descriptor(SEGMENT + 17);
    const expected = await saveAll(store, value);
    f.backend.faults.before = event => {
      if (event.op === 'close' && event.path.endsWith(target)) throw new DOMException('full', 'QuotaExceededError');
    };
    await assert.rejects(store.finish(), { code: 'STORE_QUOTA' });
    assert.equal(store.state.complete, false);
    assert.equal(store.state.savedBytes, value.size);
    await assert.rejects(store.file(), { code: 'STORE_INCOMPLETE' });
    f.backend.faults.before = null;
    await store.dispose();
    const resumed = await f.open();
    assert.equal(resumed.state.complete, false);
    assert.equal(await fileHash((await resumed.finish()).path), expected.hash);
  });
});

test('dispose cancels an assembly, preserves its committed segments and permits a clean resume', async t => {
  const f = await fixture(t), store = await f.open(), value = descriptor(SEGMENT + 101);
  const expected = await saveAll(store, value);
  let stopped = false;
  const finishing = store.finish({ onProgress(progress) {
    if (!stopped && progress.phase === 'assemble') { stopped = true; void store.dispose(); }
  } });
  await assert.rejects(finishing, { name: 'AbortError', code: 'STORE_CANCELLED' });
  await store.dispose();
  const resumed = await f.open();
  assert.equal(resumed.state.savedBytes, value.size);
  assert.equal(resumed.state.complete, false);
  assert.equal(await fileHash((await resumed.finish()).path), expected.hash);
});

test('clear cancels an outstanding write and old work cannot recreate the erased session', async t => {
  const f = await fixture(t), store = await f.open(), value = descriptor(500);
  await store.begin(value);
  const entered = deferred(), release = deferred();
  f.backend.faults.before = async event => {
    if (event.op === 'close' && event.path.endsWith('segment-000.bin')) { entered.resolve(); await release.promise; }
  };
  const bytes = bytesFor(500);
  const writing = store.putSegment(0, bytes, hash(bytes));
  const rejected = assert.rejects(writing, { name: 'AbortError', code: 'STORE_CANCELLED' });
  await entered.promise;
  const clearing = store.clear();
  await assert.rejects(store.begin(descriptor(600)), { code: 'STORE_BUSY' });
  release.resolve();
  await rejected;
  await clearing;
  assert.equal(store.state.descriptor, null);
  f.backend.faults.before = null;
  await store.begin(descriptor(600, hash('new after explicit clear')));
  assert.equal(store.state.savedBytes, 0);
  assert.equal(store.state.descriptor.size, 600);
});

test('partially failed clear cannot expose stale completion and can be explicitly retried', async t => {
  const f = await fixture(t), store = await f.open(), value = descriptor(400);
  await saveAll(store, value);
  await store.finish();
  f.backend.faults.before = event => {
    if (event.op === 'remove' && event.path.endsWith('segment-000.bin')) throw new Error('device busy');
  };
  await assert.rejects(store.clear(), { code: 'STORE_IO' });
  assert.equal(store.state.complete, false);
  assert.equal(store.state.corrupt, true);
  await assert.rejects(store.file(), { code: 'STORE_CORRUPT' });
  await assert.rejects(store.begin(value), { code: 'STORE_CORRUPT' });
  f.backend.faults.before = null;
  await store.clear();
  assert.equal(store.state.descriptor, null);
  assert.equal(store.state.corrupt, false);
});

test('missing OPFS, locks, or createWritable fail before any transfer is accepted', async t => {
  const f = await fixture(t);
  const noLocks = load(f.backend, { navigator: { storage: f.backend.storage } });
  await assert.rejects(noLocks.open(), { code: 'STORE_UNSUPPORTED' });
  const noStorage = load(f.backend, { navigator: { locks: f.backend.locks } });
  await assert.rejects(noStorage.open(), { code: 'STORE_UNSUPPORTED' });
  const noWritable = load(f.backend, { navigator: { locks: f.backend.locks, storage: {
    async getDirectory() { return { async getDirectoryHandle() { return { async getFileHandle() { return {}; } }; } }; }
  } } });
  await assert.rejects(noWritable.open(), { code: 'STORE_UNSUPPORTED' });
  const store = await f.open();
  assert.equal(store.state.descriptor, null, 'An unsupported attempt must release the origin lock.');
});
