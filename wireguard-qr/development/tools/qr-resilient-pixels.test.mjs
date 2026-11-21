import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const sources = await Promise.all(['qr-core.js', 'qr-transfer.js', 'qr-resilient.js'].map(name =>
  readFile(new URL(`../../assets/${name}`, import.meta.url), 'utf8')));
function runtime() {
  const scope = createContext({ TextEncoder, TextDecoder, crypto: webcrypto }, {
    codeGeneration: { strings: false, wasm: false }
  });
  for (const source of sources) runInContext(source, scope, { timeout: 3000 });
  return scope;
}
const sender = runtime();
const receiver = runtime();

// The protocol crosses an actual PNG encode/decode boundary before collection.
// Synthetic pixels verify data plumbing, not physical phone camera performance.
function throughPng(bytes, encoder = sender.WGQR, decoder = receiver.WGQR) {
  const matrix = encoder.encodeBytes(bytes);
  const scale = 4;
  const side = (matrix.size + 8) * scale;
  const png = new PNG({ width: side, height: side });
  png.data.fill(255);
  for (let row = 0; row < matrix.size; row++) {
    for (let column = 0; column < matrix.size; column++) {
      if (!matrix.data[row * matrix.size + column]) continue;
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) {
          const offset = (((row + 4) * scale + y) * side + (column + 4) * scale + x) * 4;
          png.data[offset] = png.data[offset + 1] = png.data[offset + 2] = 0;
        }
      }
    }
  }
  const rendered = PNG.sync.read(PNG.sync.write(png));
  const result = decoder.decodePixels(new Uint8ClampedArray(rendered.data), side, side);
  assert.ok(result, 'The rendered QR is readable.');
  assert.deepEqual(Buffer.from(result.bytes), Buffer.from(bytes), 'Raw QR bytes are preserved.');
  return result.bytes;
}

for (const chunkBytes of [384, 600]) {
  test(`PNG transfer with ${chunkBytes}-byte chunks repairs dropped data and exchanges feedback`, async () => {
    const source = Uint8Array.from({ length: chunkBytes * 8 + 137 }, (_, index) => (index * 71 + (index >>> 7)) & 255);
    source.set([0, 255, 0xef, 0xbb, 0xbf, 13, 10, 0x80]);
    const transfer = await sender.WGResilient.createTransfer(source, 'dane-zażółć.bin', { chunkBytes });
    const collector = receiver.WGResilient.createCollector();
    let result = await collector.accept(throughPng(transfer.frame(0)));
    assert.equal(result.kind, 'progress');
    const rankBeforeDuplicate = collector.state.received;
    await collector.accept(throughPng(transfer.frame(0)));
    assert.equal(collector.state.received, rankBeforeDuplicate);
    // Eight of nine original frames never reach the receiver.
    const ack = collector.createFeedback({ suggestedRate: 2 });
    const parsed = transfer.acceptFeedback(throughPng(ack, receiver.WGQR, sender.WGQR));
    assert.deepEqual(Array.from(parsed.missingBlocks), [0]);
    assert.equal(parsed.complete, false);
    assert.equal(parsed.suggestedRate, 2);
    for (let serial = 1; serial < 128 && result.kind !== 'complete'; serial++) {
      result = await collector.accept(throughPng(transfer.repairFrame(0, serial)));
    }
    assert.equal(result.kind, 'complete');
    assert.deepEqual(Buffer.from(result.bytes), Buffer.from(source));
    assert.equal(result.name, 'dane-zażółć.bin');
    const done = transfer.acceptFeedback(throughPng(collector.createFeedback({ suggestedRate: 5 }), receiver.WGQR, sender.WGQR));
    assert.equal(done.complete, true);
    assert.deepEqual(Array.from(done.missingBlocks), []);
    transfer.dispose();
    collector.reset();
  });
}
