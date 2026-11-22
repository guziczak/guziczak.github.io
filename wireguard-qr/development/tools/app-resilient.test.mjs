import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { unzipSync } from 'fflate';
import { createDiskBackend } from './qr-large-store-fs.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sources = ['assets/qr-core.js', 'assets/qr-transfer.js', 'assets/qr-resilient.js', 'assets/zip-core.js',
  'assets/qr-telemetry.js', 'assets/qr-playback.js', 'assets/qr-calibration.js', 'assets/qr-encoder.js',
  'assets/qr-large-store.js', 'assets/qr-large.js']
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

function harness({ backend } = {}) {
  const h = { now: 1000, serial: 0, timers: new Map(), zeroTimers: new Map(), videoCallbacks: new Map(), urls: new Map(),
    encoded: [], encodings: [], rendered: [], matrixBytes: new WeakMap(), canvases: [], downloads: [], transfers: [],
    streams: [], mediaRequests: [], cameraConstraints: [], scannerOptions: [], scanCalls: [], deferMedia: false,
    disposedScanners: 0, events: {}, optical: null, encoderJobs: [], encoderResets: 0, activeEncodes: 0,
    deferEncoding: false, scanJobs: [], activeScans: 0, maxActiveScans: 0, deferScans: false,
    largeSenders: [], largeSegments: [], largeStores: [], largeStoreOpenCalls: 0, backend,
    deferLargeOpen: false, largeOpenJobs: [] };
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
  for (const [id, value] of Object.entries({ 'qr-layout': 'single', 'series-ecc': 'M', 'scan-layout': 'single', 'camera-profile': 'auto', 'calibration-range': 'basic', 'large-repair': '1' })) h.els[id].value = value;
  h.els['large-auto'].checked = true;
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
  if (backend) Object.assign(context.navigator, { storage: backend.storage, locks: backend.locks });
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
  const large = h.context.WGLarge;
  h.context.WGLarge = { ...large, async createSender(...args) {
    const sender = await large.createSender(...args); h.largeSenders.push(sender);
    const load = sender.loadSegment.bind(sender);
    sender.loadSegment = async (...input) => { const segment = await load(...input); h.largeSegments.push(segment); return segment; };
    return sender;
  } };
  const openLargeStore = h.context.WGLargeStore.open;
  h.context.WGLargeStore = { ...h.context.WGLargeStore, async open(options) {
    h.largeStoreOpenCalls++;
    const store = await openLargeStore(options); h.largeStores.push(store);
    if (h.deferLargeOpen) return new Promise(resolve => {
      h.largeOpenJobs.push({ store, release: () => resolve(store) });
    });
    return store;
  } };
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

async function diskHarness(existingBackend) {
  const directory = existingBackend ? null : await fs.promises.mkdtemp(path.join(import.meta.dirname, 'app-large-test-'));
  const backend = existingBackend || await createDiskBackend(directory);
  const h = harness({ backend });
  h.cleanup = async () => {
    for (const listener of h.events.pagehide || []) listener();
    for (const job of h.largeOpenJobs) job.release();
    h.close();
    for (const store of h.largeStores) await store.dispose();
    if (directory) await fs.promises.rm(directory, { recursive: true, force: true });
  };
  return h;
}

function lazyLargeFile(size, name = 'bounded-large.bin', beforeRead) {
  const audit = { reads: [], fullReads: 0 };
  const file = {
    name, size, type: 'application/octet-stream',
    async arrayBuffer() { audit.fullReads++; throw new Error('Full large-file read is forbidden'); },
    slice(start, end) {
      assert.ok(end - start <= 2 * 1024 * 1024);
      return { async arrayBuffer() {
        audit.reads.push({ start, end });
        if (beforeRead) await beforeRead(start, end);
        return new Uint8Array(end - start).fill((Math.floor(start / (2 * 1024 * 1024)) + 1) & 255).buffer;
      } };
    }
  };
  return { file, audit };
}

async function fileBytes(file) {
  const parts = [];
  for (let offset = 0; offset < file.size; offset += 2 * 1024 * 1024) {
    parts.push(Buffer.from(await file.slice(offset, Math.min(file.size, offset + 2 * 1024 * 1024)).arrayBuffer()));
  }
  return new Uint8Array(Buffer.concat(parts));
}

async function enableDiskReceiver(h) {
  h.els['decode-tab'].click(); h.els['enable-large-receiver'].click();
  await h.wait(() => h.largeStores.length > 0 && !h.els['large-storage-details'].hidden && !h.els['large-delete'].disabled);
  return h.largeStores.at(-1);
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

test('small files with reserved calibration or large-transfer prefixes remain byte-exact through a regular series', async () => {
  const h = harness();
  try {
    for (const prefix of ['WGQR-CAL', 'WGQR-SET', 'WGQR-LRG', 'WGQR-LAK']) {
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

test('large sender reads bounded slices, survives tab changes and calibrates the actual v4 envelope size', async () => {
  const h = harness();
  try {
    const input = lazyLargeFile(11 * 1024 * 1024 + 123);
    h.change('qr-layout', 'dual'); h.change('qr-density', '600'); h.choose([input.file]);
    await h.wait(() => h.largeSegments.length === 1 && !h.els['choose-file'].disabled);
    const sender = h.largeSenders[0], first = h.largeSegments[0];
    assert.equal(h.els['transfer-mode'].value, 'large'); assert.equal(sender.descriptor.segmentCount, 6);
    assert.equal(h.els['large-sender-controls'].hidden, false); assert.equal(h.els['compress-single'].disabled, true);
    assert.equal(input.audit.fullReads, 0); assert.ok(input.audit.reads.every(read => read.end - read.start <= 2 * 1024 * 1024));
    assert.equal(h.context.WGLarge.parseFrame(h.display()).manifest, true);
    assert.equal(h.display('qr-canvas-second').length, 692);
    h.els['decode-tab'].click(); h.els['encode-tab'].click(); h.els['animation-toggle'].click(); await h.tick();
    assert.deepEqual(h.pair(), [first.frame(32), first.frame(64)], 'Large playback interleaves independent blocks');
    h.els['animation-toggle'].click(); h.els['large-next'].click();
    await h.wait(() => h.largeSegments.length === 2 && !h.els['choose-file'].disabled);
    assert.equal(h.largeSegments.at(-1).segmentIndex, 1); assert.throws(() => first.frame(0), error => error.code === 'TRANSFER_DISPOSED');
    h.els['start-calibration'].click(); await h.flush();
    const parsed = h.context.WGCalibration.parse(h.display());
    assert.equal(parsed.large, true); assert.equal(h.display().length, 476); assert.equal(parsed.chunkBytes, 384);
    h.els['stop-calibration'].click(); assert.equal(input.audit.fullReads, 0);
  } finally { h.close(); }
});

test('large feedback selects missing durable segments and waits for final verification before confirming completion', async () => {
  const h = await diskHarness(); let receiver;
  try {
    const segmentSize = 2 * 1024 * 1024, input = lazyLargeFile(segmentSize + 900, 'feedback-large.bin');
    h.els['transfer-mode'].value = 'large'; h.change('qr-density', '600'); h.choose([input.file]);
    await h.wait(() => h.largeSegments.length === 1 && !h.els['choose-file'].disabled);
    const sender = h.largeSenders[0], first = h.largeSegments[0], store = await h.context.WGLargeStore.open();
    await store.begin(sender.descriptor);
    await store.putSegment(0, new Uint8Array(segmentSize).fill(1), first.digest);
    receiver = h.context.WGLarge.createCollector({ store }); await receiver.resume();
    h.upload(receiver.createFeedback({ suggestedRate: 10 }), true);
    await h.wait(() => h.largeSegments.length === 2 && !h.els['choose-file'].disabled);
    const second = h.largeSegments.at(-1);
    assert.equal(second.segmentIndex, 1); assert.equal(h.rate(), 10);
    assert.equal(h.els['animation-toggle'].getAttribute('aria-pressed'), 'false');
    assert.match(h.els['large-segment-status'].textContent, /pozostało 1 części/);
    await store.putSegment(1, new Uint8Array(900).fill(2), second.digest);
    const notVerified = receiver.createFeedback({ suggestedRate: 5 });
    assert.deepEqual(Array.from(sender.acceptFeedback(notVerified).missingSegments), []);
    assert.equal(sender.acceptFeedback(notVerified).complete, false);
    h.upload(notVerified, true);
    await h.wait(() => /Wszystkie części są zapisane/.test(h.els['feedback-message'].textContent));
    assert.equal(h.els['animation-toggle'].disabled, true);
    assert.match(h.els['animation-toggle'].textContent, /Oczekiwanie na sprawdzenie/);
    const loads = h.largeSegments.length;
    h.setRate(2); h.change('qr-layout', 'dual');
    h.els['decode-tab'].click(); h.els['encode-tab'].click();
    h.els['large-next'].click(); h.els['animation-toggle'].click(); await h.flush();
    assert.equal(h.largeSegments.length, loads, 'An empty missing map must not restart segment zero');
    assert.equal(h.els['animation-toggle'].disabled, true); assert.equal(h.els['large-next'].disabled, true);
    assert.ok([...h.timers.values()].every(timer => timer.fn.name !== 'tick'));
    const finished = await receiver.resume(); assert.equal(finished.kind, 'complete');
    h.upload(receiver.createFeedback({ suggestedRate: 2 }), true);
    await h.wait(() => /potwierdził zapis i sprawdzenie/.test(h.els['feedback-message'].textContent));
    assert.equal(h.els['animation-toggle'].textContent, 'Odbiór potwierdzony');
    assert.equal(h.els['animation-toggle'].disabled, true); assert.equal(input.audit.fullReads, 0);
  } finally { receiver?.dispose(); await h.cleanup(); }
});

test('late initial large-file hashing cannot repopulate a cleared source', async () => {
  const h = harness(); let release;
  try {
    let entered;
    const waiting = new Promise(resolve => { entered = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    const input = lazyLargeFile(12 * 1024 * 1024, 'late-source.bin', async () => { entered(); await gate; });
    h.choose([input.file]); await waiting;
    h.els['clear-all'].click(); const paints = h.rendered.length; release(); await h.micro();
    await h.wait(() => !h.els['choose-file'].disabled); await h.flush();
    assert.equal(h.largeSenders.length, 0); assert.equal(h.largeSegments.length, 0); assert.equal(h.rendered.length, paints);
    assert.equal(h.els['qr-result'].hidden, true); assert.equal(h.els['source-name'].textContent, '');
    assert.equal(input.audit.reads.length, 1); assert.equal(input.audit.fullReads, 0);
  } finally { release?.(); h.close(); }
});

test('an in-flight large segment load is invalidated by tab changes and does not replace the restored part', async () => {
  const h = harness(); let release;
  try {
    let hold = false, heldOnce = false, enter;
    const entered = new Promise(resolve => { enter = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    const input = lazyLargeFile(2 * 1024 * 1024 + 900, 'tab-load.bin', async start => {
      if (hold && !heldOnce && start === 2 * 1024 * 1024) { heldOnce = true; enter(); await gate; }
    });
    h.els['transfer-mode'].value = 'large'; h.choose([input.file]);
    await h.wait(() => h.largeSegments.length === 1 && !h.els['choose-file'].disabled);
    hold = true; h.els['large-next'].click(); await entered;
    h.els['decode-tab'].click(); h.els['encode-tab'].click();
    await h.wait(() => h.largeSegments.length === 2 && !h.els['choose-file'].disabled);
    assert.equal(h.largeSegments.at(-1).segmentIndex, 1);
    hold = false; release(); await h.micro();
    assert.equal(h.context.WGLarge.parseFrame(h.display()).segmentIndex, 1);
    h.els['animation-toggle'].click(); await h.tick();
    assert.equal(h.context.WGLarge.parseFrame(h.display()).segmentIndex, 1);
    h.els['animation-toggle'].click(); h.els['large-next'].click();
    await h.wait(() => h.largeSegments.at(-1).segmentIndex === 0 && !h.els['choose-file'].disabled);
    assert.equal(h.context.WGLarge.parseFrame(h.display()).segmentIndex, 0);
  } finally { release?.(); h.close(); }
});

test('large receiver requires explicit storage activation and only offers a file after final disk verification', async () => {
  const h = await diskHarness(); let sender, release;
  try {
    const original = Uint8Array.from({ length: 1500 }, (_, index) => index % 251);
    sender = await h.context.WGLarge.createSender(new File([original], 'received-large.bin'), { chunkBytes: 600 });
    const segment = await sender.loadSegment(0);
    h.els['decode-tab'].click(); h.upload(segment.manifestFrame()); await h.wait(() => !h.els['choose-image'].disabled);
    assert.equal(h.largeStoreOpenCalls, 0); assert.equal(h.backend.audit.writes.length, 0);
    assert.match(h.els['decode-message'].textContent, /Włącz zapis i wznawianie/); assert.equal(h.els['download-file'].disabled, true);
    const store = await enableDiskReceiver(h);
    const trial = h.context.WGCalibration.create({ large: true });
    h.upload(trial.frame(0)); trial.dispose(); await h.wait(() => !h.els['choose-image'].disabled);
    assert.equal(h.els['calibration-panel'].hidden, false); assert.equal(h.telemetry.snapshot().transfer, null);
    h.upload(segment.manifestFrame()); await h.wait(() => !h.els['choose-image'].disabled);
    assert.equal(h.els['calibration-panel'].hidden, true);
    assert.equal(h.telemetry.snapshot().imageReads, 1, 'A large-file image must start fresh telemetry after calibration');
    h.change('scan-layout', 'dual'); h.els['start-camera'].click(); await h.wait(() => h.videoCallbacks.size === 1);
    h.now += 300; // Allow the deliberately throttled progress UI to paint this first manifest.
    await h.fireFrame('camera-video', [segment.frame(0), segment.manifestFrame()]);
    assert.equal(h.telemetry.snapshot().transfer.version, 4); assert.equal(h.telemetry.snapshot().usefulUnits, 0);
    assert.equal(store.state.savedBytes, 0); assert.match(h.els['receiving-count'].textContent, /0 \/ 1/);
    await h.fireFrame('camera-video', segment.frame(1));
    let enter;
    const entered = new Promise(resolve => { enter = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    h.backend.faults.before = async event => { if (event.op === 'close' && event.path.endsWith('received.zip')) { enter(); await gate; } };
    const pending = h.fireFrame('camera-video', segment.frame(2)); await entered;
    assert.equal(store.state.completed[0], true); assert.equal(store.state.complete, false);
    assert.equal(h.els['download-file'].disabled, true); assert.equal(h.telemetry.snapshot().complete, false);
    release(); await pending;
    assert.equal(h.els['download-file'].disabled, false); assert.equal(h.telemetry.snapshot().usefulUnits, 1);
    h.els['download-file'].click(); const download = h.downloads.at(-1);
    assert.equal(download.name, 'received-large.bin'); assert.equal(download.blob instanceof Blob, false);
    assert.deepEqual(await fileBytes(download.blob), original);
    h.els['show-feedback'].click(); assert.equal(sender.acceptFeedback(h.display('feedback-canvas')).complete, true);
    h.els['clear-all'].click(); assert.equal(h.els['download-file'].disabled, true); assert.equal(store.state.complete, true);
    h.els['large-resume'].click(); await h.wait(() => !h.els['download-file'].disabled);
    assert.equal(h.els['output-name'].value, 'received-large.bin');
  } finally { release?.(); sender?.dispose(); await h.cleanup(); }
});

test('partial reset and pagehide preserve durable segments; resume, feedback, download and explicit deletion remain correct', async () => {
  const h = await diskHarness(); let reopened, sender;
  try {
    const segmentSize = 2 * 1024 * 1024, original = new Uint8Array(segmentSize + 1201).fill(37);
    sender = await h.context.WGLarge.createSender(new File([original], 'resume-large.bin'), { chunkBytes: 600 });
    const first = await sender.loadSegment(0), seedStore = await h.context.WGLargeStore.open();
    await seedStore.begin(sender.descriptor); await seedStore.putSegment(0, original.subarray(0, segmentSize), first.digest); await seedStore.dispose();
    const store = await enableDiskReceiver(h), second = await sender.loadSegment(1);
    assert.equal(store.state.savedBytes, segmentSize); assert.match(h.els['receiving-count'].textContent, /1 \/ 2/);
    h.els['show-feedback'].click(); assert.deepEqual(Array.from(sender.acceptFeedback(h.display('feedback-canvas')).missingSegments), [1]);
    h.els['resume-receiving'].click(); await h.wait(() => h.videoCallbacks.size === 1);
    await h.fireFrame('camera-video', second.manifestFrame()); await h.fireFrame('camera-video', second.frame(0));
    assert.equal(h.telemetry.snapshot().usefulUnits, 0); h.els['reset-receiver'].click();
    assert.equal(store.state.savedBytes, segmentSize); assert.equal(h.els['download-file'].disabled, true);
    // A direct scan after reset must use the durable byte count as its baseline,
    // even when the user does not explicitly press the resume-storage button.
    h.els['start-camera'].click(); await h.wait(() => h.videoCallbacks.size === 1);
    await h.fireFrame('camera-video', second.manifestFrame());
    for (let index = 0; index < second.total; index++) await h.fireFrame('camera-video', second.frame(index));
    assert.equal(h.els['download-file'].disabled, false); assert.equal(h.telemetry.snapshot().usefulUnits, 1);
    h.els['copy-diagnostics'].click(); await h.micro();
    const diagnostics = JSON.parse(h.clipboardText);
    assert.equal(diagnostics.large.restoredBytes, segmentSize); assert.equal(diagnostics.large.savedBytes, original.length);
    assert.equal(diagnostics.large.completedSegments, 2);
    assert.ok(diagnostics.elapsedMs > 0);
    assert.equal(diagnostics.large.measurement, 'newly-saved-bytes-in-this-session');
    assert.equal(diagnostics.averageBytesPerSecond, Math.round(1201 * 1000 / diagnostics.elapsedMs * 1000) / 1000,
      'Previously saved MiB must not inflate the speed of the resumed 1201-byte transfer');
    h.els['download-file'].click(); assert.deepEqual(await fileBytes(h.downloads.at(-1).blob), original);
    for (const callback of h.events.pagehide) callback(); await store.dispose();
    assert.equal(h.urls.size, 0); assert.equal(h.videoCallbacks.size, 0); assert.equal(store.state.complete, true);
    reopened = await diskHarness(h.backend); await enableDiskReceiver(reopened);
    await reopened.wait(() => !reopened.els['download-file'].disabled);
    assert.equal(reopened.els['output-name'].value, 'resume-large.bin');
    reopened.els['show-feedback'].click(); assert.equal(sender.acceptFeedback(reopened.display('feedback-canvas')).complete, true);
    reopened.els['large-delete'].click(); assert.equal(reopened.els['large-delete-question'].hidden, false);
    reopened.els['large-delete-cancel'].click(); assert.equal(reopened.largeStores.at(-1).state.complete, true);
    reopened.els['large-delete'].click(); reopened.els['large-delete-confirm'].click();
    await reopened.wait(() => reopened.largeStores.at(-1).state.descriptor === null);
    assert.equal(reopened.els['download-file'].disabled, true); assert.equal(reopened.els['large-delete-question'].hidden, true);
  } finally { sender?.dispose(); if (reopened) await reopened.cleanup(); await h.cleanup(); }
});

test('late storage opening after clear or receiver reset is disposed and cannot restore a completed file', async t => {
  for (const control of ['clear-all', 'reset-receiver']) await t.test(control, async () => {
    const h = await diskHarness(); let sender;
    try {
      const original = new Uint8Array(90).fill(29);
      sender = await h.context.WGLarge.createSender(new File([original], 'late-open.bin'), { chunkBytes: 600 });
      const segment = await sender.loadSegment(0), seedStore = await h.context.WGLargeStore.open();
      await seedStore.begin(sender.descriptor); await seedStore.putSegment(0, original, segment.digest); await seedStore.finish(); await seedStore.dispose();
      h.deferLargeOpen = true; h.els['decode-tab'].click(); h.els['enable-large-receiver'].click();
      await h.wait(() => h.largeOpenJobs.length === 1);
      h.els[control].click(); h.deferLargeOpen = false; h.largeOpenJobs[0].release(); await h.micro();
      await h.wait(() => !h.els['enable-large-receiver'].disabled);
      assert.equal(h.els['download-file'].disabled, true); assert.equal(h.els['large-storage-details'].hidden, true);
      await assert.rejects(h.largeOpenJobs[0].store.file(), error => error.code === 'STORE_CANCELLED');
      h.els['enable-large-receiver'].click(); await h.wait(() => !h.els['download-file'].disabled);
      assert.equal(h.els['output-name'].value, 'late-open.bin');
    } finally { sender?.dispose(); await h.cleanup(); }
  });
});
