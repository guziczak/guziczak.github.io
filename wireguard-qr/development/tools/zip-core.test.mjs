import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

const zipSource = await readFile(new URL('../../assets/zip-core.js', import.meta.url), 'utf8');
const transferSource = await readFile(new URL('../../assets/qr-transfer.js', import.meta.url), 'utf8');
const utf8 = value => new TextEncoder().encode(value);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const PYTHON_INSPECT = String.raw`
import hashlib, io, json, sys, zipfile
with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as archive:
    assert archive.testzip() is None, 'ZIP CRC validation failed'
    entries = []
    for item in archive.infolist():
        data = archive.read(item)
        entries.append({
            'name': item.filename,
            'size': item.file_size,
            'compressedSize': item.compress_size,
            'method': item.compress_type,
            'sha256': hashlib.sha256(data).hexdigest(),
            'directory': item.is_dir(),
            'flags': item.flag_bits,
            'date': list(item.date_time),
        })
    print(json.dumps(entries, ensure_ascii=False))
`;

function inspectZip(bytes) {
  const result = spawnSync('python3', ['-c', PYTHON_INSPECT], {
    input: Buffer.from(bytes), encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 10000
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function runtime(timer = setTimeout) {
  const browser = createContext({ TextEncoder, TextDecoder, setTimeout: timer, crypto: webcrypto }, {
    codeGeneration: { strings: false, wasm: false }
  });
  runInContext(zipSource, browser, { timeout: 3000 });
  return { browser, ...browser.WGZip };
}

const zip = runtime();

function file(name, bytes, onRead) {
  return {
    name,
    size: bytes.length,
    async arrayBuffer() {
      const buffer = new Uint8Array(bytes).buffer;
      if (onRead) onRead(buffer);
      return buffer;
    }
  };
}

function assertContents(result, expected) {
  const entries = inspectZip(result.bytes);
  assert.equal(entries.length, expected.length);
  for (let index = 0; index < entries.length; index++) {
    assert.equal(entries[index].name, result.entries[index].name);
    assert.equal(entries[index].size, expected[index].length);
    assert.equal(entries[index].sha256, digest(expected[index]));
    assert.equal(entries[index].directory, false);
    assert.deepEqual(entries[index].date, [1980, 1, 1, 0, 0, 0]);
  }
  return entries;
}

test('ZIP bundle exports bounded creation and magic detection without network, workers, extraction or eval', () => {
  assert.equal(zip.MAX_FILES, 100);
  assert.equal(zip.MAX_INPUT_BYTES, 32 * 1024 * 1024);
  assert.equal(zip.MAX_OUTPUT_BYTES, 10 * 1024 * 1024);
  assert.deepEqual(Object.keys(zip.browser.WGZip).sort(), [
    'MAX_FILES', 'MAX_INPUT_BYTES', 'MAX_OUTPUT_BYTES', 'createArchive', 'isZip'
  ]);
  for (const name of ['fetch', 'XMLHttpRequest', 'Worker', 'WebSocket', 'localStorage']) {
    assert.equal(typeof zip.browser[name], 'undefined');
  }
  assert.doesNotMatch(zipSource, /\b(?:fetch|importScripts)\s*\(|\b(?:XMLHttpRequest|WebSocket|Worker|SharedWorker)\b|\bnew\s+Function\b/);
});

test('Python zipfile validates exact binary bytes, CRLF, BOM, Polish and emoji, and empty entries', async () => {
  const content = [
    Uint8Array.from([0xef, 0xbb, 0xbf, ...utf8('[Interface]\r\n# Zażółć gęślą jaźń 🔑  \r\n\r\n')]),
    Uint8Array.from({ length: 256 }, (_, index) => index),
    new Uint8Array(),
    utf8('no final newline  ')
  ];
  const result = await zip.createArchive(content.map((bytes, index) => file(['telefon.conf', 'bajty.bin', 'pusty.txt', 'żółć-🔑.txt'][index], bytes)));
  assert.equal(result.name, 'pliki.zip');
  assert.equal(result.count, 4);
  assert.equal(result.inputBytes, content.reduce((sum, bytes) => sum + bytes.length, 0));
  assert.equal(zip.isZip(result.bytes), true);
  const entries = assertContents(result, content);
  assert.equal(entries[2].method, 0);
  assert.equal(entries[3].flags & 0x800, 0x800);
});

test('unsafe paths and controls become flat basenames, while all duplicate and Unicode names survive', async () => {
  const names = [
    '../../telefon.conf', 'C:\\folder\\telefon.conf', 'TELEFON.conf', 'telefon (2).conf',
    'Zażółć-🔑.txt', 'Zażółć-🔑.txt', 'e\u0301.txt', 'é.txt', '__proto__', 'constructor',
    '\u202eplik\u0000?.txt. ', 'CON.txt', '..', '😀'.repeat(80), '😀'.repeat(80)
  ];
  const content = names.map((_, index) => utf8(`unique payload ${index}`));
  const result = await zip.createArchive(names.map((name, index) => file(name, content[index])));
  const entries = assertContents(result, content);
  assert.deepEqual(entries.slice(0, 4).map(entry => entry.name), [
    'telefon.conf', 'telefon (2).conf', 'TELEFON (3).conf', 'telefon (2) (2).conf'
  ]);
  assert.equal(entries[4].name, 'Zażółć-🔑.txt');
  assert.equal(entries[5].name, 'Zażółć-🔑 (2).txt');
  assert.equal(entries[6].name, 'e\u0301.txt');
  assert.equal(entries[7].name, 'é (2).txt');
  assert.equal(entries[8].name, '__proto__');
  assert.equal(entries[9].name, 'constructor');
  assert.equal(entries[10].name, 'plik_.txt');
  assert.equal(entries[11].name, 'plik.bin');
  assert.equal(entries[12].name, 'plik (2).bin');
  assert.equal(new Set(entries.map(entry => entry.name.normalize('NFC').toLowerCase())).size, names.length);
  for (const entry of entries) {
    assert.ok(utf8(entry.name).length <= 240);
    assert.doesNotMatch(entry.name, /[\\/\u0000-\u001f\u007f-\u009f\u202a-\u202e]/u);
  }
});

test('compressible input larger than 10 MiB fits and DEFLATE is used only when it saves bytes', async () => {
  const content = [new Uint8Array(11 * 1024 * 1024).fill(65), new Uint8Array(randomBytes(4096)), new Uint8Array()];
  const result = await zip.createArchive(content.map((bytes, index) => file(['duży.txt', 'losowy.bin', 'pusty.bin'][index], bytes)));
  assert.ok(result.inputBytes > zip.MAX_OUTPUT_BYTES);
  assert.ok(result.bytes.length < zip.MAX_OUTPUT_BYTES);
  const entries = assertContents(result, content);
  assert.equal(entries[0].method, 8);
  assert.ok(entries[0].compressedSize < entries[0].size);
  assert.equal(entries[1].method, 0);
  assert.equal(entries[2].method, 0);
});

test('the helper returns an oversized incompressible archive for the app to reject after compression', async () => {
  const bytes = new Uint8Array(randomBytes(zip.MAX_OUTPUT_BYTES + 1));
  const result = await zip.createArchive([file('losowy.bin', bytes)]);
  assert.ok(result.bytes.length > zip.MAX_OUTPUT_BYTES);
  assertContents(result, [bytes]);
});

test('count and cumulative raw-size limits are enforced before reading any file', async () => {
  let reads = 0;
  const fake = size => ({ name: 'plik', size, arrayBuffer: async () => { reads++; return new ArrayBuffer(0); } });
  await assert.rejects(zip.createArchive(Array.from({ length: 101 }, () => fake(0))), { code: 'TOO_MANY_FILES' });
  await assert.rejects(zip.createArchive([fake(zip.MAX_INPUT_BYTES), fake(1)]), { code: 'INPUT_TOO_LARGE' });
  await assert.rejects(zip.createArchive([fake(1), { name: 'bad', size: -1, arrayBuffer() {} }]), { code: 'INVALID_FILE' });
  await assert.rejects(zip.createArchive([]), { code: 'INVALID_INPUT' });
  await assert.rejects(zip.createArchive([fake(0)], { isCurrent: true }), { code: 'INVALID_INPUT' });
  assert.equal(reads, 0);
});

test('exact input boundaries support 32 MiB of compressible content and 100 zero-byte files', async () => {
  const bytes = new Uint8Array(zip.MAX_INPUT_BYTES).fill(97);
  const large = await zip.createArchive([file('limit.txt', bytes)]);
  assert.equal(large.inputBytes, zip.MAX_INPUT_BYTES);
  assert.ok(large.bytes.length < zip.MAX_OUTPUT_BYTES);
  assertContents(large, [bytes]);
  const many = await zip.createArchive(Array.from({ length: 100 }, (_, index) => file(`pusty-${index}.txt`, new Uint8Array())));
  assert.equal(many.count, 100);
  assert.equal(many.inputBytes, 0);
  assert.equal(inspectZip(many.bytes).length, 100);
});

test('cancellation before reading and while a read is pending exposes no stale archive and clears owned bytes', async () => {
  let reads = 0;
  await assert.rejects(zip.createArchive([file('x', utf8('secret'), () => { reads++; })], { isCurrent: () => false }), { code: 'CANCELLED' });
  assert.equal(reads, 0);
  let active = true;
  let signalRead;
  const started = new Promise(resolve => { signalRead = resolve; });
  let releaseRead;
  const buffer = utf8('private synthetic bytes').buffer;
  const slowFile = {
    name: 'wolny.conf', size: buffer.byteLength,
    arrayBuffer() {
      signalRead();
      return new Promise(resolve => { releaseRead = () => resolve(buffer); });
    }
  };
  const pending = zip.createArchive([slowFile], { isCurrent: () => active });
  const rejection = assert.rejects(pending, { code: 'CANCELLED' });
  await started;
  active = false;
  releaseRead();
  await rejection;
  assert.ok(new Uint8Array(buffer).every(byte => byte === 0));
});

test('cancellation immediately before returning a completed ZIP rejects it', async () => {
  let active = true;
  let tasks = 0;
  const cancellable = runtime(callback => setTimeout(() => {
    tasks++;
    if (tasks === 3) active = false; // before read, after compression, before release
    callback();
  }, 0));
  await assert.rejects(cancellable.createArchive([file('x.txt', utf8('secret'))], { isCurrent: () => active }), { code: 'CANCELLED' });
});

test('read failures and changed file lengths return coded errors, and original File content stays intact', async () => {
  await assert.rejects(zip.createArchive([{ name: 'x', size: 1, async arrayBuffer() { throw new Error('read failure'); } }]), { code: 'READ_FAILED' });
  const changed = utf8('unexpectedly longer');
  await assert.rejects(zip.createArchive([{ name: 'x', size: 1, async arrayBuffer() { return changed.buffer; } }]), { code: 'FILE_SIZE_CHANGED' });
  assert.ok(changed.every(byte => byte === 0));
  await assert.rejects(zip.createArchive([{ name: 'x', size: 1, async arrayBuffer() { return new Uint8Array(1); } }]), { code: 'READ_FAILED' });
  const original = utf8('original immutable File content');
  const before = digest(original);
  const copies = [];
  const result = await zip.createArchive([file('x', original, buffer => copies.push(buffer))]);
  assert.equal(digest(original), before);
  assert.ok(copies.every(buffer => new Uint8Array(buffer).every(byte => byte === 0)));
  assertContents(result, [original]);
});

test('ZIP magic detection is conservative, handles ordinary and empty ZIP headers, and does not parse content', () => {
  for (const bytes of [[80, 75, 3, 4], [80, 75, 5, 6], [80, 75, 7, 8]]) assert.equal(zip.isZip(Uint8Array.from(bytes)), true);
  for (const bytes of [new Uint8Array(), utf8('PK'), utf8('[Interface]'), Uint8Array.from([80, 75, 1, 2]), null, 'PK\u0003\u0004']) {
    assert.equal(zip.isZip(bytes), false);
  }
});

test('ZIP → shuffled WGTransfer frames → recovered ZIP preserves all bytes and independently readable entries', async () => {
  runInContext(transferSource, zip.browser, { timeout: 3000 });
  const content = [utf8('# Zażółć 🔑\r\n'.repeat(500)), new Uint8Array(randomBytes(4096)), new Uint8Array()];
  const archive = await zip.createArchive(content.map((bytes, index) => file(['telefon.conf', 'dane.bin', 'pusty.txt'][index], bytes)));
  const outgoing = await zip.browser.WGTransfer.createTransfer(archive.bytes, archive.name);
  assert.ok(outgoing.total > 5);
  const collector = zip.browser.WGTransfer.createCollector();
  let result;
  for (const frame of [...outgoing.frames].reverse()) {
    result = await collector.accept(frame);
    if (result.kind === 'progress') {
      const repeated = await collector.accept(frame);
      assert.equal(repeated.duplicate, true);
    }
  }
  assert.equal(result.kind, 'complete');
  assert.equal(result.name, 'pliki.zip');
  assert.deepEqual(Buffer.from(result.bytes), Buffer.from(archive.bytes));
  assert.equal(zip.isZip(result.bytes), true);
  assertContents({ ...archive, bytes: result.bytes }, content);
});
