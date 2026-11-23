import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

const source = await readFile(new URL('../../assets/qr-telemetry.js', import.meta.url), 'utf8');
const browser = createContext({}, { codeGeneration: { strings: false, wasm: false } });
runInContext(source, browser, { timeout: 3000 });
function harness(start = 0) {
  let time = start;
  const telemetry = browser.WGTelemetry.create({ now: () => time, appVersion: 'test-telemetry.1' });
  return { telemetry, at: value => { time = value; } };
}
function packet(received, complete = false, overrides = {}) {
  return { version: 2, size: 1152, total: 3, chunkBytes: 384, blockCount: 1,
    received, blocksComplete: complete ? 1 : 0, complete, ...overrides };
}
function scan(decodeMs = 20, result = true, region = 'tracked') {
  return { decodeMs, result, region, pixels: { width: 480, height: 360 } };
}
function finiteNumbers(value) {
  for (const item of Object.values(value)) {
    if (typeof item === 'number') assert.ok(Number.isFinite(item));
    else if (item && typeof item === 'object') finiteNumbers(item);
  }
}

test('exact clock separates first-packet elapsed time, camera search time and pauses, then freezes final scan', () => {
  const { telemetry: t, at } = harness();
  t.startCamera({ width: 1920, height: 1080, frameRate: 29.97 });
  at(500); t.recordScan(scan(40, false, 'search'));
  assert.equal(t.snapshot().started, false);
  assert.equal(t.snapshot().elapsedMs, 0);
  assert.equal(t.snapshot().cameraActiveMs, 500);
  at(1000); t.recordScan(scan(20, true, 'search'));
  t.recordPacket(packet(1), { delta: 1, source: 'camera', packetType: 'unknown' });
  at(2000); t.stopCamera();
  assert.equal(t.snapshot().elapsedMs, 1000);
  assert.equal(t.snapshot().cameraActiveMs, 2000);
  assert.equal(t.snapshot().averageBytesPerSecond, null);
  at(5000); t.startCamera({ width: 1280, height: 720, frameRate: 30 });
  at(6000); t.recordScan(scan(10));
  t.recordPacket(packet(2), { delta: 1, source: 'camera', packetType: 'unknown' });
  at(7000); t.recordScan(scan(30)); // The final scan is recorded before awaiting SHA completion.
  at(7500); t.recordPacket(packet(3, true), { delta: 1, source: 'camera', packetType: 'unknown' });
  const final = t.snapshot();
  assert.equal(final.complete, true);
  assert.equal(final.elapsedMs, 6500);
  assert.equal(final.cameraActiveMs, 4500);
  assert.equal(final.cameraStarts, 2);
  assert.equal(final.cameraAttempts, 4);
  assert.equal(final.opticalReads, 3);
  assert.equal(final.acceptedPackets, 3);
  assert.equal(final.usefulUnits, 3);
  assert.equal(final.latencyAvgMs, 25);
  assert.equal(final.latencyP95Ms, 40);
  assert.equal(final.trackedAttempts, 2);
  assert.equal(final.searchAttempts, 2);
  assert.equal(final.averageBytesPerSecond, 177.231);
  assert.equal(final.averageUnitsPerSecond, 0.462);
  assert.equal(final.video.width, 1280);
  at(60000); t.stopCamera(); t.startCamera({ width: 1, height: 1 });
  t.recordScan(scan(999));
  t.recordRejected('foreign', { source: 'image' });
  t.recordPacket(packet(999, true), { delta: 999, source: 'image' });
  assert.deepEqual(t.snapshot(), final);
});

test('zero is a valid start timestamp; empty and instant single-frame transfers have no infinite rates', () => {
  const { telemetry: t, at } = harness();
  const empty = t.snapshot();
  assert.equal(empty.started, false);
  assert.equal(empty.transfer, null);
  assert.equal(empty.latencyAvgMs, null);
  assert.equal(empty.latencyP95Ms, null);
  assert.equal(empty.averageBytesPerSecond, null);
  assert.equal(empty.averageUnitsPerSecond, null);
  finiteNumbers(empty);
  t.startCamera({ width: 640, height: 480, frameRate: 30 });
  t.recordScan(scan(0));
  t.recordPacket(packet(1, true, { version: 0, size: 40, total: 1, chunkBytes: 40 }), { delta: 1, packetType: 'plain' });
  const instant = t.snapshot();
  assert.equal(instant.started, true);
  assert.equal(instant.complete, true);
  assert.equal(instant.elapsedMs, 0);
  assert.equal(instant.cameraActiveMs, 0);
  assert.equal(instant.averageBytesPerSecond, null);
  assert.equal(instant.averageUnitsPerSecond, null);
  assert.equal(instant.latencyP95Ms, 0);
  finiteNumbers(instant);
  t.reset();
  t.recordPacket(packet(1), { delta: 1 });
  at(1000);
  assert.equal(t.snapshot().elapsedMs, 1000);
  assert.equal(t.snapshot().averageUnitsPerSecond, 1);
});

