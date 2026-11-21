import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sources = ['assets/qr-core.js', 'assets/qr-transfer.js', 'assets/qr-resilient.js', 'assets/zip-core.js', 'assets/qr-telemetry.js']
  .map((name) => fs.readFileSync(path.join(root, name), 'utf8'));
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function corruptPayloadWithValidCrc(frame) {
  const bytes = Uint8Array.from(frame);
  const view = new DataView(bytes.buffer);
  bytes[view.getUint16(10)] ^= 1;
  let crc = 0xffffffff;
  for (const byte of bytes.subarray(0, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  view.setUint32(bytes.length - 4, (crc ^ 0xffffffff) >>> 0);
  return bytes;
}

function harness() {
  const h = { now: 1000, serial: 0, timers: new Map(), videoCallbacks: new Map(), urls: new Map(), encoded: [], transfers: [], streams: [], mediaRequests: [], deferMedia: false, disposedScanners: 0, events: {}, optical: null };
  class Element {
    constructor(id = '') {
      this.id = id; this.listeners = {}; this.dataset = {}; this.value = ''; this.hidden = false;
      this.disabled = false; this.open = false; this.checked = false; this.textContent = ''; this.files = [];
      this.children = []; this.parentElement = null; this.attributes = {}; this.isConnected = true; this.tabIndex = 0;
      this.width = this.height = 1; this.readyState = 2; this.videoWidth = this.videoHeight = 300;
      this.currentTime = 0; this.payload = null; this.classes = new Set();
      this.classList = { add: (x) => this.classes.add(x), remove: (x) => this.classes.delete(x), contains: (x) => this.classes.has(x), toggle: (x, on) => on ? this.classes.add(x) : this.classes.delete(x) };
    }
    addEventListener(name, fn) { (this.listeners[name] ??= []).push(fn); }
    dispatch(name, event = {}) { for (const fn of this.listeners[name] || []) fn(event); }
    click() { if (!this.disabled) this.dispatch('click'); }
    focus() { h.document.activeElement = this; }
    select() { this.selectionStart = 0; this.selectionEnd = this.value.length; }
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    removeAttribute(name) { delete this.attributes[name]; }
    getAttribute(name) { return this.attributes[name]; }
    appendChild(node) { this.children.push(node); node.parentElement = this; }
    replaceChildren() { this.children = []; }
    remove() {}
    contains(node) { return node === this || this.children.some((child) => child.contains(node)); }
    closest(selector) { for (let node = this; node; node = node.parentElement) if (selector === '[hidden]' && node.hidden) return node; return null; }
    getClientRects() { return this.closest('[hidden]') ? [] : [{}]; }
    querySelector(selector) { return selector === 'input:checked' ? this.children.find((child) => child.checked) : null; }
    querySelectorAll(selector) { return selector === 'input[type="radio"]' ? this.children : this.children.flatMap((child) => [child, ...child.children]); }
    pause() {}
    play() { return Promise.resolve(); }
    getContext() { return { fillRect() {}, drawImage(image) { h.optical = image.payload; }, getImageData() { return { data: new Uint8ClampedArray(4), width: 1, height: 1 }; } }; }
    requestVideoFrameCallback(fn) { const id = ++h.serial; h.videoCallbacks.set(id, { video: this, fn }); return id; }
    cancelVideoFrameCallback(id) { h.videoCallbacks.delete(id); }
  }
  h.els = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map((m) => [m[1], new Element(m[1])]));
  h.els['transfer-mode'].value = 'auto'; h.els['qr-density'].value = '384';
  for (const rate of [1, 2, 5, 10]) { const radio = new Element(`rate-${rate}`); radio.value = String(rate); radio.checked = rate === 2; h.els['frame-rate'].appendChild(radio); }
  h.document = { body: new Element('body'), documentElement: { dataset: { appVersion: html.match(/data-app-version="([^"]+)"/)?.[1] || 'test' } }, activeElement: h.els['expand-qr'], hidden: false, getElementById: (id) => h.els[id], createElement: () => new Element(), querySelectorAll: () => [], addEventListener: (name, fn) => { (h.events[name] ??= []).push(fn); } };
  for (const id of ['close-expanded', 'expand-qr', 'animation-toggle', 'frame-slider', 'scan-feedback']) h.els['qr-result'].appendChild(h.els[id]);
  class FakeImage {
    set src(value) { if (value) { this.payload = h.urls.get(value)?.payload; this.naturalWidth = this.naturalHeight = 300; queueMicrotask(() => this.onload?.()); } }
  }
  h.makeStream = () => {
    const track = { stopped: false, listeners: {}, stop() { this.stopped = true; }, addEventListener(name, fn) { this.listeners[name] = fn; }, getSettings() { return { width: 1920, height: 1080, frameRate: 30, deviceId: 'must-not-export-camera-id' }; } };
    const stream = { track, getTracks: () => [track], getVideoTracks: () => [track] }; h.streams.push(stream); return stream;
  };
  const context = {
    Uint8Array, Uint8ClampedArray, ArrayBuffer, DataView, TextEncoder, TextDecoder, File, Blob, Image: FakeImage, crypto: webcrypto,
    document: h.document, navigator: { clipboard: { async writeText(text) { h.clipboardText = text; } }, mediaDevices: { getUserMedia() { if (h.deferMedia) return new Promise((resolve) => h.mediaRequests.push(resolve)); return Promise.resolve(h.makeStream()); } } },
    URL: { createObjectURL(blob) { const id = `blob:${++h.serial}`; h.urls.set(id, blob); return id; }, revokeObjectURL: (id) => h.urls.delete(id) },
    performance: { now: () => h.now }, isSecureContext: true,
    setTimeout(fn, delay = 0) { if (delay === 0) return setTimeout(fn, 0); const id = ++h.serial; h.timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { h.timers.delete(id); }, addEventListener(name, fn) { (h.events[name] ??= []).push(fn); },
  };
  context.window = context; h.context = vm.createContext(context);
  for (const source of sources) vm.runInContext(source, h.context);
  h.protocol = h.context.WGResilient;
  const encode = h.context.WGQR.encodeBytes;
  h.context.WGQR = { ...h.context.WGQR, encodeBytes(bytes) { h.encoded.push(Uint8Array.from(bytes)); return encode(bytes); }, decodePixels: () => h.optical ? { bytes: Uint8Array.from(h.optical) } : null };
  h.context.WGResilient = { ...h.protocol, async createTransfer(...args) { const transfer = await h.protocol.createTransfer(...args); h.transfers.push(transfer); return transfer; } };
  const createTelemetry = h.context.WGTelemetry.create;
  h.context.WGTelemetry = { ...h.context.WGTelemetry, create(options) { h.telemetry = createTelemetry(options); return h.telemetry; } };
  h.context.WGCamera = { createScanner() { let disposed = false; return { scan(video) { assert.equal(disposed, false); return { result: video.payload ? { bytes: Uint8Array.from(video.payload) } : null, decodeMs: 25, region: 'tracked', pixels: { width: 300, height: 300 } }; }, reset() {}, dispose() { if (!disposed) h.disposedScanners++; disposed = true; } }; } };
  vm.runInContext(app, h.context);
  h.wait = async (predicate) => { for (let i = 0; i < 600; i++) { if (predicate()) return; await new Promise((resolve) => setTimeout(resolve, 2)); } throw new Error('Timed out waiting for app state'); };
  h.micro = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
  h.choose = (files) => { h.els['file-input'].files = files; h.els['file-input'].dispatch('change'); };
  h.upload = (payload, feedback = false) => {
    const input = h.els[feedback ? 'feedback-image-input' : 'image-input'];
    input.files = [Object.assign(new File(['image'], 'qr.png', { type: 'image/png' }), { payload })]; input.dispatch('change');
  };
  h.fireFrame = async (videoId, payload) => {
    const video = h.els[videoId];
    const item = [...h.videoCallbacks.entries()].find(([, entry]) => entry.video === video);
    assert.ok(item, `No callback for ${videoId}`); const [id, { fn }] = item; h.videoCallbacks.delete(id);
    video.payload = payload; h.now += 100; video.currentTime += 0.1;
    await fn(h.now, { presentedFrames: Math.round(video.currentTime * 10), mediaTime: video.currentTime });
    return fn;
  };
  h.tick = async () => {
    const item = [...h.timers.entries()].find(([, entry]) => entry.fn.name === 'tick'); assert.ok(item, 'No animation tick');
    const [id, entry] = item; h.timers.delete(id); h.now += entry.delay; await entry.fn();
  };
  h.rate = () => Number(h.els['frame-rate'].children.find((radio) => radio.checked).value);
  h.setRate = (rate) => { for (const radio of h.els['frame-rate'].children) radio.checked = Number(radio.value) === rate; h.els['frame-rate'].dispatch('change'); };
  h.close = () => { h.els['clear-all'].click(); h.timers.clear(); h.videoCallbacks.clear(); };
  return h;
}

test('sender sends all source packets once, then unique repair packets; pause and rate preserve the phase', async () => {
  const h = harness();
  try {
    h.els['series-sample'].click(); await h.wait(() => !h.els['choose-file'].disabled);
    const transfer = h.transfers.at(-1); assert.equal(transfer.total, 5); assert.equal(transfer.chunkBytes, 384); assert.equal(h.rate(), 2);
    assert.equal(h.els['animation-toggle'].getAttribute('aria-pressed'), 'false');
    const collector = h.protocol.createCollector(); await collector.accept(h.encoded.at(-1));
    h.els['animation-toggle'].click();
    for (let index = 1; index < 5; index++) { await h.tick(); assert.deepEqual(h.encoded.at(-1), transfer.frame(index)); }
    const omittedSource = h.encoded.at(-1); await h.tick();
    assert.match(h.els['frame-position'].textContent, /Naprawa/); assert.notDeepEqual(h.encoded.at(-1), omittedSource);
    let result = await collector.accept(h.encoded.at(-1));
    h.els['animation-toggle'].click(); const before = h.encoded.length; h.setRate(5); assert.equal(h.encoded.length, before);
    h.els['animation-toggle'].click();
    for (let attempt = 0; attempt < 20 && result.kind !== 'complete'; attempt++) { const previous = h.encoded.at(-1); await h.tick(); assert.notDeepEqual(h.encoded.at(-1), previous); result = await collector.accept(h.encoded.at(-1)); }
    assert.equal(result.kind, 'complete'); assert.equal(result.bytes.length, 1920);
  } finally { h.close(); }
});

test('camera recovers lost source packets, exposes complete feedback, and never downloads ACK as a raw file', async () => {
  const h = harness();
  try {
    const original = Uint8Array.from({ length: 1920 }, (_, i) => i % 251);
    const transfer = await h.protocol.createTransfer(original, 'lost-source.bin', { chunkBytes: 384 });
    h.els['decode-tab'].click(); h.els['start-camera'].click(); await h.wait(() => h.videoCallbacks.size === 1);
    await h.fireFrame('camera-video', transfer.frame(0)); assert.equal(h.els['download-file'].disabled, true);
    for (let serial = 0; serial < 30 && h.els['download-file'].disabled; serial++) await h.fireFrame('camera-video', transfer.repairFrame(0, serial));
    assert.equal(h.els['download-file'].disabled, false); assert.equal(h.els['output-name'].value, 'lost-source.bin'); assert.equal(h.streams.at(-1).track.stopped, true);
    h.els['download-file'].click(); const blob = [...h.urls.values()].find((value) => value instanceof Blob); assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), original);
    h.els['show-feedback'].click(); const ack = h.encoded.at(-1); assert.equal(transfer.acceptFeedback(ack).complete, true);
    assert.equal(h.els['resume-receiving'].hidden, true); h.els['close-feedback'].click(); assert.equal(h.els['download-file'].disabled, false);
    h.els['reset-receiver'].click(); h.upload(ack); await h.wait(() => !h.els['choose-image'].disabled);
    assert.equal(h.els['download-file'].disabled, true); assert.match(h.els['decode-message'].textContent, /kod zwrotny/);
  } finally { h.close(); }
});

test('feedback rejects a wrong session, focuses repairs, applies the rate in pause, and accepts only verified completion', async () => {
  const h = harness();
  try {
    h.els['series-sample'].click(); await h.wait(() => !h.els['choose-file'].disabled); const transfer = h.transfers.at(-1);
    const foreign = await h.protocol.createTransfer(new Uint8Array(800).fill(9), 'foreign.bin', { chunkBytes: 384 });
    const foreignReceiver = h.protocol.createCollector(); await foreignReceiver.accept(foreign.frame(0));
    h.els['scan-feedback'].click(); await h.wait(() => [...h.videoCallbacks.values()].some((entry) => entry.video === h.els['feedback-video']));
    await h.fireFrame('feedback-video', foreignReceiver.createFeedback({ suggestedRate: 10 }));
    assert.match(h.els['feedback-message'].textContent, /innego|wcześniejszego/); assert.equal(h.rate(), 2); assert.equal(h.els['source-name'].textContent, 'przyklad-serii-demo.txt');
    const receiver = h.protocol.createCollector(); await receiver.accept(transfer.frame(0));
    await h.fireFrame('feedback-video', receiver.createFeedback({ suggestedRate: 1 }));
    assert.equal(h.rate(), 1); assert.equal(h.els['animation-toggle'].getAttribute('aria-pressed'), 'false'); assert.equal(h.els['feedback-scan-panel'].hidden, true); assert.match(h.els['frame-position'].textContent, /Naprawa/);
    for (let index = 1; index < transfer.total; index++) await receiver.accept(transfer.frame(index));
    h.upload(receiver.createFeedback({ suggestedRate: 2 }), true); await h.wait(() => h.els['animation-toggle'].disabled);
    assert.match(h.els['feedback-message'].textContent, /potwierdził kompletny plik/); assert.equal(h.rate(), 2);
  } finally { h.close(); }
});

test('late camera permissions and stale callbacks cannot restart scanning or alter a replacement source', async () => {
  const h = harness();
  try {
    h.deferMedia = true; h.els['decode-tab'].click(); h.els['start-camera'].click(); await h.wait(() => h.mediaRequests.length === 1);
    h.els['stop-camera'].click(); const late = h.makeStream(); h.mediaRequests.shift()(late); await h.micro(); assert.equal(late.track.stopped, true); assert.equal(h.videoCallbacks.size, 0);
    h.deferMedia = false; h.els['encode-tab'].click(); h.els['series-sample'].click(); await h.wait(() => !h.els['choose-file'].disabled);
    const old = h.transfers.at(-1); const receiver = h.protocol.createCollector(); await receiver.accept(old.frame(0)); const ack = receiver.createFeedback({ suggestedRate: 10 });
    h.els['scan-feedback'].click(); await h.wait(() => h.videoCallbacks.size === 1); const stale = [...h.videoCallbacks.values()][0].fn;
    h.els['transfer-mode'].value = 'auto'; h.choose([new File(['replacement'], 'replacement.txt')]); await h.wait(() => !h.els['choose-file'].disabled);
    h.els['feedback-video'].payload = ack; await stale(h.now, { presentedFrames: 999 });
    assert.equal(h.els['source-name'].textContent, 'replacement.txt'); assert.equal(h.rate(), 2); assert.equal(h.videoCallbacks.size, 0); assert.equal(h.streams.at(-1).track.stopped, true);
  } finally { h.close(); }
});

test('density regenerates the transfer, preserves pause, and keeps raw WireGuard byte-exact', async () => {
  const h = harness();
  try {
    h.els['series-sample'].click(); await h.wait(() => !h.els['choose-file'].disabled); const old = h.transfers.at(-1);
    h.els['qr-density'].value = '600'; h.els['qr-density'].dispatch('change'); await h.wait(() => h.transfers.length === 2 && !h.els['choose-file'].disabled);
    const changed = h.transfers.at(-1); assert.notEqual(old.id, changed.id); assert.equal(changed.chunkBytes, 600); assert.equal(changed.total, 4); assert.throws(() => old.frame(0), (error) => error.code === 'TRANSFER_DISPOSED');
    assert.equal(h.els['animation-toggle'].getAttribute('aria-pressed'), 'false'); assert.match(h.els['encode-message'].textContent, /Reset odbioru/);
    const raw = new TextEncoder().encode('[Interface]\r\nPrivateKey = DEMO\r\n[Peer]\r\nPublicKey = DEMO\r\n'); h.els['transfer-mode'].value = 'auto'; h.choose([new File([raw], 'raw.conf')]); await h.wait(() => !h.els['choose-file'].disabled);
    assert.deepEqual(h.encoded.at(-1), raw); assert.equal(h.els['series-controls'].hidden, true);
    h.choose([new File(['WGQR-ACK is a literal file'], 'reserved.txt')]); await h.wait(() => !h.els['choose-file'].disabled); assert.equal(h.els['series-controls'].hidden, false);
  } finally { h.close(); }
});

test('expanded view declares modal semantics, traps focus, and restores focus on Escape', async () => {
  const h = harness();
  try {
    h.els['sample-file'].click(); await h.wait(() => !h.els['choose-file'].disabled); h.els['expand-qr'].focus(); h.els['expand-qr'].click();
    assert.equal(h.els['qr-result'].getAttribute('role'), 'dialog'); assert.equal(h.els['qr-result'].getAttribute('aria-modal'), 'true'); assert.equal(h.document.activeElement, h.els['close-expanded']);
    let prevented = false; for (const fn of h.events.keydown) fn({ key: 'Tab', shiftKey: true, preventDefault() { prevented = true; } });
    assert.equal(prevented, true); assert.notEqual(h.document.activeElement, h.els['close-expanded']);
    for (const fn of h.events.keydown) fn({ key: 'Escape', preventDefault() {} }); assert.equal(h.document.activeElement, h.els['expand-qr']); assert.equal(h.els['qr-result'].getAttribute('aria-modal'), undefined);
    h.els['expand-qr'].click(); h.els['clear-all'].click(); assert.equal(h.document.body.classList.contains('qr-expanded'), false); assert.equal(h.els['qr-result'].getAttribute('role'), undefined);
  } finally { h.close(); }
});

test('telemetry preserves a paused receiver, freezes the final scan and elapsed time, and supports local copy plus reset', async () => {
  const h = harness();
  try {
    const bytes = new Uint8Array(1152).fill(31);
    const transfer = await h.protocol.createTransfer(bytes, 'private-name-never-export.bin', { chunkBytes: 384 });
    h.els['decode-tab'].click(); h.els['start-camera'].click(); await h.wait(() => h.videoCallbacks.size === 1);
    assert.equal(h.els['transfer-telemetry'].hidden, true);
    await h.fireFrame('camera-video', transfer.frame(0));
    assert.equal(h.els['transfer-telemetry'].hidden, false);
    assert.equal(h.els['telemetry-speed'].textContent, 'po ukończeniu');
    await h.fireFrame('camera-video', transfer.frame(0));
    h.els['stop-camera'].click();
    const paused = h.telemetry.snapshot();
    assert.equal(paused.usefulUnits, 1); assert.equal(paused.redundantPackets, 1); assert.equal(paused.cameraActiveMs, 200);
    h.now += 5000;
    h.els['start-camera'].click(); await h.wait(() => h.videoCallbacks.size === 1);
    await h.fireFrame('camera-video', transfer.frame(1));
    await h.fireFrame('camera-video', transfer.frame(2));
    const completed = JSON.parse(h.telemetry.report());
    assert.equal(completed.complete, true); assert.equal(completed.elapsedMs, 5300); assert.equal(completed.cameraActiveMs, 400);
    assert.equal(completed.cameraStarts, 2); assert.equal(completed.cameraAttempts, 4); assert.equal(completed.opticalReads, 4);
    assert.equal(completed.usefulUnits, 3); assert.equal(completed.acceptedPackets, 4); assert.equal(completed.redundantPackets, 1);
    assert.ok(Math.abs(completed.averageBytesPerSecond - bytes.length / 5.3) < 0.001);
    assert.equal(h.els['receiving-label'].textContent, 'ODBIÓR ZAKOŃCZONY');
    assert.equal(h.els['show-feedback'].textContent, 'Pokaż potwierdzenie');
    h.now += 10000; h.els['show-feedback'].click(); h.els['close-feedback'].click();
    assert.deepEqual(JSON.parse(h.telemetry.report()), completed);
    assert.equal(h.els['transfer-telemetry'].hidden, false); assert.equal(h.els['download-file'].disabled, false);
    h.els['copy-diagnostics'].click(); await h.micro();
    assert.deepEqual(JSON.parse(h.clipboardText), completed);
    assert.equal(h.clipboardText.includes(transfer.name), false); assert.equal(h.clipboardText.includes(transfer.id), false);
    assert.equal(h.clipboardText.includes(transfer.digest), false); assert.equal(h.clipboardText.includes('must-not-export-camera-id'), false);
    h.context.navigator.clipboard.writeText = async () => { throw new Error('denied'); };
    h.els['copy-diagnostics'].click(); await h.micro();
    assert.equal(h.els['diagnostics-text'].hidden, false); assert.equal(h.els['diagnostics-text'].readOnly, true);
    assert.deepEqual(JSON.parse(h.els['diagnostics-text'].value), completed);
    assert.equal(h.els['diagnostics-text'].selectionEnd, h.els['diagnostics-text'].value.length);
    h.els['reset-receiver'].click();
    assert.equal(h.telemetry.snapshot().transfer, null); assert.equal(h.els['transfer-telemetry'].hidden, true);
    assert.equal(h.els['diagnostics-text'].hidden, true); assert.equal(h.els['diagnostics-text'].value, '');
    assert.equal(h.els['copy-diagnostics'].disabled, true);
    const damaged = await h.protocol.createTransfer(new Uint8Array(768).fill(19), 'damaged.bin', { chunkBytes: 384 });
    h.els['start-camera'].click(); await h.wait(() => h.videoCallbacks.size === 1);
    await h.fireFrame('camera-video', damaged.frame(0));
    await h.fireFrame('camera-video', corruptPayloadWithValidCrc(damaged.frame(1)));
    assert.match(h.els['decode-message'].textContent, /Suma pliku nie zgadza/);
    assert.equal(h.telemetry.snapshot().transfer, null); assert.equal(h.els['transfer-telemetry'].hidden, true);
    assert.equal(h.videoCallbacks.size, 1); assert.equal(h.streams.at(-1).track.stopped, false);
    const replacement = await h.protocol.createTransfer(new Uint8Array(768).fill(20), 'replacement.bin', { chunkBytes: 384 });
    await h.fireFrame('camera-video', replacement.frame(0)); await h.fireFrame('camera-video', replacement.frame(1));
    const recovered = h.telemetry.snapshot();
    assert.equal(recovered.complete, true); assert.equal(recovered.usefulUnits, 2); assert.equal(recovered.transfer.total, 2);
    assert.equal(recovered.acceptedPackets, 2); assert.equal(recovered.cameraAttempts, 2); assert.equal(recovered.cameraActiveMs, 200);
  } finally { h.close(); }
});

test('telemetry counts accepted and rejected image QR separately, resets for raw input, and ignores a late copy after clear', async () => {
  const h = harness();
  try {
    const transfer = await h.protocol.createTransfer(new Uint8Array(768).fill(7), 'image-transfer.bin', { chunkBytes: 384 });
    const other = await h.protocol.createTransfer(new Uint8Array(768).fill(8), 'other.bin', { chunkBytes: 384 });
    h.els['decode-tab'].click();
    h.upload(transfer.frame(0)); await h.wait(() => !h.els['choose-image'].disabled);
    h.now += 1000; h.upload(other.frame(0)); await h.wait(() => !h.els['choose-image'].disabled);
    h.now += 1000; h.upload(transfer.frame(1)); await h.wait(() => !h.els['choose-image'].disabled);
    const completed = h.telemetry.snapshot();
    assert.equal(completed.complete, true); assert.equal(completed.imageReads, 3); assert.equal(completed.imagePackets, 2);
    assert.equal(completed.opticalReads, 0); assert.equal(completed.qrReads, 3); assert.equal(completed.rejections.foreign, 1);
    assert.equal(h.els['telemetry-read'].textContent, '3');
    const raw = new TextEncoder().encode('[Interface]\nPrivateKey = NEVER_EXPORT_THIS_CONTENT\n[Peer]\nPublicKey = DEMO\n');
    h.upload(raw); await h.wait(() => !h.els['choose-image'].disabled);
    const plain = h.telemetry.snapshot();
    assert.equal(plain.transfer.version, 0); assert.equal(plain.imageReads, 1); assert.equal(plain.usefulUnits, 1);
    assert.equal(plain.qrReads, 1); assert.equal(plain.complete, true); assert.equal(h.els['telemetry-speed'].textContent, 'nie dotyczy');
    assert.equal(h.telemetry.report().includes('NEVER_EXPORT_THIS_CONTENT'), false);
    let rejectCopy;
    h.context.navigator.clipboard.writeText = () => new Promise((_, reject) => { rejectCopy = reject; });
    h.els['copy-diagnostics'].click(); await h.micro();
    h.els['clear-all'].click(); rejectCopy(new Error('late denial')); await h.micro();
    assert.equal(h.els['transfer-telemetry'].hidden, true); assert.equal(h.els['diagnostics-text'].hidden, true);
    assert.equal(h.els['diagnostics-text'].value, ''); assert.equal(h.els['diagnostics-message'].textContent, '');
    assert.equal(h.telemetry.snapshot().transfer, null);
  } finally { h.close(); }
});
