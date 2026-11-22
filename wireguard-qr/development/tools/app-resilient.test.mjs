import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { unzipSync } from 'fflate';

const root = path.resolve(import.meta.dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sources = ['assets/qr-core.js', 'assets/qr-transfer.js', 'assets/qr-resilient.js', 'assets/zip-core.js',
  'assets/qr-telemetry.js', 'assets/qr-playback.js', 'assets/qr-calibration.js', 'assets/qr-encoder.js']
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

async function collectTransfer(protocol, transfer) {
  const receiver = protocol.createCollector();
  if (transfer.manifestFrame) await receiver.accept(transfer.manifestFrame());
  let result;
  for (let index = 0; index < transfer.total; index++) result = await receiver.accept(transfer.frame(index));
  assert.equal(result.kind, 'complete');
  return result.bytes;
}

function harness() {
  const h = { now: 1000, serial: 0, timers: new Map(), zeroTimers: new Map(), videoCallbacks: new Map(), urls: new Map(),
    encoded: [], encodings: [], rendered: [], matrixBytes: new WeakMap(), canvases: [], downloads: [], transfers: [],
    streams: [], mediaRequests: [], cameraConstraints: [], scannerOptions: [], scanCalls: [], deferMedia: false,
    disposedScanners: 0, events: {}, optical: null, encoderJobs: [], encoderResets: 0, activeEncodes: 0,
    deferEncoding: false, scanJobs: [], activeScans: 0, maxActiveScans: 0, deferScans: false };
  class Element {
    constructor(id = '') {
      this.id = id; this.listeners = {}; this.dataset = {}; this.value = ''; this.hidden = false;
      this.disabled = false; this.open = false; this.checked = false; this.textContent = ''; this.files = [];
      this.children = []; this.parentElement = null; this.attributes = {}; this.isConnected = true; this.tabIndex = 0;
      this.width = this.height = 1; this.readyState = 2; this.videoWidth = this.videoHeight = 300;
      this.currentTime = 0; this.payload = null; this.classes = new Set(); this.style = {}; this.draws = [];
      this.classList = { add: (x) => this.classes.add(x), remove: (x) => this.classes.delete(x), contains: (x) => this.classes.has(x), toggle: (x, on) => on ? this.classes.add(x) : this.classes.delete(x) };
    }
    addEventListener(name, fn) { (this.listeners[name] ??= []).push(fn); }
    dispatch(name, event = {}) { for (const fn of this.listeners[name] || []) fn(event); }
    click() { if (!this.disabled) { if (this.tagName === 'A') h.downloads.push({ name: this.download, blob: h.urls.get(this.href) }); this.dispatch('click'); } }
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
    getContext() {
      const canvas = this;
      return { fillRect() {}, drawImage(image, ...args) {
        canvas.draws.push({ image, args, width: image.width, height: image.height,
          payload: image.payload instanceof Uint8Array ? Uint8Array.from(image.payload) : image.payload });
        // Image decoding sees the appropriate half of an uploaded pair. The full-image
        // attempt may find either QR; the app must deduplicate it before trying each half.
        h.optical = Array.isArray(image.payload) ? image.payload[args.length >= 8 && args[0] > 0 ? 1 : 0] : image.payload;
      }, getImageData() { return { data: new Uint8ClampedArray(4), width: 1, height: 1 }; } };
    }
    toBlob(callback) { const blob = Object.assign(new Blob(['png'], { type: 'image/png' }), { png: { width: this.width, height: this.height, draws: this.draws.slice(), payload: this.payload } }); callback(blob); }
    requestVideoFrameCallback(fn) { const id = ++h.serial; h.videoCallbacks.set(id, { video: this, fn }); return id; }
    cancelVideoFrameCallback(id) { h.videoCallbacks.delete(id); }
  }
  h.els = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map((m) => [m[1], new Element(m[1])]));
  h.els['transfer-mode'].value = 'auto'; h.els['qr-density'].value = '384';
  for (const [id, value] of Object.entries({ 'qr-layout': 'single', 'series-ecc': 'M', 'scan-layout': 'single', 'camera-profile': 'auto', 'calibration-range': 'basic' })) h.els[id].value = value;
  for (const rate of [1, 2, 5, 10, 15, 20]) { const radio = new Element(`rate-${rate}`); radio.value = String(rate); radio.checked = rate === 2; h.els['frame-rate'].appendChild(radio); }
  h.document = { body: new Element('body'), documentElement: { dataset: { appVersion: html.match(/data-app-version="([^"]+)"/)?.[1] || 'test' } }, activeElement: h.els['expand-qr'], hidden: false, getElementById: (id) => h.els[id], createElement: (tag) => { const element = new Element(); element.tagName = tag.toUpperCase(); if (tag === 'canvas') h.canvases.push(element); return element; }, querySelectorAll: () => [], addEventListener: (name, fn) => { (h.events[name] ??= []).push(fn); } };
  for (const id of ['close-expanded', 'expand-qr', 'animation-toggle', 'frame-slider', 'scan-feedback']) h.els['qr-result'].appendChild(h.els[id]);
  class FakeImage {
    set src(value) { if (value) { this.payload = h.urls.get(value)?.payload; this.naturalWidth = Array.isArray(this.payload) ? 600 : 300; this.naturalHeight = 300; queueMicrotask(() => this.onload?.()); } }
  }
  h.makeStream = () => {
    const track = { stopped: false, listeners: {}, stop() { this.stopped = true; }, addEventListener(name, fn) { this.listeners[name] = fn; }, getSettings() { return { width: 1920, height: 1080, frameRate: 30, deviceId: 'must-not-export-camera-id' }; } };
    const stream = { track, getTracks: () => [track], getVideoTracks: () => [track] }; h.streams.push(stream); return stream;
  };
  const context = {
    Uint8Array, Uint8ClampedArray, ArrayBuffer, DataView, TextEncoder, TextDecoder, File, Blob, Image: FakeImage, crypto: webcrypto,
    document: h.document, navigator: { clipboard: { async writeText(text) { h.clipboardText = text; } }, mediaDevices: { getUserMedia(constraints) { h.cameraConstraints.push(constraints); if (h.deferMedia) return new Promise((resolve) => h.mediaRequests.push(resolve)); return Promise.resolve(h.makeStream()); } } },
    URL: { createObjectURL(blob) { const id = `blob:${++h.serial}`; h.urls.set(id, blob); return id; }, revokeObjectURL: (id) => h.urls.delete(id) },
    performance: { now: () => h.now }, isSecureContext: true,
    setTimeout(fn, delay = 0) { const id = ++h.serial; if (delay === 0) h.zeroTimers.set(id, setTimeout(() => { h.zeroTimers.delete(id); fn(); }, 0)); else h.timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { if (h.zeroTimers.has(id)) clearTimeout(h.zeroTimers.get(id)); h.zeroTimers.delete(id); h.timers.delete(id); }, addEventListener(name, fn) { (h.events[name] ??= []).push(fn); },
  };
  context.window = context; h.context = vm.createContext(context);
  for (const source of sources) vm.runInContext(source, h.context);
  h.protocol = h.context.WGResilient;
  const encode = h.context.WGQR.encodeBytes;
  h.context.WGQR = { ...h.context.WGQR, encodeBytes(bytes, options) {
    const copy = Uint8Array.from(bytes); const matrix = encode(bytes, options);
    h.encoded.push(copy); h.encodings.push({ bytes: copy, options, matrix }); h.matrixBytes.set(matrix, copy); h.matrixBytes.set(matrix.data, copy);
    return matrix;
  }, decodePixels: () => h.optical ? { bytes: Uint8Array.from(h.optical) } : null };
  // Preparation can encode several future packets. Assertions about transmission
  // must follow the matrices actually painted on each canvas, not the encoder log.
  h.context.WGRender = { drawQR(matrix, canvas, options = {}) {
    const bytes = h.matrixBytes.get(matrix) || h.matrixBytes.get(matrix.data); assert.ok(bytes, 'Rendered a matrix without encoded bytes');
    canvas.payload = Uint8Array.from(bytes); canvas.matrix = matrix;
    const scale = Math.max(1, Math.floor((options.cssWidth || 600) / (matrix.size + 8)));
    canvas.width = canvas.height = (matrix.size + 8) * scale;
    h.rendered.push({ canvas, bytes: Uint8Array.from(bytes), matrix, options });
    return { size: canvas.width, scale };
  } };
  const createEncoder = h.context.WGEncoder.create;
  h.context.WGEncoder = { ...h.context.WGEncoder, create(options) {
    const encoder = createEncoder(options);
    return {
      encodeBatch(batch) {
        const job = { held: h.deferEncoding, inputs: batch.map(item => Uint8Array.from(item.bytes)), ready: false };
        h.encoderJobs.push(job); h.activeEncodes++;
        return encoder.encodeBatch(batch).then(matrices => {
          job.matrices = matrices; job.ready = true;
          if (!job.held) return matrices;
          // A delayed delivery can outlive reset even if the worker finished first.
          // The app's epoch guard must reject this otherwise valid stale result.
          return new Promise(resolve => { job.release = () => { job.release = null; resolve(matrices); }; });
        }).finally(() => { h.activeEncodes--; job.settled = true; });
      },
      reset() { h.encoderResets++; encoder.reset(); },
      dispose() { encoder.dispose(); }
    };
  } };
  h.context.WGResilient = { ...h.protocol, async createTransfer(...args) { const transfer = await h.protocol.createTransfer(...args); h.transfers.push(transfer); return transfer; } };
  const createTelemetry = h.context.WGTelemetry.create;
  h.context.WGTelemetry = { ...h.context.WGTelemetry, create(options) { h.telemetry = createTelemetry(options); return h.telemetry; } };
  h.context.WGCamera = { createScanner(options) {
    h.scannerOptions.push(options); let disposed = false; let lanes = options.lanes;
    const scan = (video) => {
      assert.equal(disposed, false);
      const payloads = Array.isArray(video.payload) ? video.payload : [video.payload];
      const results = payloads.filter(Boolean).map((bytes) => ({ bytes: Uint8Array.from(bytes) }));
      h.scanCalls.push({ video, lanes, payloads: results.map(result => result.bytes) });
      return { result: results[0] || null, results, attempts: lanes, decodeMs: 25, region: 'tracked', pixels: { width: 300, height: 300 } };
    };
    return { scan, async scanAsync(video) {
      h.activeScans++; h.maxActiveScans = Math.max(h.maxActiveScans, h.activeScans);
      try {
        const sample = scan(video);
        if (!h.deferScans) return sample;
        return await new Promise(resolve => { h.scanJobs.push({ sample, release: () => resolve(sample) }); });
      } finally { h.activeScans--; }
    }, setLanes(value) { lanes = value; }, reset() {}, dispose() { if (!disposed) h.disposedScanners++; disposed = true; } };
  } };
  vm.runInContext(app, h.context);
  h.wait = async (predicate) => { for (let i = 0; i < 600; i++) { if (predicate()) return; await new Promise((resolve) => setTimeout(resolve, 2)); } throw new Error('Timed out waiting for app state'); };
  h.micro = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
  h.flush = async () => {
    for (let attempt = 0; attempt < 300; attempt++) {
      await h.micro();
      if (!h.zeroTimers.size && !h.activeEncodes) return;
      await new Promise(resolve => setTimeout(resolve, 2));
    }
    throw new Error('Timed out draining asynchronous preparation');
  };
  h.display = (id = 'qr-canvas') => h.els[id].payload && Uint8Array.from(h.els[id].payload);
  h.pair = () => [h.display(), ...(h.els['qr-paper-second'].hidden ? [] : [h.display('qr-canvas-second')])];
  h.change = (id, value) => { h.els[id].value = value; h.els[id].dispatch('change'); };
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
  h.tick = async (name = 'tick', { flush = true } = {}) => {
    if (flush) await h.flush();
    const item = [...h.timers.entries()].find(([, entry]) => entry.fn.name === name); assert.ok(item, `No ${name} timer`);
    const [id, entry] = item; h.timers.delete(id); h.now += entry.delay; await entry.fn();
    await h.micro();
  };
  h.rate = () => Number(h.els['frame-rate'].children.find((radio) => radio.checked).value);
  h.setRate = (rate) => { for (const radio of h.els['frame-rate'].children) radio.checked = Number(radio.value) === rate; h.els['frame-rate'].dispatch('change'); };
  h.close = () => { h.els['clear-all'].click(); for (const job of h.encoderJobs) job.release?.(); for (const job of h.scanJobs) job.release(); for (const timer of h.zeroTimers.values()) clearTimeout(timer); h.zeroTimers.clear(); h.timers.clear(); h.videoCallbacks.clear(); };
  return h;
}

test('sender sends all source packets once, then advances repair serials; pause and rate preserve the phase', async () => {
  const h = harness();
  try {
    h.els['series-sample'].click(); await h.wait(() => !h.els['choose-file'].disabled);
    const transfer = h.transfers.at(-1); assert.equal(transfer.version, 3); assert.equal(transfer.total, 5); assert.equal(transfer.chunkBytes, 384); assert.equal(h.rate(), 2);
    assert.equal(h.els['animation-toggle'].getAttribute('aria-pressed'), 'false');
    assert.deepEqual(h.display(), transfer.manifestFrame());
    const collector = h.protocol.createCollector(); await collector.accept(h.display());
    h.els['animation-toggle'].click();
    await h.flush();
    assert.deepEqual(h.display(), transfer.manifestFrame(), 'Prefetch must not replace the visible packet');
    for (let index = 0; index < 5; index++) { await h.tick(); assert.deepEqual(h.display(), transfer.frame(index)); if (index === 0) await collector.accept(h.display()); }
    await h.tick();
    assert.match(h.els['frame-position'].textContent, /Naprawa/); assert.deepEqual(h.display(), transfer.repairFrame(0, 0));
    let result = await collector.accept(h.display());
    h.els['animation-toggle'].click(); const before = h.rendered.length; h.setRate(5); assert.equal(h.rendered.length, before);
    h.els['animation-toggle'].click();
    let repairSerial = 1;
    for (let attempt = 0; attempt < 80 && result.kind !== 'complete'; attempt++) {
      await h.tick();
      const shown = h.display();
      // v3 carries the equation mask, not its generating serial. Different serials
      // can legitimately yield the same equation in a small block.
      assert.deepEqual(shown, shown[9] === 1 ? transfer.manifestFrame() : transfer.repairFrame(0, repairSerial++));
      result = await collector.accept(shown);
    }
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
    h.els['show-feedback'].click(); const ack = h.display('feedback-canvas'); assert.equal(transfer.acceptFeedback(ack).complete, true);
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
    const receiver = h.protocol.createCollector(); await receiver.accept(transfer.manifestFrame()); await receiver.accept(transfer.frame(0));
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
    const old = h.transfers.at(-1); const receiver = h.protocol.createCollector(); await receiver.accept(old.manifestFrame()); await receiver.accept(old.frame(0)); const ack = receiver.createFeedback({ suggestedRate: 10 });
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
    assert.deepEqual(h.display(), raw); assert.equal(h.els['series-controls'].hidden, true);
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

test('dual sender presents distinct source packets and resumes after prefetched pairs without skipping them', async () => {
  const h = harness();
  try {
    h.change('qr-layout', 'dual'); h.change('series-ecc', 'L');
    h.els['series-sample'].click(); await h.wait(() => !h.els['choose-file'].disabled);
    const transfer = h.transfers.at(-1);
    assert.equal(h.els['qr-pair'].dataset.layout, 'dual'); assert.equal(h.els['qr-paper-second'].hidden, false);
    assert.match(h.els['frame-rate-label'].textContent, /pary/);
    assert.match(h.els['estimate-five-label'].textContent, /5 par\/s.*10 QR\/s/);
    assert.deepEqual(h.pair(), [transfer.manifestFrame(), transfer.frame(0)]);
    assert.equal(h.els['qr-canvas'].matrix.level, 'M'); assert.equal(h.els['qr-canvas-second'].matrix.level, 'L');
    h.els['animation-toggle'].click(); await h.flush();
    assert.ok(h.encodings.length >= 8, 'The bounded prefetch queue should contain three future pairs');
    assert.deepEqual(h.pair(), [transfer.manifestFrame(), transfer.frame(0)], 'Encoding ahead must not transmit ahead');
    await h.tick(); assert.deepEqual(h.pair(), [transfer.frame(1), transfer.frame(2)]);
    await h.flush();
    h.els['animation-toggle'].click(); const paused = h.pair(); const paints = h.rendered.length;
    h.setRate(5); await h.micro(); assert.equal(h.rendered.length, paints); assert.deepEqual(h.pair(), paused);
    h.els['animation-toggle'].click(); await h.flush();
    await h.tick(); assert.deepEqual(h.pair(), [transfer.frame(3), transfer.frame(4)]);
    await h.tick(); assert.deepEqual(h.pair(), [transfer.repairFrame(0, 0), transfer.repairFrame(0, 1)]);
    assert.match(h.els['frame-position'].textContent, /Naprawa/);
    assert.equal(h.els['sender-metrics'].hidden, false); assert.match(h.els['sender-rate'].textContent, /zmian\/s.*QR\/s/);
    h.els['transfer-mode'].value = 'auto';
    const plain = new TextEncoder().encode('[Interface]\nPrivateKey = DEMO\n');
    h.choose([new File([plain], 'plain.conf')]); await h.wait(() => !h.els['choose-file'].disabled);
    await h.micro(); assert.deepEqual(h.display(), plain); assert.equal(h.els['qr-paper-second'].hidden, true);
    assert.equal(h.els['qr-pair'].dataset.layout, 'single'); assert.equal(h.timers.size, 0);
  } finally { h.close(); }
});

test('dual camera accepts either lane independently, retries data before its manifest, and isolates foreign packets', async () => {
  const h = harness();
  try {
    const original = Uint8Array.from({ length: 1536 }, (_, index) => (index * 17) % 251);
    const transfer = await h.protocol.createTransfer(original, 'two-lanes.bin', { chunkBytes: 384, compact: true });
    const foreign = await h.protocol.createTransfer(new Uint8Array(768).fill(14), 'foreign.bin', { chunkBytes: 384 });
    h.els['decode-tab'].click(); h.change('scan-layout', 'dual'); h.els['start-camera'].click();
    await h.wait(() => h.videoCallbacks.size === 1);
    assert.equal(h.scannerOptions.at(-1).lanes, 2); assert.equal(h.cameraConstraints.at(-1).video.aspectRatio.ideal, 16 / 9);
    await h.fireFrame('camera-video', [transfer.frame(0), transfer.manifestFrame()]);
    assert.equal(h.telemetry.snapshot().usefulUnits, 1); assert.equal(h.telemetry.snapshot().manifestPackets, 1);
    await h.fireFrame('camera-video', [null, transfer.frame(1)]);
    assert.equal(h.telemetry.snapshot().usefulUnits, 2); assert.equal(h.els['download-file'].disabled, true);
    await h.fireFrame('camera-video', [foreign.frame(0), transfer.frame(2)]);
    assert.equal(h.telemetry.snapshot().usefulUnits, 3); assert.equal(h.telemetry.snapshot().rejections.foreign, 1);
    await h.fireFrame('camera-video', [transfer.frame(2), transfer.frame(3)]);
    const completed = h.telemetry.snapshot();
    assert.equal(completed.complete, true); assert.equal(completed.usefulUnits, 4); assert.equal(completed.redundantPackets, 1);
    assert.equal(completed.cameraAttempts, 4); assert.equal(completed.decodeAttempts, 8); assert.equal(completed.opticalReads, 7);
    assert.equal(h.streams.at(-1).track.stopped, true); assert.equal(h.videoCallbacks.size, 0);
    h.els['download-file'].click(); assert.deepEqual(new Uint8Array(await h.downloads.at(-1).blob.arrayBuffer()), original);
  } finally { h.close(); }
});

test('dual images recover both symbols once even when the first decoded symbol needs the second manifest', async () => {
  const h = harness();
  try {
    const original = Uint8Array.from({ length: 1152 }, (_, index) => index % 239);
    const transfer = await h.protocol.createTransfer(original, 'paired-images.bin', { chunkBytes: 384, compact: true });
    h.els['decode-tab'].click();
    h.upload([transfer.frame(0), transfer.manifestFrame()]); await h.wait(() => !h.els['choose-image'].disabled);
    assert.equal(h.telemetry.snapshot().usefulUnits, 1); assert.equal(h.telemetry.snapshot().manifestPackets, 1);
    assert.equal(h.telemetry.snapshot().imageReads, 2, 'The full-image decode and repeated crop are one QR read');
    h.upload([transfer.frame(1), transfer.frame(2)]); await h.wait(() => !h.els['choose-image'].disabled);
    const completed = h.telemetry.snapshot();
    assert.equal(completed.complete, true); assert.equal(completed.imageReads, 4); assert.equal(completed.usefulUnits, 3);
    assert.equal(completed.redundantPackets, 0);
    h.els['download-file'].click(); assert.deepEqual(new Uint8Array(await h.downloads.at(-1).blob.arrayBuffer()), original);
  } finally { h.close(); }
});

test('v3 feedback presents targeted missing source packets before fountain repairs and skips complete blocks', async () => {
  const h = harness();
  try {
    h.change('qr-layout', 'dual'); h.els['transfer-mode'].value = 'series';
    const original = Uint8Array.from({ length: 67 * 384 }, (_, index) => (index * 31) % 251);
    h.choose([new File([original], 'targeted-repair.bin')]); await h.wait(() => !h.els['choose-file'].disabled);
    const transfer = h.transfers.at(-1); const receiver = h.protocol.createCollector();
    await receiver.accept(transfer.manifestFrame());
    for (let index = 0; index < transfer.total; index++) if (![2, 66].includes(index)) await receiver.accept(transfer.frame(index));
    const feedback = receiver.createFeedback({ suggestedRate: 5 }); const parsed = transfer.acceptFeedback(feedback);
    assert.deepEqual(Array.from(parsed.missingBlocks), [0, 2]);
    assert.deepEqual(Array.from(parsed.repairTargets, target => Array.from(target.missingFrames)), [[2], [66]]);
    h.els['animation-toggle'].click(); await h.flush();
    h.upload(feedback, true); await h.wait(() => !h.els['choose-feedback-image'].disabled);
    assert.equal(h.rate(), 5); assert.equal(h.els['animation-toggle'].getAttribute('aria-pressed'), 'false');
    assert.deepEqual(h.pair(), [transfer.manifestFrame(), transfer.frame(2)]);
    await receiver.accept(h.display()); await receiver.accept(h.display('qr-canvas-second'));
    h.els['animation-toggle'].click(); await h.flush();
    await h.tick(); assert.deepEqual(h.pair(), [transfer.frame(66), transfer.repairFrame(0, 0)]);
    const completed = await receiver.accept(h.display()); assert.equal(completed.kind, 'complete'); assert.deepEqual(completed.bytes, original);
    await h.tick(); assert.deepEqual(h.pair(), [transfer.repairFrame(2, 1), transfer.repairFrame(0, 2)]);
    h.upload(receiver.createFeedback({ suggestedRate: 2 }), true); await h.wait(() => h.els['animation-toggle'].disabled);
    assert.match(h.els['feedback-message'].textContent, /potwierdził kompletny plik/); assert.equal(h.timers.size, 0);
  } finally { h.close(); }
});

test('small files with CAL or SET prefixes use a byte-exact series and cannot be emitted as ambiguous plain QR', async () => {
  const h = harness();
  try {
    for (const prefix of ['WGQR-CAL', 'WGQR-SET']) {
      const original = new Uint8Array([...new TextEncoder().encode(`${prefix} literal file`), 0, 255, 13, 10]);
      h.els['transfer-mode'].value = 'auto'; h.choose([new File([original], 'reserved.bin')]);
      await h.wait(() => !h.els['choose-file'].disabled);
      assert.equal(h.els['series-controls'].hidden, false);
      const transfer = h.transfers.at(-1); const receiver = h.protocol.createCollector();
      await receiver.accept(h.display()); const result = await receiver.accept(transfer.frame(0));
      assert.equal(result.kind, 'complete'); assert.deepEqual(result.bytes, original);
      const count = h.transfers.length;
      h.els['transfer-mode'].value = 'single'; h.choose([new File([original], 'reserved.bin')]);
      await h.wait(() => !h.els['choose-file'].disabled);
      assert.equal(h.transfers.length, count); assert.equal(h.els['qr-result'].hidden, true);
      assert.match(h.els['encode-message'].textContent, /znacznika protokołu/);
    }
  } finally { h.close(); }
});

test('dual PNG export captures both visible symbols at integer module pitch and pauses playback', async () => {
  const h = harness();
  try {
    h.change('qr-layout', 'dual'); h.els['series-sample'].click(); await h.wait(() => !h.els['choose-file'].disabled);
    h.els['animation-toggle'].click(); await h.flush(); await h.tick();
    const pair = h.pair(); h.els['download-qr'].click();
    assert.equal(h.els['animation-toggle'].getAttribute('aria-pressed'), 'false');
    const download = h.downloads.at(-1); assert.equal(download.blob.type, 'image/png');
    assert.match(download.name, /fragment-002-i-fragment-003\.png$/);
    const png = download.blob.png; assert.equal(png.draws.length, 2); assert.ok(png.width > png.height * 2);
    assert.deepEqual(png.draws.map(draw => draw.payload), pair);
    for (const draw of png.draws) {
      assert.equal(draw.width, draw.height); assert.equal(draw.args.length, 2, 'Export must copy each square without stretching it');
      assert.equal(draw.width % (draw.image.matrix.size + 8), 0);
      assert.ok(draw.args.every(Number.isInteger));
    }
    assert.ok(png.draws[0].args[0] + png.draws[0].width < png.draws[1].args[0]);
    assert.equal(h.timers.size, 1, 'Only the download URL cleanup timer should remain');
    assert.ok([...h.timers.values()].every(timer => timer.fn.name !== 'tick'));
  } finally { h.close(); }
});

test('camera profiles restart safely and automatic aspect follows one or two scan lanes', async () => {
  const h = harness();
  try {
    h.els['decode-tab'].click(); h.els['start-camera'].click(); await h.wait(() => h.videoCallbacks.size === 1);
    assert.equal(h.cameraConstraints.at(-1).video.aspectRatio.ideal, 4 / 3); assert.equal(h.scannerOptions.at(-1).lanes, 1);
    const first = h.streams.at(-1); h.change('scan-layout', 'dual');
    await h.wait(() => h.streams.length === 2 && h.videoCallbacks.size === 1);
    assert.equal(first.track.stopped, true); assert.equal(h.cameraConstraints.at(-1).video.aspectRatio.ideal, 16 / 9);
    assert.equal(h.scannerOptions.at(-1).lanes, 2);
    h.change('camera-profile', 'classic'); await h.wait(() => h.streams.length === 3 && h.videoCallbacks.size === 1);
    assert.equal(h.cameraConstraints.at(-1).video.aspectRatio.ideal, 4 / 3);
    h.change('scan-layout', 'single'); assert.equal(h.streams.length, 3);
    await h.fireFrame('camera-video', null); assert.equal(h.scanCalls.at(-1).lanes, 1);
    h.change('camera-profile', 'wide'); await h.wait(() => h.streams.length === 4 && h.videoCallbacks.size === 1);
    assert.equal(h.cameraConstraints.at(-1).video.aspectRatio.ideal, 16 / 9); assert.equal(h.scannerOptions.at(-1).lanes, 1);
    assert.equal(h.streams.filter(stream => !stream.track.stopped).length, 1);
  } finally { h.close(); }
});

test('calibration exchanges a measured dual profile, regenerates the transfer, and leaves file telemetry clean', async () => {
  const sender = harness(); const receiver = harness();
  try {
    const original = Uint8Array.from({ length: 1900 }, (_, index) => (index * 7) % 251);
    sender.change('qr-layout', 'dual'); sender.change('series-ecc', 'L'); sender.els['transfer-mode'].value = 'series';
    sender.choose([new File([original], 'after-calibration.bin')]); await sender.wait(() => !sender.els['choose-file'].disabled);
    const old = sender.transfers.at(-1);
    receiver.els['decode-tab'].click(); receiver.change('scan-layout', 'dual'); receiver.els['start-camera'].click();
    await receiver.wait(() => receiver.videoCallbacks.size === 1);
    const started = sender.now; sender.els['start-calibration'].click();
    await sender.flush();
    await sender.wait(() => sender.context.WGCalibration.isFrame(sender.display()));
    assert.equal(sender.els['stop-calibration'].hidden, false); assert.equal(sender.els['animation-toggle'].disabled, true);
    for (let index = 0; index < 6; index++) {
      const parsed = sender.context.WGCalibration.parse(sender.display());
      assert.equal(parsed.index, index); assert.equal(parsed.lanes, 2); assert.equal(parsed.ecc, 'L');
      // Model a camera which reads three distinct steps of the 600 B / 5 Hz
      // profile. Unreadable profiles should not win just because they send faster.
      if (index === 4) {
        for (let step = 0; step < 3; step++) {
          if (step) await sender.tick('tickCalibration');
          await receiver.fireFrame('camera-video', sender.pair());
        }
      }
      const timer = [...sender.timers.values()].find(item => item.fn.name === 'tickCalibration');
      sender.now = started + (index + 1) * 4000 - timer.delay;
      await sender.tick('tickCalibration');
    }
    assert.equal(sender.context.WGCalibration.parse(sender.display()).ended, true);
    await receiver.fireFrame('camera-video', sender.pair());
    assert.equal(receiver.els['show-calibration-feedback'].hidden, false);
    assert.match(receiver.els['calibration-result'].textContent, /600 B, 5 zmian\/s, 2 QR/);
    assert.equal(receiver.telemetry.snapshot().transfer, null); assert.equal(receiver.els['download-file'].disabled, true);
    receiver.els['show-calibration-feedback'].click(); const feedback = receiver.display('feedback-canvas');
    assert.equal(receiver.context.WGCalibration.isFeedback(feedback), true);
    sender.els['scan-feedback'].click(); await sender.wait(() => sender.videoCallbacks.size === 1);
    await sender.fireFrame('feedback-video', feedback); await sender.wait(() => sender.transfers.length === 2 && !sender.els['choose-file'].disabled);
    const transfer = sender.transfers.at(-1);
    assert.notEqual(transfer.id, old.id); assert.throws(() => old.frame(0), error => error.code === 'TRANSFER_DISPOSED');
    assert.equal(transfer.chunkBytes, 600); assert.equal(sender.rate(), 5); assert.equal(sender.els['series-ecc'].value, 'L');
    assert.equal(sender.els['qr-layout'].value, 'dual'); assert.equal(sender.els['animation-toggle'].getAttribute('aria-pressed'), 'false');
    receiver.els['resume-receiving'].click(); await receiver.wait(() => receiver.videoCallbacks.size === 1);
    await receiver.fireFrame('camera-video', sender.pair());
    assert.equal(receiver.els['calibration-panel'].hidden, true); assert.equal(receiver.telemetry.snapshot().usefulUnits, 1);
    sender.els['animation-toggle'].click();
    for (let step = 0; step < 2; step++) { await sender.tick(); await receiver.fireFrame('camera-video', sender.pair()); }
    assert.equal(receiver.els['download-file'].disabled, false); assert.equal(receiver.telemetry.snapshot().cameraAttempts, 3);
    receiver.els['download-file'].click(); assert.deepEqual(new Uint8Array(await receiver.downloads.at(-1).blob.arrayBuffer()), original);
  } finally { sender.close(); receiver.close(); }
});

test('late asynchronous encoding holds the visible pair and cannot skip packets or repaint after pause and reset', async () => {
  const h = harness();
  try {
    h.change('qr-layout', 'dual'); h.els['series-sample'].click(); await h.wait(() => !h.els['choose-file'].disabled);
    const transfer = h.transfers.at(-1), initial = h.pair();
    h.deferEncoding = true; h.els['animation-toggle'].click();
    await h.wait(() => h.encoderJobs.at(-1)?.ready && h.encoderJobs.at(-1)?.release);
    const pending = h.encoderJobs.at(-1), jobCount = h.encoderJobs.length;
    await h.tick('tick', { flush: false }); await h.tick('tick', { flush: false });
    assert.deepEqual(h.pair(), initial, 'A missed preparation deadline must hold both current QR symbols');
    assert.equal(h.encoderJobs.length, jobCount, 'A busy encoder must not accumulate more work');
    assert.equal(h.els['animation-toggle'].getAttribute('aria-pressed'), 'true');
    h.els['animation-toggle'].click(); h.deferEncoding = false; pending.release(); await h.flush();
    assert.deepEqual(h.pair(), initial); assert.ok(pending.matrices.every(matrix => matrix.data.every(value => value === 0)));
    h.els['animation-toggle'].click(); await h.tick();
    assert.deepEqual(h.pair(), [transfer.frame(1), transfer.frame(2)], 'Resume starts from the last presented checkpoint');
    h.els['animation-toggle'].click();
    h.choose([new File([new Uint8Array(5000).fill(71)], 'replacement-series.bin')]); await h.wait(() => !h.els['choose-file'].disabled);
    h.deferEncoding = true; h.els['animation-toggle'].click();
    await h.wait(() => h.encoderJobs.at(-1)?.ready && h.encoderJobs.at(-1)?.release);
    const stale = h.encoderJobs.at(-1);
    h.els['clear-all'].click(); const paints = h.rendered.length;
    h.deferEncoding = false; stale.release(); await h.flush();
    assert.equal(h.rendered.length, paints); assert.equal(h.els['qr-result'].hidden, true);
    assert.ok(stale.matrices.every(matrix => matrix.data.every(value => value === 0)));
    assert.ok([...h.timers.values()].every(timer => timer.fn.name !== 'tick'));
  } finally { h.close(); }
});

test('camera keeps the newest frame during a slow decode and starts it without waiting for another callback', async () => {
  const h = harness();
  try {
    const original = Uint8Array.from({ length: 1152 }, (_, index) => index % 251);
    const transfer = await h.protocol.createTransfer(original, 'latest-frame.bin', { chunkBytes: 384 });
    h.els['decode-tab'].click(); h.els['start-camera'].click(); await h.wait(() => h.videoCallbacks.size === 1);
    h.deferScans = true;
    const first = h.fireFrame('camera-video', transfer.frame(0)); await h.wait(() => h.scanJobs.length === 1);
    assert.equal(h.videoCallbacks.size, 1, 'The next video callback is armed while the decoder is busy');
    await h.fireFrame('camera-video', transfer.frame(1));
    await h.fireFrame('camera-video', transfer.frame(2));
    assert.equal(h.scanCalls.length, 1); assert.equal(h.activeScans, 1);
    h.deferScans = false; h.scanJobs[0].release(); await first;
    await h.wait(() => h.scanCalls.length === 2 && h.telemetry.snapshot().usefulUnits === 2);
    assert.deepEqual(h.scanCalls.map(call => call.payloads[0]), [transfer.frame(0), transfer.frame(2)]);
    assert.equal(h.maxActiveScans, 1); assert.equal(h.els['download-file'].disabled, true);
    await h.fireFrame('camera-video', transfer.frame(1));
    assert.equal(h.els['download-file'].disabled, false); assert.equal(h.telemetry.snapshot().cameraAttempts, 3);
    assert.equal(h.videoCallbacks.size, 0);
    h.els['download-file'].click(); assert.deepEqual(new Uint8Array(await h.downloads.at(-1).blob.arrayBuffer()), original);
  } finally { h.close(); }
});

test('stopping the camera discards both the pending latest frame and a late worker result', async () => {
  const h = harness();
  try {
    const transfer = await h.protocol.createTransfer(new Uint8Array(768).fill(23), 'cancelled-camera.bin', { chunkBytes: 384 });
    h.els['decode-tab'].click(); h.els['start-camera'].click(); await h.wait(() => h.videoCallbacks.size === 1);
    h.deferScans = true;
    const first = h.fireFrame('camera-video', transfer.frame(0)); await h.wait(() => h.scanJobs.length === 1);
    await h.fireFrame('camera-video', transfer.frame(1)); h.els['stop-camera'].click();
    h.deferScans = false; h.scanJobs[0].release(); await first; await h.micro();
    assert.equal(h.scanCalls.length, 1); assert.equal(h.videoCallbacks.size, 0); assert.equal(h.activeScans, 0);
    assert.equal(h.telemetry.snapshot().transfer, null); assert.equal(h.els['download-file'].disabled, true);
    assert.equal(h.streams.at(-1).track.stopped, true);
  } finally { h.close(); }
});

test('optional single-file ZIP reduces useful series data and unchecking it restores the original bytes', async () => {
  const h = harness();
  try {
    const original = new TextEncoder().encode('\uFEFF' + 'Zażółć gęślą jaźń — dane do przesłania.\r\n'.repeat(700));
    const file = new File([original], 'large-notes.txt');
    h.els['compress-single'].checked = true; h.choose([file]); await h.wait(() => !h.els['choose-file'].disabled);
    const compressed = h.transfers.at(-1); assert.equal(compressed.name, 'large-notes.zip');
    assert.ok(compressed.size < original.length * 0.1); assert.equal(h.els['zip-details'].hidden, false);
    const archive = await collectTransfer(h.protocol, compressed);
    const entries = unzipSync(archive); assert.deepEqual(Object.keys(entries), ['large-notes.txt']);
    assert.deepEqual(entries['large-notes.txt'], original);
    h.els['download-source-zip'].click(); assert.deepEqual(new Uint8Array(await h.downloads.at(-1).blob.arrayBuffer()), archive);
    h.els['compress-single'].checked = false; h.els['compress-single'].dispatch('change');
    await h.wait(() => h.transfers.length === 2 && !h.els['choose-file'].disabled);
    const restored = h.transfers.at(-1); assert.equal(restored.name, 'large-notes.txt'); assert.equal(restored.size, original.length);
    assert.deepEqual(await collectTransfer(h.protocol, restored), original);
    assert.equal(h.els['zip-details'].hidden, true); assert.equal(h.els['download-source-zip'].disabled, true);
    assert.deepEqual(new Uint8Array(await file.arrayBuffer()), original);
    assert.throws(() => compressed.frame(0), error => error.code === 'TRANSFER_DISPOSED');
  } finally { h.close(); }
});

test('optional ZIP retains incompressible bytes, direct WireGuard and pre-existing archives', async () => {
  const h = harness();
  try {
    let seed = 0x1234abcd;
    const original = Uint8Array.from({ length: 6000 }, () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed & 255; });
    h.els['compress-single'].checked = true; h.choose([new File([original], 'noise.bin')]);
    await h.wait(() => !h.els['choose-file'].disabled);
    const unchanged = h.transfers.at(-1); assert.equal(unchanged.name, 'noise.bin'); assert.equal(unchanged.size, original.length);
    assert.deepEqual(await collectTransfer(h.protocol, unchanged), original); assert.equal(h.els['zip-details'].hidden, true);
    assert.match(h.els['encode-message'].textContent, /ZIP nie zmniejszyłby/);
    const conf = new TextEncoder().encode('[Interface]\r\nPrivateKey = DEMO\r\n[Peer]\r\nPublicKey = DEMO\r\n');
    h.els['transfer-mode'].value = 'auto'; const count = h.transfers.length;
    h.choose([new File([conf], 'direct.conf')]); await h.wait(() => !h.els['choose-file'].disabled);
    assert.equal(h.transfers.length, count); assert.equal(h.els['series-controls'].hidden, true); assert.deepEqual(h.display(), conf);
    const archive = await h.context.WGZip.createArchive([new File([conf], 'inside.conf')]);
    const expected = Uint8Array.from(archive.bytes); h.els['transfer-mode'].value = 'series';
    h.choose([new File([expected], 'existing.zip', { type: 'application/zip' })]); await h.wait(() => !h.els['choose-file'].disabled);
    const existing = h.transfers.at(-1); assert.equal(existing.name, 'existing.zip');
    assert.deepEqual(await collectTransfer(h.protocol, existing), expected);
    assert.deepEqual(Object.keys(unzipSync(expected)), ['inside.conf']); archive.bytes.fill(0);
  } finally { h.close(); }
});

test('extended calibration displays ten profiles and applies the measured 20 Hz result to a fresh transfer', async () => {
  const h = harness();
  try {
    h.change('qr-layout', 'dual'); h.change('calibration-range', 'fast');
    h.els['series-sample'].click(); await h.wait(() => !h.els['choose-file'].disabled);
    const old = h.transfers.at(-1), observer = h.context.WGCalibration.createObserver();
    const started = h.now; h.els['start-calibration'].click(); await h.flush();
    assert.match(h.els['calibration-status'].textContent, /40 s/);
    for (let index = 0; index < 10; index++) {
      const parsed = h.context.WGCalibration.parse(h.display());
      assert.equal(parsed.version, 2); assert.equal(parsed.index, index);
      if (index === 9) for (let step = 0; step < 3; step++) {
        if (step) await h.tick('tickCalibration');
        const pair = h.pair();
        assert.equal(h.context.WGCalibration.parse(pair[0]).sequence, step * 2);
        for (const bytes of pair) observer.accept(bytes, h.now);
      }
      const timer = [...h.timers.values()].find(item => item.fn.name === 'tickCalibration');
      assert.ok(timer);
      h.now = started + (index + 1) * 4000 - timer.delay;
      await h.tick('tickCalibration');
    }
    observer.accept(h.display(), h.now);
    assert.equal(observer.state.best.fps, 20); assert.equal(observer.state.best.chunkBytes, 600);
    h.upload(observer.createFeedback(), true); await h.wait(() => h.transfers.length === 2 && !h.els['choose-file'].disabled);
    const transfer = h.transfers.at(-1); assert.notEqual(transfer.id, old.id); assert.equal(transfer.chunkBytes, 600);
    assert.equal(h.rate(), 20); assert.equal(h.els['estimate-twenty-cell'].classList.contains('is-selected'), true);
    assert.match(h.els['estimate-twenty-label'].textContent, /20 par\/s.*40 QR\/s/);
    assert.equal(h.els['animation-toggle'].getAttribute('aria-pressed'), 'false');
    h.els['animation-toggle'].click(); await h.flush();
    const timer = [...h.timers.values()].find(item => item.fn.name === 'tick');
    assert.ok(timer.delay > 0 && timer.delay <= 60, '20 Hz must schedule around 50 ms, not the default 500 ms');
    await h.tick(); assert.deepEqual(h.pair(), [transfer.frame(1), transfer.frame(2)]);
  } finally { h.close(); }
});

test('calibration discards a missed encoding slot and cannot repaint after the trial is stopped', async () => {
  const h = harness();
  try {
    h.change('qr-layout', 'dual'); h.els['series-sample'].click(); await h.wait(() => !h.els['choose-file'].disabled);
    const initial = h.pair(); h.deferEncoding = true; h.els['start-calibration'].click();
    await h.wait(() => h.encoderJobs.at(-1)?.ready && h.encoderJobs.at(-1)?.release);
    const late = h.encoderJobs.at(-1); h.now += 550; h.deferEncoding = false; late.release(); await h.flush();
    assert.deepEqual(h.pair(), initial); assert.ok(late.matrices.every(matrix => matrix.data.every(value => value === 0)));
    await h.tick('tickCalibration');
    assert.equal(h.context.WGCalibration.parse(h.display()).sequence, 2);
    const current = h.pair(); h.deferEncoding = true;
    const next = h.tick('tickCalibration'); await h.wait(() => h.encoderJobs.at(-1)?.ready && h.encoderJobs.at(-1)?.release);
    const cancelled = h.encoderJobs.at(-1); h.els['stop-calibration'].click();
    h.deferEncoding = false; cancelled.release(); await next; await h.flush();
    assert.deepEqual(h.pair(), current); assert.equal(h.els['stop-calibration'].hidden, true);
    assert.equal(h.els['animation-toggle'].disabled, false); assert.ok(cancelled.matrices.every(matrix => matrix.data.every(value => value === 0)));
    assert.ok([...h.timers.values()].every(timer => timer.fn.name !== 'tickCalibration'));
  } finally { h.close(); }
});