test('optical attempts, reads, accepted equations and rank gains are distinct; image reads include rejected QR', () => {
  const { telemetry: t, at } = harness();
  for (let index = 0; index < 10; index++) t.recordScan(scan(10, index < 5));
  t.recordPacket(packet(1), { delta: 1, packetType: 'single', source: 'camera' });
  at(10); t.recordPacket(packet(1), { delta: 0, packetType: 'single', source: 'camera' });
  at(20); t.recordPacket(packet(2), { delta: 1, packetType: 'mixed', source: 'camera' });
  t.recordRejected('foreign', { source: 'camera' });
  t.recordRejected('feedback', { source: 'camera' });
  at(30); t.recordPacket(packet(2), { delta: 0, packetType: 'legacy', source: 'image' });
  t.recordRejected('foreign', { source: 'image' });
  t.recordRejected('invalid', { source: 'image' });
  const state = t.snapshot();
  assert.equal(state.cameraAttempts, 10);
  assert.equal(state.opticalReads, 5);
  assert.equal(state.imageReads, 3);
  assert.equal(state.qrReads, 8);
  assert.equal(state.acceptedPackets, 4);
  assert.equal(state.cameraPackets, 3);
  assert.equal(state.imagePackets, 1);
  assert.equal(state.usefulPackets, 2);
  assert.equal(state.redundantPackets, 2);
  assert.equal(state.usefulUnits, 2);
  assert.equal(state.singleFragmentPackets, 2);
  assert.equal(state.mixedEquationPackets, 1);
  assert.equal(state.legacyPackets, 1);
  assert.equal(state.rejectedPackets, 4);
  assert.equal(state.rejections.foreign, 2);
  assert.equal(state.rejections.invalid, 1);
  assert.equal(state.rejections.feedback, 1);
  assert.equal('lostPackets' in state, false);
});

test('dual symbols count as two reads in one captured frame while legacy scans retain their meaning', () => {
  const { telemetry: t } = harness();
  t.recordScan({ ...scan(30), symbols: 2, attempts: 2 });
  t.recordScan({ ...scan(25), symbols: 1, attempts: 2 });
  t.recordScan({ ...scan(15), symbols: 0, attempts: 2 });
  t.recordScan(scan(10, true));
  const state = t.snapshot();
  assert.equal(state.cameraAttempts, 4);
  assert.equal(state.decodeAttempts, 7);
  assert.equal(state.opticalReads, 4);
  assert.equal(state.qrReads, 4);
  assert.equal(state.latencySamples, 4, 'Latency describes a captured frame/batch, not each symbol.');
  assert.equal(state.latencyAvgMs, 20);
  assert.equal(state.acceptedPackets, 0);
  t.reset();
  assert.equal(t.snapshot().decodeAttempts, 0);
});

test('manifests are required metadata rather than redundant data packets, including buffered rank gains', () => {
  const { telemetry: t, at } = harness();
  const metadata = { version: 3, size: 1152, total: 3, chunkBytes: 384, blockCount: 1,
    received: 0, blocksComplete: 0, complete: false };
  t.recordScan({ ...scan(), symbols: 2, attempts: 2 });
  t.recordPacket(metadata, { packetType: 'manifest', delta: 0, source: 'camera' });
  t.recordPacket({ ...metadata, received: 1 }, { packetType: 'single', delta: 1, source: 'camera' });
  at(500);
  t.recordPacket({ ...metadata, received: 2 }, { packetType: 'manifest', delta: 1, source: 'image' });
  t.recordPacket({ ...metadata, received: 2 }, { packetType: 'mixed', delta: 0, source: 'camera' });
  const state = t.snapshot();
  assert.equal(state.acceptedPackets, 4);
  assert.equal(state.manifestPackets, 2);
  assert.equal(state.usefulPackets, 1);
  assert.equal(state.redundantPackets, 1);
  assert.equal(state.usefulUnits, 2);
  assert.equal(state.recentUsefulUnitsPerSecond, 4);
  assert.equal(state.elapsedMs, 500, 'Elapsed transfer time includes manifest reception.');
  assert.equal(state.imageReads, 1);
  t.reset();
  assert.equal(t.snapshot().manifestPackets, 0);
});

test('invalid multi-symbol counters cannot inflate reads or leak nonnumeric diagnostic input', () => {
  const { telemetry: t } = harness();
  for (const value of [-1, 21, 1000000, NaN, Infinity, 'PRIVATE_BYTES', { bytes: 'PRIVATE_BYTES' }]) {
    t.recordScan({ ...scan(20, false), symbols: value, attempts: value });
  }
  assert.equal(t.snapshot().cameraAttempts, 7);
  assert.equal(t.snapshot().decodeAttempts, 7);
  assert.equal(t.snapshot().opticalReads, 0);
  assert.doesNotMatch(t.report(), /PRIVATE_BYTES|NaN|Infinity/);
});

test('a 3 by 3 captured grid records all nine optical reads without multiplying capture latency', () => {
  const { telemetry: t } = harness();
  t.recordScan({ ...scan(90), symbols: 9, attempts: 9 });
  t.recordScan({ ...scan(60), symbols: 6, attempts: 9 });
  const state = t.snapshot();
  assert.equal(state.cameraAttempts, 2);
  assert.equal(state.decodeAttempts, 18);
  assert.equal(state.opticalReads, 15);
  assert.equal(state.latencySamples, 2);
  assert.equal(state.latencyAvgMs, 75);
});

test('5 by 4 and 5 by 3 captured grids count all symbols and attempts while twenty-one remains invalid', () => {
  const { telemetry: t } = harness();
  t.recordScan({ ...scan(90), symbols: 20, attempts: 20 });
  t.recordScan({ ...scan(60), symbols: 15, attempts: 15 });
  const state = t.snapshot();
  assert.equal(state.cameraAttempts, 2);
  assert.equal(state.decodeAttempts, 35);
  assert.equal(state.opticalReads, 35);
  assert.equal(state.qrReads, 35);
  assert.equal(state.latencySamples, 2);
  assert.equal(state.latencyAvgMs, 75);
  t.recordScan({ ...scan(20, false), symbols: 21, attempts: 21 });
  const invalid = t.snapshot();
  assert.equal(invalid.cameraAttempts, 3);
  assert.equal(invalid.decodeAttempts, 36, 'Invalid attempt counts retain the single-scan fallback.');
  assert.equal(invalid.opticalReads, 35, 'An out-of-range symbol count must not invent optical reads.');
  assert.equal(invalid.acceptedPackets, 0);
});

test('latency p95 uses a bounded upper-bucket estimate, independently of transfer acceptance', () => {
  const { telemetry: t } = harness();
  for (let index = 0; index < 19; index++) t.recordScan(scan(10, false, 'search'));
  t.recordScan(scan(1000));
  assert.equal(t.snapshot().latencySamples, 20);
  assert.equal(t.snapshot().latencyAvgMs, 59.5);
  assert.equal(t.snapshot().latencyP95Ms, 10);
  t.recordScan(scan(21.2));
  assert.equal(t.snapshot().latencyAvgMs, 57.676);
  assert.equal(t.snapshot().latencyP95Ms, 25);
  assert.equal(t.snapshot().latencyP95Approximate, true);
  t.recordScan(scan(NaN));
  t.recordScan(scan(Infinity));
  t.recordScan(scan(-4));
  assert.equal(t.snapshot().cameraAttempts, 24);
  assert.equal(t.snapshot().latencySamples, 21);
  assert.equal(t.snapshot().acceptedPackets, 0);
  t.reset();
  t.recordScan(scan(70000));
  assert.equal(t.snapshot().latencyAvgMs, 70000);
  assert.equal(t.snapshot().latencyP95Ms, 70000);
});

test('stop/start is cumulative and idempotent while reset clears every session measurement', () => {
  const { telemetry: t, at } = harness();
  t.startCamera({ width: 640, height: 480, frameRate: 30 });
  at(100); t.startCamera({ width: 640, height: 480, frameRate: 30 });
  at(200); t.recordPacket(packet(1), { delta: 1 });
  at(500); t.stopCamera();
  at(700); t.stopCamera();
  assert.equal(t.snapshot().cameraStarts, 1);
  assert.equal(t.snapshot().cameraActiveMs, 500);
  at(1000); t.startCamera();
  at(1300); t.stopCamera();
  assert.equal(t.snapshot().cameraStarts, 2);
  assert.equal(t.snapshot().cameraActiveMs, 800);
  assert.equal(t.snapshot().elapsedMs, 1100);
  t.recordRejected('foreign');
  t.recordScan(scan(50));
  t.reset();
  const reset = t.snapshot();
  assert.equal(reset.appVersion, 'test-telemetry.1');
  assert.equal(reset.started, false);
  assert.equal(reset.complete, false);
  assert.equal(reset.elapsedMs, 0);
  assert.equal(reset.cameraActiveMs, 0);
  assert.equal(reset.cameraStarts, 0);
  assert.equal(reset.cameraAttempts, 0);
  assert.equal(reset.rejectedPackets, 0);
  assert.equal(reset.latencyP95Ms, null);
  assert.equal(reset.video, null);
  assert.equal(reset.transfer, null);
  assert.equal(reset.lastScanPixels, null);
  at(2000); t.recordPacket(packet(1), { delta: 1 });
  at(2500); t.recordPacket(packet(3, true), { delta: 2 });
  assert.equal(t.snapshot().elapsedMs, 500);
  assert.equal(t.snapshot().usefulUnits, 3);
});

test('rolling useful-unit indicator ages out old work, includes rank deltas and freezes at completion', () => {
  const { telemetry: t, at } = harness();
  t.recordPacket(packet(1), { delta: 1 });
  at(1000); t.recordPacket(packet(3), { delta: 2 });
  assert.equal(t.snapshot().recentUsefulUnitsPerSecond, 3);
  at(6200);
  assert.equal(t.snapshot().recentUsefulUnitsPerSecond, 0);
  at(6500); t.recordPacket(packet(4, true, { total: 4, size: 1536 }), { delta: 1 });
  const final = t.snapshot();
  assert.equal(final.recentUsefulUnitsPerSecond, 0.2);
  assert.equal(final.averageUnitsPerSecond, 0.615);
  at(999999);
  assert.equal(t.snapshot().recentUsefulUnitsPerSecond, 0.2);
});

test('reports allowlist scalar diagnostics and never retain file data, identifiers, device labels or UA', () => {
  const { telemetry: t, at } = harness();
  const secret = 'PRIVATE_KEY_DO_NOT_EXPORT';
  t.startCamera({ width: 1280, height: 720, frameRate: 30, deviceId: secret, groupId: secret, label: secret });
  t.recordScan({ ...scan(20), result: { bytes: new TextEncoder().encode(secret), data: secret }, location: secret, userAgent: secret });
  const metadata = { ...packet(1), id: secret, name: secret, digest: secret, hash: secret, bytes: secret, url: `https://private/${secret}` };
  t.recordPacket(metadata, { delta: 1, packetType: secret, filename: secret });
  metadata.size = 999999;
  assert.equal(t.snapshot().transfer.size, 1152);
  at(1000); t.recordPacket(packet(3, true), { delta: 2, source: 'image' });
  const report = t.report();
  assert.doesNotMatch(report, /PRIVATE_KEY_DO_NOT_EXPORT|deviceId|groupId|userAgent|filename|https:|"id"|"name"|"hash"|"digest"|"bytes"/);
  assert.equal(JSON.parse(report).appVersion, 'test-telemetry.1');
  assert.equal(JSON.parse(report).unknownPackets, 2);
  assert.equal(JSON.parse(report).transfer.size, 1152);
  assert.equal(JSON.parse(report).video.width, 1280);
  const snapshot = t.snapshot();
  snapshot.transfer.size = 1;
  snapshot.video.width = 1;
  snapshot.lastScanPixels.width = 1;
  snapshot.rejections.invalid = 999;
  snapshot.complete = false;
  assert.equal(t.report(), report);
  assert.ok(report.length < 4096);
  for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'Worker', 'localStorage', 'navigator', 'document']) assert.equal(typeof browser[name], 'undefined');
});

test('invalid inputs and backwards/nonfinite clocks never introduce NaN/Infinity or unsanitized strings', () => {
  const { telemetry: t, at } = harness(100);
  t.startCamera({ width: 'secret', height: Infinity, frameRate: -1 });
  t.recordPacket(packet(1), { delta: 1 });
  at(50); t.recordPacket(packet(1), { delta: -100, packetType: 'secret' });
  assert.equal(t.snapshot().elapsedMs, 0);
  assert.equal(t.snapshot().usefulUnits, 1);
  at(NaN); t.stopCamera();
  t.recordScan({ decodeMs: 'secret', pixels: { width: Infinity, height: -1 }, result: false });
  t.recordRejected('secret');
  t.recordPacket(null);
  const state = t.snapshot();
  assert.equal(state.cameraActiveMs, 0);
  assert.equal(state.video.width, null);
  assert.equal(state.lastScanPixels, null);
  assert.equal(state.rejections.invalid, 1);
  assert.doesNotMatch(t.report(), /secret|NaN|Infinity/);
  finiteNumbers(state);
  t.reset();
  at(0); t.recordPacket(packet(1), { delta: 1 });
  at(Number.MIN_VALUE); t.recordPacket(packet(3, true), { delta: 2 });
  finiteNumbers(t.snapshot());
  assert.equal(t.snapshot().averageBytesPerSecond, null);
});
