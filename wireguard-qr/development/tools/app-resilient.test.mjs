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
  'assets/qr-telemetry.js', 'assets/qr-playback.js', 'assets/qr-calibration.js', 'assets/qr-calibration-view.js', 'assets/qr-encoder.js',
  'assets/qr-large-store.js', 'assets/qr-large.js']
  .map((name) => fs.readFileSync(path.join(root, name), 'utf8'));
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function htmlAncestorIds(id) {
  const stack = [];
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  for (const match of html.matchAll(/<(\/?)([a-z][\w:-]*)([^>]*)>/gi)) {
    const [, closing, tag, attributes] = match;
    if (closing) {
      const index = stack.findLastIndex(node => node.tag === tag);
      if (index >= 0) stack.length = index;
      continue;
    }
    const nodeId = attributes.match(/\bid="([^"]+)"/)?.[1];
    if (nodeId === id) return stack.map(node => node.id).filter(Boolean);
    if (!voidTags.has(tag) && !/\/\s*$/.test(attributes)) stack.push({ tag, id: nodeId });
  }
  assert.fail(`Missing HTML element: ${id}`);
}

function descendants(element) {
  return element.children.flatMap(child => [child, ...descendants(child)]);
}

function renderedText(element) {
  return [element.textContent, ...element.children.map(renderedText)].filter(Boolean).join(' ');
}

function calibrationCells(h) {
  return descendants(h.els['calibration-map']).filter(element =>
    element.tagName === 'TD' && element.dataset.profileIndex !== undefined);
}

function calibrationCell(h, index) {
  const cell = calibrationCells(h).find(element => Number(element.dataset.profileIndex) === index);
  assert.ok(cell, `Missing calibration profile ${index} in the receiver map.`);
  return cell;
}

function assertReceiverView(h, view) {
  const calibration = view === 'calibration';
  assert.equal(h.els['decode-panel'].dataset.receiverView, view);
  assert.equal(h.els['receiver-view-calibration'].getAttribute('aria-pressed'), String(calibration));
  assert.equal(h.els['receiver-view-file'].getAttribute('aria-pressed'), String(!calibration));
  assert.equal(h.els['receiver-calibration-dashboard'].hidden, !calibration);
  assert.equal(h.els['receiver-file-input'].hidden, calibration);
  assert.equal(h.els['receiver-file-output'].hidden, calibration);
}

function assertCalibrationCounts(h, expected) {
  for (const [name, count] of Object.entries(expected)) {
    assert.equal(h.els[`calibration-count-${name}`].textContent, String(count), `Wrong ${name} profile count.`);
  }
}

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

function harness({ backend, withResizeObserver = true, withVisualViewport = true } = {}) {
  const h = { now: 1000, serial: 0, timers: new Map(), zeroTimers: new Map(), videoCallbacks: new Map(), urls: new Map(),
    encoded: [], encodings: [], rendered: [], matrixBytes: new WeakMap(), canvases: [], downloads: [], transfers: [],
    streams: [], mediaRequests: [], cameraConstraints: [], scannerOptions: [], scanCalls: [], deferMedia: false,
    disposedScanners: 0, events: {}, optical: null, encoderJobs: [], encoderResets: 0, activeEncodes: 0, maxActiveEncodes: 0,
    deferEncoding: false, scanJobs: [], activeScans: 0, maxActiveScans: 0, deferScans: false,
    deferCollectorAccept: false, collectorJobs: [],
    largeSenders: [], largeSegments: [], largeStores: [], largeStoreOpenCalls: 0, backend,
    deferLargeOpen: false, largeOpenJobs: [], resizeObservers: [], scannerGridChanges: [], calibrationViewComputes: 0 };
  class Element {
    constructor(id = '') {
      this.id = id; this.listeners = {}; this.dataset = {}; this.value = ''; this.hidden = false;
      this.disabled = false; this.open = false; this.checked = false; this.textContent = ''; this.files = [];
      this.children = []; this.parentElement = null; this.attributes = {}; this.isConnected = true; this.tabIndex = 0;
      this.width = this.height = 1; this.readyState = 2; this.videoWidth = this.videoHeight = 300;
      this.clientWidth = 640; this.clientHeight = 360;
      this.currentTime = 0; this.presentedFrames = 0; this.payload = null; this.classes = new Set(); this.draws = [];
      this.style = { setProperty(name, value) { this[name] = String(value); }, getPropertyValue(name) { return this[name] || ''; }, removeProperty(name) { const value = this[name] || ''; delete this[name]; return value; } };
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
    appendChild(node) {
      if (node.parentElement) {
        const previous = node.parentElement.children.indexOf(node);
        if (previous >= 0) node.parentElement.children.splice(previous, 1);
      }
      this.children.push(node); node.parentElement = this;
    }
    replaceChildren(...nodes) { this.children = []; for (const node of nodes) this.appendChild(node); }
    remove() {}
    contains(node) { return node === this || this.children.some((child) => child.contains(node)); }
    closest(selector) { for (let node = this; node; node = node.parentElement) if (selector === '[hidden]' && node.hidden) return node; return null; }
    getClientRects() { return this.closest('[hidden]') ? [] : [{}]; }
    getBoundingClientRect() {
      const width = Number.parseFloat(this.style.width) || this.clientWidth;
      const height = Number.parseFloat(this.style.height) || this.clientHeight;
      return { x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height };
    }
    querySelector(selector) { return selector === 'input:checked' ? this.children.find((child) => child.checked) : null; }
    querySelectorAll(selector) { return selector === 'input[type="radio"]' ? this.children : this.children.flatMap((child) => [child, ...child.children]); }
    pause() {}
    play() { return Promise.resolve(); }
    getContext() {
      const canvas = this;
      return { fillRect() {}, drawImage(image, ...args) {
        canvas.draws.push({ image, args, width: image.width, height: image.height,
          payload: image.payload instanceof Uint8Array ? Uint8Array.from(image.payload) : image.payload });
        // Uploaded grid crops reveal their own symbol. A full-image decode finds
        // the first QR again, which the app must deduplicate against later crops.
        if (Array.isArray(image.payload)) {
          const columns = image.qrGrid?.columns || image.payload.length;
          const rows = image.qrGrid?.rows || 1;
          const column = args.length >= 8 ? Math.min(columns - 1, Math.floor(args[0] * columns / image.naturalWidth)) : 0;
          const row = args.length >= 8 ? Math.min(rows - 1, Math.floor(args[1] * rows / image.naturalHeight)) : 0;
          h.optical = image.payload[row * columns + column];
        } else h.optical = image.payload;
      }, getImageData() { return { data: new Uint8ClampedArray(4), width: 1, height: 1 }; } };
    }
    toBlob(callback) { const blob = Object.assign(new Blob(['png'], { type: 'image/png' }), { png: { width: this.width, height: this.height, draws: this.draws.slice(), payload: this.payload } }); callback(blob); }
    requestVideoFrameCallback(fn) { const id = ++h.serial; h.videoCallbacks.set(id, { video: this, fn }); return id; }
    cancelVideoFrameCallback(id) { h.videoCallbacks.delete(id); }
  }
  h.els = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map((m) => [m[1], new Element(m[1])]));
  // Match the browser's initial selection instead of maintaining separate defaults
  // that can hide a changed product setting from integration tests.
  for (const select of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) {
    const id = select[1].match(/\bid="([^"]+)"/)?.[1];
    if (!id || !h.els[id]) continue;
    const options = [...select[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)];
    const selected = options.find(option => /(?:^|\s)selected(?:\s|=|$)/i.test(option[1])) || options[0];
    if (selected) h.els[id].value = selected[1].match(/\bvalue="([^"]*)"/)?.[1] ?? selected[2].trim();
  }
  h.els['large-auto'].checked = true;
  for (const rate of [1, 2, 5, 10, 15, 20]) { const radio = new Element(`rate-${rate}`); radio.value = String(rate); radio.checked = rate === 2; h.els['frame-rate'].appendChild(radio); }
  h.document = { body: new Element('body'), documentElement: { clientWidth: 1280, clientHeight: 800, dataset: { appVersion: html.match(/data-app-version="([^"]+)"/)?.[1] || 'test' } }, activeElement: h.els['expand-qr'], hidden: false, getElementById: (id) => h.els[id], createElement: (tag) => { const element = new Element(); element.tagName = tag.toUpperCase(); if (tag === 'canvas') h.canvases.push(element); return element; }, querySelectorAll: () => [], addEventListener: (name, fn) => { (h.events[name] ??= []).push(fn); } };
  for (const id of ['close-expanded', 'expand-qr', 'animation-toggle', 'frame-slider', 'calibration-display-slot']) h.els['qr-result'].appendChild(h.els[id]);
  h.els['encode-panel'].appendChild(h.els['calibration-home']);
  h.els['encode-panel'].appendChild(h.els['qr-result']);
  h.els['calibration-home'].appendChild(h.els['calibration-setup']);
  for (const id of ['start-calibration', 'begin-calibration', 'stop-calibration', 'calibration-range', 'calibration-layout-scope', 'sender-feedback']) {
    h.els['calibration-setup'].appendChild(h.els[id]);
  }
  for (const id of ['scan-feedback', 'feedback-scan-panel', 'feedback-message']) h.els['sender-feedback'].appendChild(h.els[id]);
  for (const id of ['choose-feedback-image', 'stop-feedback-camera', 'feedback-image-input']) h.els['feedback-scan-panel'].appendChild(h.els[id]);
  for (const [container, stage, video] of [
    ['camera-box', 'camera-stage', 'camera-video'], ['feedback-scan-panel', 'feedback-camera-stage', 'feedback-video']
  ]) {
    h.els[container].appendChild(h.els[stage]);
    h.els[stage].appendChild(h.els[video]);
  }
  // Receiver panels share one camera. Keep their actual HTML ancestry so tests
  // catch a visible result or feedback button accidentally hidden by a wrapper.
  for (const id of ['receiver-view-switch', 'receiver-view-file', 'receiver-view-calibration',
    'receiver-file-input', 'receiver-file-output', 'receiver-calibration-dashboard',
    'calibration-view-status', 'calibration-current-grid', 'calibration-current-rate',
    'calibration-current-density', 'calibration-current-detail', 'calibration-count-passed',
    'calibration-count-failed', 'calibration-count-pending', 'calibration-count-running',
    'calibration-map', 'calibration-map-help', 'calibration-panel', 'calibration-results',
    'calibration-result', 'calibration-coverage', 'show-calibration-feedback', 'reset-calibration',
    'camera-box', 'start-camera', 'stop-camera', 'decoded-empty', 'decoded-result',
    'download-file', 'receiving-progress', 'reset-receiver', 'show-feedback', 'transfer-telemetry',
    'feedback-panel', 'feedback-canvas', 'resume-receiving']) {
    const parent = htmlAncestorIds(id).at(-1);
    if (parent) h.els[parent].appendChild(h.els[id]);
  }
  h.visualViewport = new Element('visual-viewport');
  h.visualViewport.width = 1280; h.visualViewport.height = 800;
  class FakeResizeObserver {
    constructor(callback) { this.callback = callback; this.targets = new Set(); this.disconnected = false; h.resizeObservers.push(this); }
    observe(target) { this.targets.add(target); this.disconnected = false; }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); this.disconnected = true; }
  }
  class FakeImage {
    set src(value) {
      if (value) {
        const file = h.urls.get(value); this.payload = file?.payload; this.qrGrid = file?.qrGrid;
        this.naturalWidth = 300 * (this.qrGrid?.columns || (Array.isArray(this.payload) ? this.payload.length : 1));
        this.naturalHeight = 300 * (this.qrGrid?.rows || 1); queueMicrotask(() => this.onload?.());
      }
    }
  }
  h.makeStream = () => {
    const track = { stopped: false, listeners: {}, stop() { this.stopped = true; }, addEventListener(name, fn) { this.listeners[name] = fn; }, getSettings() { return { width: 1920, height: 1080, frameRate: 30, deviceId: 'must-not-export-camera-id' }; } };
    const stream = { track, getTracks: () => [track], getVideoTracks: () => [track] }; h.streams.push(stream); return stream;
  };
  const context = {
    Uint8Array, Uint8ClampedArray, ArrayBuffer, DataView, TextEncoder, TextDecoder, File, Blob, Image: FakeImage, crypto: webcrypto,
    document: h.document, navigator: { clipboard: { async writeText(text) { h.clipboardText = text; } }, mediaDevices: { getUserMedia(constraints) { h.cameraConstraints.push(constraints); if (h.deferMedia) return new Promise((resolve) => h.mediaRequests.push(resolve)); return Promise.resolve(h.makeStream()); } } },
    URL: { createObjectURL(blob) { const id = `blob:${++h.serial}`; h.urls.set(id, blob); return id; }, revokeObjectURL: (id) => h.urls.delete(id) },
    performance: { now: () => h.now }, isSecureContext: true, innerWidth: 1280, innerHeight: 800,
    setTimeout(fn, delay = 0) { const id = ++h.serial; if (delay === 0) h.zeroTimers.set(id, setTimeout(() => { h.zeroTimers.delete(id); fn(); }, 0)); else h.timers.set(id, { fn, delay, dueAt: h.now + delay }); return id; },
    clearTimeout(id) { if (h.zeroTimers.has(id)) clearTimeout(h.zeroTimers.get(id)); h.zeroTimers.delete(id); h.timers.delete(id); }, addEventListener(name, fn) { (h.events[name] ??= []).push(fn); },
  };
  if (withVisualViewport) context.visualViewport = h.visualViewport;
  if (withResizeObserver) context.ResizeObserver = FakeResizeObserver;
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
  h.context.WGRender = { clear(canvas) { canvas.width = canvas.height = 1; canvas.payload = null; }, drawQR(matrix, canvas, options = {}) {
    const bytes = h.matrixBytes.get(matrix) || h.matrixBytes.get(matrix.data); assert.ok(bytes, 'Rendered a matrix without encoded bytes');
    canvas.payload = Uint8Array.from(bytes); canvas.matrix = matrix;
    const scale = Math.max(1, Math.floor((options.cssWidth || 600) / (matrix.size + 8)));
    canvas.width = canvas.height = (matrix.size + 8) * scale;
    h.rendered.push({ canvas, bytes: Uint8Array.from(bytes), matrix, options, at: h.now });
    return { size: canvas.width, scale };
  } };
  const createEncoder = h.context.WGEncoder.create;
  h.context.WGEncoder = { ...h.context.WGEncoder, create(options) {
    const encoder = createEncoder(options);
    return {
      encodeBatch(batch) {
        const job = { held: h.deferEncoding, inputs: batch.map(item => Uint8Array.from(item.bytes)), ready: false };
        h.encoderJobs.push(job); h.activeEncodes++; h.maxActiveEncodes = Math.max(h.maxActiveEncodes, h.activeEncodes);
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
  h.context.WGResilient = { ...h.protocol,
    async createTransfer(...args) { const transfer = await h.protocol.createTransfer(...args); h.transfers.push(transfer); return transfer; },
    createCollector(...args) {
      const collector = h.protocol.createCollector(...args), accept = collector.accept;
      collector.accept = async (...input) => {
        const held = h.deferCollectorAccept, result = await accept(...input);
        if (!held) return result;
        return new Promise(resolve => {
          const job = { result, release() { job.release = null; resolve(result); } };
          h.collectorJobs.push(job);
        });
      };
      return collector;
    }
  };
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
  const createCalibrationView = h.context.WGCalibrationView.create;
  h.context.WGCalibrationView = { ...h.context.WGCalibrationView, create(options) {
    const view = createCalibrationView(options);
    return { ...view, compute(...args) { h.calibrationViewComputes++; return view.compute(...args); } };
  } };
  h.context.WGCamera = { createScanner(options) {
    h.scannerOptions.push(options); let disposed = false;
    let columns = options.columns || options.lanes || 1, rows = options.rows || 1, lanes = columns * rows;
    const scan = (video) => {
      assert.equal(disposed, false);
      const payloads = Array.isArray(video.payload) ? video.payload : [video.payload];
      const results = payloads.filter(Boolean).map((bytes) => ({ bytes: Uint8Array.from(bytes) }));
      h.scanCalls.push({ video, lanes, columns, rows, payloads: results.map(result => result.bytes) });
      return { result: results[0] || null, results, attempts: lanes, decodeMs: 25, region: 'tracked', pixels: { width: 300, height: 300 } };
    };
    return { scan, async scanAsync(video) {
      h.activeScans++; h.maxActiveScans = Math.max(h.maxActiveScans, h.activeScans);
      try {
        const sample = scan(video);
        if (!h.deferScans) return sample;
        return await new Promise(resolve => { h.scanJobs.push({ sample, release: () => resolve(sample) }); });
      } finally { h.activeScans--; }
    }, setLanes(value) { columns = value; rows = 1; lanes = value; }, setGrid(nextColumns, nextRows) {
      columns = nextColumns; rows = nextRows; lanes = columns * rows;
      h.scannerGridChanges.push({ columns, rows, lanes });
    }, reset() {}, dispose() { if (!disposed) h.disposedScanners++; disposed = true; } };
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
  h.grid = () => [h.display(), ...Array.from({ length: 14 }, (_, index) => index + 1)
    .filter(index => !h.els[index === 1 ? 'qr-paper-second' : `qr-paper-${index + 1}`].hidden)
    .map(index => h.display(index === 1 ? 'qr-canvas-second' : `qr-canvas-${index + 1}`))];
  h.pair = h.grid;
  h.change = (id, value) => { h.els[id].value = value; h.els[id].dispatch('change'); };
  h.dispatchWindow = (name, event = {}) => { for (const listener of h.events[name] || []) listener(event); };
  h.notifyResize = target => {
    for (const observer of h.resizeObservers) {
      if (observer.targets.has(target)) observer.callback([{ target, contentRect: target.getBoundingClientRect() }], observer);
    }
  };
  h.choose = (files) => { h.els['file-input'].files = files; h.els['file-input'].dispatch('change'); };
  h.upload = (payload, feedback = false, qrGrid = undefined) => {
    const input = h.els[feedback ? 'feedback-image-input' : 'image-input'];
    input.files = [Object.assign(new File(['image'], 'qr.png', { type: 'image/png' }), { payload, qrGrid })]; input.dispatch('change');
  };
  h.fireFrame = async (videoId, payload, { advanceMs = 100 } = {}) => {
    const video = h.els[videoId];
    const item = [...h.videoCallbacks.entries()].find(([, entry]) => entry.video === video);
    assert.ok(item, `No callback for ${videoId}`); const [id, { fn }] = item; h.videoCallbacks.delete(id);
    video.payload = payload; h.now += advanceMs; video.currentTime += advanceMs / 1000; video.presentedFrames++;
    await fn(h.now, { presentedFrames: video.presentedFrames, mediaTime: video.currentTime });
    return fn;
  };
  h.tick = async (name = 'tick', { flush = true } = {}) => {
    if (flush) await h.flush();
    const item = [...h.timers.entries()].find(([, entry]) => entry.fn.name === name); assert.ok(item, `No ${name} timer`);
    const [id, entry] = item; h.timers.delete(id); h.now = Math.max(h.now, entry.dueAt); await entry.fn();
    await h.micro();
  };
  h.rate = () => Number(h.els['frame-rate'].children.find((radio) => radio.checked).value);
  h.setRate = (rate) => { for (const radio of h.els['frame-rate'].children) radio.checked = Number(radio.value) === rate; h.els['frame-rate'].dispatch('change'); };
  h.close = () => { h.els['clear-all'].click(); for (const job of h.encoderJobs) job.release?.(); for (const job of h.scanJobs) job.release(); for (const job of h.collectorJobs) job.release?.(); for (const timer of h.zeroTimers.values()) clearTimeout(timer); h.zeroTimers.clear(); h.timers.clear(); h.videoCallbacks.clear(); };
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

async function openCalibration(h) {
  h.els['start-calibration'].click(); await h.flush();
  await h.wait(() => !h.els['begin-calibration'].hidden);
  const parsed = h.context.WGCalibration.parse(h.display());
  assert.ok([3, 4, 5].includes(parsed.version)); assert.equal(parsed.alignment, true);
  assert.equal(h.els['animation-toggle'].disabled, true);
  assert.ok([...h.timers.values()].every(timer => timer.fn.name !== 'tickCalibration'),
    'Alignment must remain still until the sender explicitly starts measurement');
  return h.grid();
}

async function calibrationAt(h, at) {
  await h.flush();
  const pending = [...h.timers.entries()].find(([, timer]) => timer.fn.name === 'tickCalibration');
  assert.ok(pending, 'A measuring trial must have its next presentation scheduled');
  assert.ok(at >= h.now, 'The simulated display clock cannot move backwards');
  const [id, timer] = pending; h.timers.delete(id); h.now = at;
  await timer.fn(); await h.flush();
}

async function measureCalibration(h, { profileCount = 6, steps = () => [], onPackets = async () => {} } = {}) {
  const started = h.now;
  h.els['begin-calibration'].click(); await h.flush();
  assert.equal(h.els['begin-calibration'].hidden, true);
  for (let index = 0; index < profileCount; index++) {
    if (index) await calibrationAt(h, started + index * 5000);
    const profile = h.context.WGCalibration.parse(h.display());
    assert.equal(profile.index, index); assert.equal(profile.alignment, true);
    await onPackets(h.grid(), profile);
    for (const step of steps(profile, index)) {
      await calibrationAt(h, started + index * 5000 + 1000 + step * 1000 / profile.fps);
      const parsed = h.context.WGCalibration.parse(h.display());
      assert.equal(parsed.alignment, false); assert.equal(parsed.step, step);
      await onPackets(h.grid(), parsed);
    }
  }
  await calibrationAt(h, started + profileCount * 5000);
  const end = h.context.WGCalibration.parse(h.display()); assert.equal(end.ended, true);
  await onPackets(h.grid(), end);
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
    assert.match(h.els['frame-rate-label'].textContent, /całego układu/);
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

test('a 2 by 2 grid exports all four QR symbols and finishes byte-exact reception from its PNG and live frames', async () => {
  const sender = harness(), receiver = harness();
  try {
    const original = Uint8Array.from({ length: 3500 }, (_, index) => (index * 19 + 127) % 256);
    sender.change('qr-columns', '2'); sender.change('qr-rows', '2');
    sender.choose([new File([original], 'grid-four.bin')]); await sender.wait(() => !sender.els['choose-file'].disabled);
    const transfer = sender.transfers.at(-1);
    assert.deepEqual(sender.grid(), [transfer.manifestFrame(), transfer.frame(0), transfer.frame(1), transfer.frame(2)]);
    assert.equal(sender.els['qr-pair'].dataset.layout, 'grid');
    assert.equal(sender.els['qr-pair'].style.getPropertyValue('--qr-columns'), '2');
    assert.equal(sender.els['qr-pair'].style.getPropertyValue('--qr-rows'), '2');
    assert.match(sender.els['qr-grid-count'].textContent, /4 QR/);
    sender.els['download-qr'].click(); const png = sender.downloads.at(-1).blob.png;
    assert.equal(png.draws.length, 4); assert.equal(png.width, png.height);
    assert.deepEqual(png.draws.map(draw => draw.payload), sender.grid());
    for (const draw of png.draws) {
      assert.equal(draw.width, draw.height); assert.equal(draw.args.length, 2);
      assert.equal(draw.width % (draw.image.matrix.size + 8), 0);
      assert.ok(draw.args.every(Number.isInteger));
    }
    assert.ok(png.draws[0].args[0] + png.draws[0].width < png.draws[1].args[0]);
    assert.ok(png.draws[0].args[1] + png.draws[0].height < png.draws[2].args[1]);
    assert.ok(Math.abs(png.draws[1].args[1] + png.draws[1].height / 2 - png.draws[0].args[1] - png.draws[0].height / 2) <= 0.5);
    assert.ok(Math.abs(png.draws[3].args[0] + png.draws[3].width / 2 - png.draws[1].args[0] - png.draws[1].width / 2) <= 0.5);

    receiver.els['decode-tab'].click(); receiver.change('scan-columns', '2'); receiver.change('scan-rows', '2');
    receiver.upload(png.draws.map(draw => draw.payload), false, { columns: 2, rows: 2 });
    await receiver.wait(() => !receiver.els['choose-image'].disabled);
    assert.equal(receiver.telemetry.snapshot().imageReads, 4);
    assert.equal(receiver.telemetry.snapshot().usefulUnits, 3);
    receiver.els['start-camera'].click(); await receiver.wait(() => receiver.videoCallbacks.size === 1);
    assert.equal(receiver.scannerOptions.at(-1).lanes, 4);
    assert.equal(receiver.scannerOptions.at(-1).columns, 2); assert.equal(receiver.scannerOptions.at(-1).rows, 2);
    sender.els['animation-toggle'].click();
    for (let step = 0; step < 2; step++) { await sender.tick(); await receiver.fireFrame('camera-video', sender.grid()); }
    assert.equal(receiver.els['download-file'].disabled, false);
    assert.equal(receiver.telemetry.snapshot().usefulUnits, transfer.total);
    receiver.els['download-file'].click(); assert.deepEqual(new Uint8Array(await receiver.downloads.at(-1).blob.arrayBuffer()), original);

    // Changing to an intermediate 3×3 grid must update every visible slot too.
    sender.els['animation-toggle'].click(); sender.change('qr-columns', '3'); sender.change('qr-rows', '3');
    sender.choose([new File([new Uint8Array(10000).fill(87)], 'grid-nine.bin')]);
    await sender.wait(() => sender.transfers.length === 2 && !sender.els['choose-file'].disabled);
    assert.equal(sender.grid().length, 9); assert.equal(sender.els['qr-paper-9'].hidden, false);
    sender.els['animation-toggle'].click(); await sender.tick();
    assert.equal(sender.grid().length, 9); assert.ok(sender.encoderJobs.some(job => job.inputs.length === 9));
  } finally { sender.close(); receiver.close(); }
});

test('a 5 by 3 file grid exports and receives all fifteen slots, resumes without skipped data and clears cancelled batches', async () => {
  const sender = harness(), receiver = harness();
  try {
    const original = Uint8Array.from({ length: 384 * 30 - 7 }, (_, index) => (index * 29 + Math.floor(index / 251)) % 256);
    sender.change('qr-columns', '5'); sender.change('qr-rows', '3');
    sender.choose([new File([original], 'grid-fifteen.bin')]); await sender.wait(() => !sender.els['choose-file'].disabled);
    const transfer = sender.transfers.at(-1), initial = sender.grid();
    assert.equal(transfer.total, 30); assert.equal(initial.length, 15);
    assert.deepEqual(initial, [transfer.manifestFrame(), ...Array.from({ length: 14 }, (_, index) => transfer.frame(index))]);
    assert.equal(sender.els['qr-paper-15'].hidden, false);
    assert.equal(sender.els['qr-pair'].style.getPropertyValue('--qr-columns'), '5');
    assert.equal(sender.els['qr-pair'].style.getPropertyValue('--qr-rows'), '3');
    sender.els['download-qr'].click(); const png = sender.downloads.at(-1).blob.png;
    assert.equal(png.draws.length, 15); assert.deepEqual(png.draws.map(draw => draw.payload), initial);
    assert.equal(new Set(png.draws.map(draw => draw.args.join(','))).size, 15, 'Every exported slot must occupy its own grid cell.');
    for (const draw of png.draws) {
      assert.equal(draw.width, draw.height); assert.equal(draw.width % (draw.image.matrix.size + 8), 0);
      assert.equal(draw.args.length, 2); assert.ok(draw.args.every(Number.isInteger));
    }
    receiver.els['decode-tab'].click(); receiver.change('scan-columns', '5'); receiver.change('scan-rows', '3');
    receiver.upload(png.draws.map(draw => draw.payload), false, { columns: 5, rows: 3 });
    await receiver.wait(() => !receiver.els['choose-image'].disabled);
    assert.equal(receiver.telemetry.snapshot().imageReads, 15); assert.equal(receiver.telemetry.snapshot().usefulUnits, 14);
    receiver.els['start-camera'].click(); await receiver.wait(() => receiver.videoCallbacks.size === 1);
    assert.equal(receiver.scannerOptions.at(-1).lanes, 15);
    assert.deepEqual([receiver.scannerOptions.at(-1).columns, receiver.scannerOptions.at(-1).rows], [5, 3]);

    sender.deferEncoding = true; sender.els['animation-toggle'].click();
    await sender.wait(() => sender.encoderJobs.at(-1)?.ready && sender.encoderJobs.at(-1)?.release);
    const pending = sender.encoderJobs.at(-1), jobs = sender.encoderJobs.length;
    assert.equal(pending.inputs.length, 14, 'The fifteenth visible slot reuses the cached manifest.');
    assert.equal(pending.matrices.length, pending.inputs.length);
    await sender.tick('tick', { flush: false }); await sender.tick('tick', { flush: false });
    assert.deepEqual(sender.grid(), initial); assert.equal(sender.encoderJobs.length, jobs);
    sender.els['animation-toggle'].click(); sender.deferEncoding = false; pending.release(); await sender.flush();
    assert.deepEqual(sender.grid(), initial);
    assert.ok(pending.matrices.every(matrix => matrix.data.every(value => value === 0)));
    sender.els['animation-toggle'].click(); await sender.tick();
    assert.deepEqual(sender.grid(), [transfer.frame(14), transfer.frame(15), transfer.manifestFrame(),
      ...Array.from({ length: 12 }, (_, index) => transfer.frame(index + 16))]);
    await receiver.fireFrame('camera-video', sender.grid());
    assert.equal(receiver.telemetry.snapshot().usefulUnits, 28, 'Resuming must preserve every source slot after the last displayed checkpoint.');
    await sender.tick(); await receiver.fireFrame('camera-video', sender.grid());
    assert.equal(receiver.telemetry.snapshot().usefulUnits, transfer.total); assert.equal(receiver.els['download-file'].disabled, false);
    receiver.els['download-file'].click(); assert.deepEqual(new Uint8Array(await receiver.downloads.at(-1).blob.arrayBuffer()), original);
    sender.els['animation-toggle'].click();

    for (const action of ['hide-page', 'clear-all']) {
      // A larger cache can satisfy a resumed screen without invoking the worker.
      // Start a new transfer so cancellation always covers a real pending batch.
      const transfers = sender.transfers.length;
      const freshBytes = original.map(byte => byte ^ (action === 'hide-page' ? 0x5a : 0xa5));
      sender.choose([new File([freshBytes], `cancel-fifteen-${action}.bin`)]);
      await sender.wait(() => sender.transfers.length === transfers + 1 && !sender.els['choose-file'].disabled);
      assert.equal(sender.grid().length, 15);
      const previousJobs = sender.encoderJobs.length;
      sender.deferEncoding = true; sender.els['animation-toggle'].click();
      await sender.wait(() => sender.encoderJobs.length > previousJobs
        && sender.encoderJobs.at(-1)?.ready && sender.encoderJobs.at(-1)?.release);
      const stale = sender.encoderJobs.at(-1);
      assert.ok(stale.inputs.length > 0 && stale.inputs.length <= 15);
      assert.equal(stale.matrices.length, stale.inputs.length);
      if (action === 'hide-page') { sender.document.hidden = true; sender.dispatchWindow('visibilitychange'); }
      else sender.els['clear-all'].click();
      const visible = sender.grid(), paints = sender.rendered.length;
      sender.deferEncoding = false; stale.release(); await sender.flush();
      assert.deepEqual(sender.grid(), visible); assert.equal(sender.rendered.length, paints);
      assert.ok(stale.matrices.every(matrix => matrix.data.every(value => value === 0)));
      assert.ok([...sender.timers.values()].every(timer => timer.fn.name !== 'tick'));
      if (action === 'hide-page') { sender.document.hidden = false; sender.dispatchWindow('visibilitychange'); }
      else assert.equal(sender.els['qr-result'].hidden, true);
    }
  } finally { sender.close(); receiver.close(); }
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

function assertPreviewSize(stage, width, height) {
  assert.match(stage.style.width, /px$/); assert.match(stage.style.height, /px$/);
  assert.ok(Math.abs(Number.parseFloat(stage.style.width) - width) < 0.01, `Expected preview width ${width}, got ${stage.style.width}`);
  assert.ok(Math.abs(Number.parseFloat(stage.style.height) - height) < 0.01, `Expected preview height ${height}, got ${stage.style.height}`);
}

async function finishWindowResize(h, previousTimers) {
  const pending = [...h.timers.entries()].filter(([id]) => !previousTimers.has(id));
  assert.equal(pending.length, 1, 'Window resize must leave one debounced callback');
  const [id, timer] = pending[0]; assert.equal(timer.delay, 100);
  h.timers.delete(id); h.now += timer.delay; await timer.fn(); await h.micro();
}

test('camera preview geometry follows portrait video metadata instead of landscape track settings', async () => {
  const h = harness();
  try {
    const video = h.els['camera-video'], stage = h.els['camera-stage'];
    h.els['camera-box'].clientWidth = 360; video.videoWidth = video.videoHeight = 0;
    h.els['decode-tab'].click(); h.els['start-camera'].click(); await h.wait(() => h.videoCallbacks.size === 1);
    assert.deepEqual([h.streams[0].track.getSettings().width, h.streams[0].track.getSettings().height], [1920, 1080]);
    assert.equal(stage.style.width, ''); assert.equal(stage.style.height, '', 'Unknown intrinsic dimensions must not produce invalid geometry');
    video.videoWidth = 1080; video.videoHeight = 1920; video.dispatch('loadedmetadata');
    assertPreviewSize(stage, 324, 576);
    assert.match(h.els['scan-help'].textContent, /Obraz kamery: 1080 × 1920/);
    assert.match(h.els['scan-help'].textContent, /30 kl\.\/s/);
    assert.doesNotMatch(h.els['scan-help'].textContent, /1920 × 1080/);
    video.videoWidth = 0; video.dispatch('resize'); assertPreviewSize(stage, 324, 576);
    video.videoWidth = 1080;
    h.visualViewport.height = 2000; h.visualViewport.dispatch('resize'); assertPreviewSize(stage, 360, 640);
    h.visualViewport.height = 100; h.visualViewport.dispatch('resize'); assertPreviewSize(stage, 90, 160);
    assert.equal(h.cameraConstraints.length, 1); assert.equal(h.streams.length, 1);
  } finally { h.close(); }
});

test('camera preview resizing preserves partial reception and ignores late events after stop', async () => {
  const h = harness();
  try {
    const original = Uint8Array.from({ length: 1536 }, (_, index) => index % 251);
    const transfer = await h.protocol.createTransfer(original, 'rotating-preview.bin', { chunkBytes: 384, compact: true });
    const video = h.els['camera-video'], stage = h.els['camera-stage'], container = h.els['camera-box'];
    container.clientWidth = 360; video.videoWidth = 1080; video.videoHeight = 1920;
    h.els['decode-tab'].click(); h.els['start-camera'].click(); await h.wait(() => h.videoCallbacks.size === 1);
    await h.fireFrame('camera-video', transfer.manifestFrame()); await h.fireFrame('camera-video', transfer.frame(0));
    assert.equal(h.telemetry.snapshot().usefulUnits, 1); assertPreviewSize(stage, 324, 576);
    const stream = h.streams[0], observer = h.resizeObservers.find(value => value.targets.has(container));
    assert.ok(observer, 'The preview must observe its available container width');
    video.videoWidth = 1920; video.videoHeight = 1080; video.dispatch('resize');
    assertPreviewSize(stage, 360, 202.5); assert.match(h.els['scan-help'].textContent, /Obraz kamery: 1920 × 1080/);

    container.clientWidth = 640; h.visualViewport.height = 500;
    const previousTimers = new Set(h.timers.keys()); h.dispatchWindow('resize'); h.dispatchWindow('resize');
    assertPreviewSize(stage, 360, 202.5); await finishWindowResize(h, previousTimers); assertPreviewSize(stage, 640, 360);
    h.visualViewport.height = 300; h.visualViewport.dispatch('resize'); assertPreviewSize(stage, 384, 216);
    container.clientWidth = 320; h.notifyResize(container); assertPreviewSize(stage, 320, 180);
    assert.equal(h.telemetry.snapshot().usefulUnits, 1);
    assert.equal(h.cameraConstraints.length, 1); assert.equal(h.streams.length, 1); assert.equal(stream.track.stopped, false);
    await h.fireFrame('camera-video', transfer.frame(0)); assert.equal(h.telemetry.snapshot().usefulUnits, 1, 'A resize must not reset the collector or recount a duplicate');

    h.els['stop-camera'].click();
    assert.equal(observer.disconnected, true); assert.equal(stream.track.stopped, true);
    assert.equal(stage.style.width, ''); assert.equal(stage.style.height, '');
    const caption = h.els['scan-help'].textContent;
    video.videoWidth = 1080; video.videoHeight = 1920;
    video.dispatch('loadedmetadata'); video.dispatch('resize'); h.visualViewport.dispatch('resize');
    // A callback already queued by the browser may run after disconnect().
    observer.callback([{ target: container, contentRect: container.getBoundingClientRect() }], observer);
    const lateTimers = new Set(h.timers.keys()); h.dispatchWindow('resize'); await finishWindowResize(h, lateTimers);
    assert.equal(stage.style.width, ''); assert.equal(stage.style.height, ''); assert.equal(h.els['scan-help'].textContent, caption);
    assert.equal(h.telemetry.snapshot().usefulUnits, 1); assert.equal(h.cameraConstraints.length, 1);

    // Continuing from images proves the original source symbol survived both
    // orientation changes and stopping the camera; do not send symbol zero again.
    h.upload([transfer.frame(1), transfer.frame(2)]); await h.wait(() => !h.els['choose-image'].disabled);
    h.upload(transfer.frame(3)); await h.wait(() => !h.els['download-file'].disabled);
    h.els['download-file'].click(); assert.deepEqual(new Uint8Array(await h.downloads.at(-1).blob.arrayBuffer()), original);
    transfer.dispose();
  } finally { h.close(); }
});

test('feedback preview geometry uses its own wrapper without optional viewport APIs and clears on ACK', async () => {
  const h = harness({ withResizeObserver: false, withVisualViewport: false });
  try {
    h.els['series-sample'].click(); await h.wait(() => !h.els['choose-file'].disabled);
    const transfer = h.transfers.at(-1), receiver = h.protocol.createCollector();
    await receiver.accept(transfer.manifestFrame()); await receiver.accept(transfer.frame(0));
    const video = h.els['feedback-video'], stage = h.els['feedback-camera-stage'];
    h.els['feedback-scan-panel'].clientWidth = 270; video.videoWidth = 1080; video.videoHeight = 1920;
    h.els['scan-feedback'].click(); await h.wait(() => h.videoCallbacks.size === 1);
    assertPreviewSize(stage, 270, 480); assert.equal(h.resizeObservers.length, 0);
    assert.equal(h.els['camera-stage'].style.width, '');
    h.context.innerHeight = 400;
    const previousTimers = new Set(h.timers.keys()); h.dispatchWindow('resize');
    assertPreviewSize(stage, 270, 480); await finishWindowResize(h, previousTimers); assertPreviewSize(stage, 162, 288);
    video.videoWidth = 1920; video.videoHeight = 1080; video.dispatch('resize');
    assertPreviewSize(stage, 270, 151.875);
    await h.fireFrame('feedback-video', receiver.createFeedback({ suggestedRate: 5 }));
    assert.equal(h.rate(), 5); assert.equal(h.streams[0].track.stopped, true);
    assert.equal(stage.style.width, ''); assert.equal(stage.style.height, '');
    assert.equal(h.els['feedback-scan-panel'].hidden, true); assert.equal(h.videoCallbacks.size, 0);
    video.dispatch('loadedmetadata'); video.dispatch('resize');
    const lateTimers = new Set(h.timers.keys()); h.dispatchWindow('resize'); await finishWindowResize(h, lateTimers);
    assert.equal(stage.style.width, ''); assert.equal(stage.style.height, ''); assert.equal(h.cameraConstraints.length, 1);
    receiver.dispose();
  } finally { h.close(); }
});

test('receiver calibration view opens empty without a camera and toggling it preserves a partially received file', async () => {
  const h = harness(); let transfer;
  try {
    h.els['decode-tab'].click(); assertReceiverView(h, 'file');
    h.els['receiver-view-calibration'].click(); assertReceiverView(h, 'calibration');
    assert.equal(h.cameraConstraints.length, 0, 'Choosing a receiver view must not request camera access.');
    assert.equal(h.videoCallbacks.size, 0);
    assert.equal(calibrationCells(h).length, 0, 'An empty view must not contain synthetic demonstration results.');
    assertCalibrationCounts(h, { passed: 0, failed: 0, pending: 0, running: 0 });
    assert.equal(h.els['show-calibration-feedback'].hidden, true);
    assert.equal(h.els['download-file'].disabled, true);
    h.els['receiver-view-file'].click(); assertReceiverView(h, 'file');

    const original = Uint8Array.from({ length: 900 }, (_, index) => (index * 47) % 251);
    transfer = await h.protocol.createTransfer(original, 'view-switch.bin', { compact: true });
    h.els['start-camera'].click(); await h.wait(() => h.videoCallbacks.size === 1);
    const stream = h.streams[0];
    await h.fireFrame('camera-video', transfer.manifestFrame());
    await h.fireFrame('camera-video', transfer.frame(0));
    const first = h.telemetry.snapshot(); assert.equal(first.usefulUnits, 1);
    h.els['receiver-view-calibration'].click(); assertReceiverView(h, 'calibration');
    assert.equal(h.els['camera-box'].closest('[hidden]'), null, 'The running camera must remain visible in either view.');
    assert.equal(h.telemetry.snapshot().usefulUnits, 1, 'Changing the presentation must not reset file reception.');
    assert.equal(h.cameraConstraints.length, 1); assert.equal(stream.track.stopped, false);
    await h.fireFrame('camera-video', transfer.frame(1));
    assertReceiverView(h, 'calibration');
    assert.equal(h.telemetry.snapshot().usefulUnits, 1, 'Calibration mode must preserve existing file progress without accepting more file data.');
    await h.fireFrame('camera-video', transfer.frame(2));
    assertReceiverView(h, 'calibration');
    assert.equal(h.els['download-file'].disabled, true); assert.equal(stream.track.stopped, false);
    h.els['receiver-view-file'].click(); assertReceiverView(h, 'file');
    await h.fireFrame('camera-video', transfer.frame(1));
    await h.fireFrame('camera-video', transfer.frame(2));
    assert.equal(h.els['download-file'].disabled, false);
    assert.equal(h.els['download-file'].closest('[hidden]'), null);
    h.els['download-file'].click();
    assert.deepEqual(new Uint8Array(await h.downloads.at(-1).blob.arrayBuffer()), original);
    h.els['receiver-view-calibration'].click(); h.els['receiver-view-file'].click();
    assert.equal(h.els['download-file'].closest('[hidden]'), null, 'The completed file must remain reachable after inspecting the empty map.');
    assert.equal(h.cameraConstraints.length, 1);
  } finally { transfer?.dispose(); h.close(); }
});

test('chosen calibration mode ignores non-CAL payloads and file mode ignores CAL until explicitly changed', async () => {
  const h = harness(); let trial, other, transfer, acknowledgement, large;
  const measured = h.context.WGCalibration.createObserver();
  try {
    trial = h.context.WGCalibration.create({ landscapeOnly: true, grid: { columns: 1, rows: 1 } });
    other = h.context.WGCalibration.create({ landscapeOnly: true, grid: { columns: 2, rows: 1 } });
    transfer = await h.protocol.createTransfer(new Uint8Array(900).fill(53), 'ignored-small.bin', { compact: true });
    acknowledgement = h.protocol.createCollector();
    await acknowledgement.accept(transfer.manifestFrame()); await acknowledgement.accept(transfer.frame(0));
    large = await h.context.WGLarge.createSender(new File([new Uint8Array(40).fill(19)], 'ignored-large.bin'));
    const segment = await large.loadSegment(0);
    for (let sequence = 0; sequence < 8; sequence++) measured.accept(trial.frame(0, sequence), h.now);
    measured.accept(trial.endFrame(), h.now);
    const raw = new TextEncoder().encode('Unrelated ordinary QR, not calibration data.');
    const brokenMagic = Uint8Array.from(trial.frame(0, 1)); brokenMagic[0] ^= 1;
    const ignored = [new Uint8Array(), raw, transfer.manifestFrame(), transfer.frame(0), acknowledgement.createFeedback(),
      segment.manifestFrame(), segment.frame(0), measured.createFeedback(), brokenMagic];
    h.els['decode-tab'].click(); h.els['receiver-view-calibration'].click();
    h.els['start-camera'].click(); await h.wait(() => h.videoCallbacks.size === 1);
    const stream = h.streams[0];
    for (const payload of ignored) {
      await h.fireFrame('camera-video', payload);
      assertReceiverView(h, 'calibration'); assert.equal(calibrationCells(h).length, 0);
      assert.equal(h.telemetry.snapshot().transfer, null); assert.equal(h.els['download-file'].disabled, true);
      assert.equal(stream.track.stopped, false); assert.equal(h.videoCallbacks.size, 1);
    }
    assert.equal(h.largeStoreOpenCalls, 0);
    await h.fireFrame('camera-video', trial.frame(0, 0));
    const first = renderedText(calibrationCell(h, 0)); assert.match(first, /1\s*\/\s*8/);
    for (const payload of ignored) {
      await h.fireFrame('camera-video', payload);
      assertReceiverView(h, 'calibration'); assert.equal(renderedText(calibrationCell(h, 0)), first);
      assert.equal(stream.track.stopped, false); assert.equal(h.videoCallbacks.size, 1);
    }
    const corruptCal = Uint8Array.from(trial.frame(0, 1)); corruptCal[corruptCal.length - 1] ^= 1;
    await h.fireFrame('camera-video', corruptCal);
    assert.equal(renderedText(calibrationCell(h, 0)), first); assert.equal(stream.track.stopped, false);
    await h.fireFrame('camera-video', trial.frame(0, 1));
    assert.match(renderedText(calibrationCell(h, 0)), /2\s*\/\s*8/);
    await h.fireFrame('camera-video', [raw, trial.frame(0, 2)]);
    await h.fireFrame('camera-video', [trial.frame(0, 3), raw]);
    assert.match(renderedText(calibrationCell(h, 0)), /4\s*\/\s*8/);
    for (let sequence = 4; sequence < 8; sequence++) await h.fireFrame('camera-video', trial.frame(0, sequence));
    await h.fireFrame('camera-video', trial.endFrame());
    const finished = renderedText(h.els['calibration-map']);
    assertReceiverView(h, 'calibration'); assert.equal(calibrationCell(h, 0).dataset.state, 'passed');
    h.els['receiver-view-file'].click();
    await h.fireFrame('camera-video', trial.frame(0, 0));
    await h.fireFrame('camera-video', other.frame(0, 0));
    assertReceiverView(h, 'file'); assert.equal(renderedText(h.els['calibration-map']), finished,
      'An explicitly chosen file view must ignore both the old CAL session and a newly announced one.');
    const corruptFile = Uint8Array.from(transfer.frame(0)); corruptFile[corruptFile.length - 1] ^= 1;
    await h.fireFrame('camera-video', corruptFile);
    assert.equal(renderedText(h.els['calibration-map']), finished, 'An invalid file candidate must not erase calibration results.');
    assert.equal(stream.track.stopped, false); assert.equal(h.cameraConstraints.length, 1);
    await h.fireFrame('camera-video', raw);
    assertReceiverView(h, 'file'); assert.equal(calibrationCells(h).length, 0);
    assert.equal(h.els['download-file'].disabled, false); assert.equal(stream.track.stopped, true);
    h.els['download-file'].click(); assert.deepEqual(new Uint8Array(await h.downloads.at(-1).blob.arrayBuffer()), raw);
  } finally { trial?.dispose(); other?.dispose(); transfer?.dispose(); acknowledgement?.dispose(); large?.dispose(); measured.dispose(); h.close(); }
});

test('automatic calibration discovery processes CAL before unrelated raw QR and keeps the completed trial on screen', async () => {
  const h = harness(); let trial;
  try {
    trial = h.context.WGCalibration.create({ landscapeOnly: true, grid: { columns: 1, rows: 1 } });
    const raw = new TextEncoder().encode('An ordinary code visible beside the trial.');
    h.els['decode-tab'].click(); h.els['start-camera'].click(); await h.wait(() => h.videoCallbacks.size === 1);
    const stream = h.streams[0], corrupt = Uint8Array.from(trial.frame(0, 0)); corrupt[corrupt.length - 1] ^= 1;
    await h.fireFrame('camera-video', corrupt);
    assertReceiverView(h, 'file'); assert.equal(calibrationCells(h).length, 0); assert.equal(stream.track.stopped, false);
    await h.fireFrame('camera-video', [raw, trial.frame(0, 0)]);
    assertReceiverView(h, 'calibration'); assert.match(renderedText(calibrationCell(h, 0)), /1\s*\/\s*8/);
    await h.fireFrame('camera-video', [trial.frame(0, 1), raw]);
    assert.match(renderedText(calibrationCell(h, 0)), /2\s*\/\s*8/);
    for (let sequence = 2; sequence < 8; sequence++) await h.fireFrame('camera-video', trial.frame(0, sequence));
    await h.fireFrame('camera-video', [raw, trial.endFrame()]);
    assertReceiverView(h, 'calibration'); assertCalibrationCounts(h, { passed: 1, failed: 5, pending: 0, running: 0 });
    await h.fireFrame('camera-video', raw);
    assertReceiverView(h, 'calibration'); assert.equal(h.els['download-file'].disabled, true);
    assert.equal(stream.track.stopped, false); assert.equal(h.cameraConstraints.length, 1); assert.equal(h.videoCallbacks.size, 1);
    assert.equal(h.telemetry.snapshot().transfer, null);
    h.els['receiver-view-file'].click(); await h.fireFrame('camera-video', raw);
    assertReceiverView(h, 'file'); assert.equal(h.els['download-file'].disabled, false);
    assert.equal(stream.track.stopped, true);
  } finally { trial?.dispose(); h.close(); }
});

test('camera stop and visibility preserve calibration while pagehide clears it without letting a late decode change the view', async t => {
  for (const action of ['stop', 'hide-page', 'pagehide']) await t.test(action, async () => {
    const h = harness(); let trial;
    try {
      trial = h.context.WGCalibration.create({ landscapeOnly: true, grid: { columns: 1, rows: 1 } });
      h.els['decode-tab'].click(); h.els['receiver-view-calibration'].click();
      h.els['start-camera'].click(); await h.wait(() => h.videoCallbacks.size === 1);
      const stream = h.streams[0]; await h.fireFrame('camera-video', trial.frame(0, 0));
      const first = renderedText(calibrationCell(h, 0));
      h.deferScans = true;
      const pending = h.fireFrame('camera-video', trial.frame(0, 1)); await h.wait(() => h.scanJobs.length === 1);
      if (action === 'stop') h.els['stop-camera'].click();
      else if (action === 'hide-page') { h.document.hidden = true; h.dispatchWindow('visibilitychange'); }
      else h.dispatchWindow('pagehide');
      h.deferScans = false; h.scanJobs[0].release(); await pending; await h.micro();
      assertReceiverView(h, 'calibration'); assert.equal(stream.track.stopped, true); assert.equal(h.videoCallbacks.size, 0);
      assert.equal(h.els['download-file'].disabled, true);
      if (action === 'pagehide') {
        assert.equal(calibrationCells(h).length, 0); assertCalibrationCounts(h, { passed: 0, failed: 0, pending: 0, running: 0 });
      } else {
        assert.equal(renderedText(calibrationCell(h, 0)), first, 'Stopping must retain accepted samples and discard the late camera result.');
        h.document.hidden = false; h.dispatchWindow('visibilitychange'); await h.micro();
        assert.equal(h.videoCallbacks.size, 0); assert.equal(h.cameraConstraints.length, 1, 'Returning to the page must not restart the camera automatically.');
        h.els['start-camera'].click(); await h.wait(() => h.videoCallbacks.size === 1);
        assert.equal(h.cameraConstraints.length, 2); assert.equal(renderedText(calibrationCell(h, 0)), first);
        await h.fireFrame('camera-video', trial.frame(0, 1));
        assertReceiverView(h, 'calibration'); assert.match(renderedText(calibrationCell(h, 0)), /2\s*\/\s*8/);
      }
    } finally { trial?.dispose(); h.close(); }
  });
});

test('late file completion preserves a newly selected calibration view and its camera restart keeps the measurement', async () => {
  const h = harness(); let transfer, trial;
  try {
    const original = Uint8Array.from({ length: 900 }, (_, index) => (index * 43) % 251);
    transfer = await h.protocol.createTransfer(original, 'completed-behind-calibration.bin', { compact: true });
    trial = h.context.WGCalibration.create({ landscapeOnly: true, grid: { columns: 1, rows: 1 } });
    h.els['decode-tab'].click(); h.els['start-camera'].click(); await h.wait(() => h.videoCallbacks.size === 1);
    const stream = h.streams[0];
    for (const bytes of [transfer.manifestFrame(), transfer.frame(0), transfer.frame(1)]) await h.fireFrame('camera-video', bytes);
    h.deferCollectorAccept = true;
    const pending = h.fireFrame('camera-video', transfer.frame(2)); await h.wait(() => h.collectorJobs.length === 1);
    assert.equal(h.collectorJobs[0].result.kind, 'complete');
    h.els['receiver-view-calibration'].click();
    h.deferCollectorAccept = false; h.collectorJobs[0].release(); await pending; await h.micro();
    assertReceiverView(h, 'calibration'); assert.equal(stream.track.stopped, false); assert.equal(h.videoCallbacks.size, 1);
    assert.equal(h.els['download-file'].disabled, false, 'A successfully verified file must remain available in its own view.');
    assert.equal(h.els['download-file'].closest('[hidden]'), h.els['receiver-file-output']);
    await h.fireFrame('camera-video', trial.frame(0, 0));
    assert.match(renderedText(calibrationCell(h, 0)), /1\s*\/\s*8/);
    h.els['stop-camera'].click(); h.els['start-camera'].click(); await h.wait(() => h.videoCallbacks.size === 1);
    assertReceiverView(h, 'calibration'); assert.match(renderedText(calibrationCell(h, 0)), /1\s*\/\s*8/);
    assert.equal(h.cameraConstraints.length, 2);
    await h.fireFrame('camera-video', trial.frame(0, 1));
    assert.match(renderedText(calibrationCell(h, 0)), /2\s*\/\s*8/);
    h.els['receiver-view-file'].click(); assertReceiverView(h, 'file');
    assert.equal(h.els['download-file'].disabled, false); assert.equal(h.els['download-file'].closest('[hidden]'), null);
    h.els['download-file'].click(); assert.deepEqual(new Uint8Array(await h.downloads.at(-1).blob.arrayBuffer()), original);
  } finally { transfer?.dispose(); trial?.dispose(); h.close(); }
});

test('accepted CAL opens the map, bootstrap comparison leaves all profiles pending, and live counts update within one profile', async () => {
  const h = harness(); let trial, foreign;
  try {
    trial = h.context.WGCalibration.create({ compareLayouts: true });
    foreign = h.context.WGCalibration.create({ grid: { columns: 1, rows: 1 } });
    h.els['decode-tab'].click(); h.els['start-camera'].click(); await h.wait(() => h.videoCallbacks.size === 1);
    const setup = trial.alignmentFrame(0, trial.alignmentIndex, true);
    assert.equal(h.context.WGCalibration.parse(setup).index, 18);
    await h.fireFrame('camera-video', setup);
    assertReceiverView(h, 'calibration');
    assert.equal(calibrationCells(h).length, 24);
    assert.ok(calibrationCells(h).every(cell => cell.dataset.state === 'pending'),
      'The initial 2×2 alignment profile is not evidence that the earlier 18 profiles failed.');
    assertCalibrationCounts(h, { passed: 0, failed: 0, pending: 24, running: 0 });
    assert.match(h.els['calibration-current-grid'].textContent, /2\s*×\s*2/);
    h.els['receiver-view-file'].click();
    await h.fireFrame('camera-video', foreign.alignmentFrame(0, 0, true));
    assertReceiverView(h, 'file');
    assert.equal(calibrationCells(h).length, 24, 'A foreign session must not replace the current map.');

    await h.fireFrame('camera-video', trial.alignmentFrame(0, 0));
    assertReceiverView(h, 'file');
    h.els['receiver-view-calibration'].click(); assertReceiverView(h, 'calibration');
    await h.fireFrame('camera-video', trial.frame(0, 0), { advanceMs: 250 });
    assert.equal(calibrationCell(h, 0).dataset.state, 'running');
    assert.match(renderedText(calibrationCell(h, 0)), /1\s*\/\s*8/);
    assertCalibrationCounts(h, { passed: 0, failed: 0, pending: 23, running: 1 });
    await h.fireFrame('camera-video', trial.frame(0, 1), { advanceMs: 250 });
    const live = renderedText(calibrationCell(h, 0));
    assert.match(live, /2\s*\/\s*8/, 'The same profile must repaint as new packets arrive.');
    await h.fireFrame('camera-video', trial.frame(0, 1), { advanceMs: 250 });
    assert.equal(renderedText(calibrationCell(h, 0)), live, 'Duplicate packets must not increase the map counters.');
    const cell = calibrationCell(h, 0), modules = Number(cell.dataset.modules);
    assert.equal(cell.dataset.columns, '1'); assert.equal(cell.dataset.rows, '1');
    assert.equal(cell.dataset.fps, '2'); assert.equal(cell.dataset.chunkBytes, '384');
    assert.ok(Number.isInteger(modules) && modules >= 21 && modules <= 177 && (modules - 17) % 4 === 0);
    assert.match(h.els['calibration-current-grid'].textContent, /1\s*×\s*1/);
    assert.equal(Number.parseFloat(h.els['calibration-current-rate'].textContent), 2);
    assert.match(h.els['calibration-current-density'].textContent, new RegExp(`${modules}\\s*×\\s*${modules}`));
    for (let sequence = 2; sequence < 8; sequence++) await h.fireFrame('camera-video', trial.frame(0, sequence));
    assert.equal(calibrationCell(h, 0).dataset.state, 'running', 'Even complete live samples remain in progress until the profile closes.');
    await h.fireFrame('camera-video', trial.alignmentFrame(0, 1));
    assert.equal(calibrationCell(h, 0).dataset.state, 'passed');
    assert.equal(calibrationCell(h, 1).dataset.state, 'pending');
    assert.equal(calibrationCell(h, 18).dataset.state, 'pending');
    assertCalibrationCounts(h, { passed: 1, failed: 0, pending: 23, running: 0 });
    assert.equal(h.cameraConstraints.length, 1); assert.equal(h.streams[0].track.stopped, false);
    assert.equal(h.telemetry.snapshot().transfer, null); assert.equal(h.els['download-file'].disabled, true);
  } finally { trial?.dispose(); foreign?.dispose(); h.close(); }
});

test('late setup for the same calibration profile does not restore the manual-start instructions during settling', async () => {
  const h = harness(); let trial;
  try {
    trial = h.context.WGCalibration.create({ grid: { columns: 1, rows: 1 } });
    h.els['decode-tab'].click(); h.els['start-camera'].click(); await h.wait(() => h.videoCallbacks.size === 1);
    const setup = trial.alignmentFrame(0, 0, true);
    for (let repeat = 0; repeat < 3; repeat++) await h.fireFrame('camera-video', setup, { advanceMs: 250 });
    assert.equal(h.els['calibration-alignment'].dataset.quality, 'good');
    assert.match(h.els['alignment-detail'].textContent, /Na nadajniku rozpocznij pomiar/);

    await h.fireFrame('camera-video', trial.alignmentFrame(0, 0), { advanceMs: 250 });
    const settlingInstructions = h.els['alignment-detail'].textContent;
    assert.match(settlingInstructions, /rozpocznie się automatycznie/);
    await h.fireFrame('camera-video', setup, { advanceMs: 250 });
    assert.equal(h.els['alignment-detail'].textContent, settlingInstructions,
      'An obsolete setup packet must not overwrite instructions for the active settling phase.');
    assert.equal(calibrationCell(h, 0).dataset.state, 'pending');
    assertCalibrationCounts(h, { passed: 0, failed: 0, pending: 6, running: 0 });
    assert.equal(h.cameraConstraints.length, 1);
    assert.equal(h.telemetry.snapshot().transfer, null);
  } finally { trial?.dispose(); h.close(); }
});

test('completed receiver map separates passed and failed profiles and reset keeps an empty calibration view', async () => {
  const h = harness(); let trial;
  try {
    trial = h.context.WGCalibration.create({ grid: { columns: 1, rows: 1 } });
    h.els['decode-tab'].click(); h.els['start-camera'].click(); await h.wait(() => h.videoCallbacks.size === 1);
    for (let sequence = 0; sequence < 8; sequence++) await h.fireFrame('camera-video', trial.frame(0, sequence));
    for (let sequence = 0; sequence < 3; sequence++) await h.fireFrame('camera-video', trial.frame(1, sequence));
    await h.fireFrame('camera-video', trial.endFrame());
    assertReceiverView(h, 'calibration');
    assertCalibrationCounts(h, { passed: 1, failed: 5, pending: 0, running: 0 });
    assert.equal(calibrationCell(h, 0).dataset.state, 'passed');
    assert.match(renderedText(calibrationCell(h, 0)), /8\s*\/\s*8/);
    assert.equal(calibrationCell(h, 1).dataset.state, 'failed');
    assert.match(renderedText(calibrationCell(h, 1)), /3\s*\/\s*20/);
    assert.equal(calibrationCell(h, 5).dataset.state, 'failed');
    assert.match(renderedText(calibrationCell(h, 5)), /0\s*\/\s*40/);
    assert.equal(h.els['show-calibration-feedback'].closest('[hidden]'), null);
    assert.equal(h.els['reset-calibration'].closest('[hidden]'), null);
    h.els['reset-calibration'].click();
    assertReceiverView(h, 'calibration');
    assert.equal(calibrationCells(h).length, 0);
    assertCalibrationCounts(h, { passed: 0, failed: 0, pending: 0, running: 0 });
    assert.equal(h.els['show-calibration-feedback'].hidden, true);
    assert.equal(h.els['calibration-current-grid'].textContent, '—');
    assert.equal(h.cameraConstraints.length, 1); assert.equal(h.streams[0].track.stopped, false);

    const plain = new TextEncoder().encode('A real file after a cleared calibration map.\r\n');
    h.els['receiver-view-file'].click();
    await h.fireFrame('camera-video', plain);
    assertReceiverView(h, 'file');
    assert.equal(h.els['download-file'].closest('[hidden]'), null);
    h.els['download-file'].click(); assert.deepEqual(new Uint8Array(await h.downloads.at(-1).blob.arrayBuffer()), plain);
  } finally { trial?.dispose(); h.close(); }
});

test('standalone calibration defaults to ten landscape layouts before upload, paints only synthetic codes and restores the empty view on stop', async () => {
  for (const id of ['start-calibration', 'scan-feedback']) {
    const ancestors = htmlAncestorIds(id);
    assert.ok(ancestors.includes('calibration-home'));
    assert.ok(ancestors.includes('calibration-setup'));
    assert.ok(!ancestors.includes('qr-result') && !ancestors.includes('series-controls'),
      'Calibration and its return channel must be outside the hidden file-result controls.');
  }
  const h = harness(); const observer = h.context.WGCalibration.createObserver();
  try {
    assert.equal(h.els['start-calibration'].disabled, false);
    assert.equal(h.els['start-calibration'].closest('[hidden]'), null);
    assert.equal(h.els['calibration-setup'].parentElement, h.els['calibration-home']);
    assert.equal(h.els['qr-result'].hidden, true); assert.equal(h.els['qr-empty'].hidden, false);
    assert.equal(h.els['calibration-layout-scope'].value, 'all');
    h.change('series-ecc', 'L');
    const packets = await openCalibration(h);
    assert.equal(packets.length, 15);
    for (let lane = 0; lane < packets.length; lane++) {
      const parsed = h.context.WGCalibration.parse(packets[lane]);
      assert.equal(parsed.version, 5); assert.equal(parsed.landscapeOnly, true);
      assert.equal(parsed.setup, true); assert.equal(parsed.alignment, true); assert.equal(parsed.slot, lane);
      assert.equal(parsed.allLayouts, true); assert.equal(parsed.compareLayouts, false);
      assert.equal(parsed.large, true, 'Unknown future files are calibrated with the larger packet envelope.');
      assert.deepEqual([parsed.grid.columns, parsed.grid.rows, parsed.ecc], [5, 3, 'L']);
      assert.equal(packets[lane].length, 40, 'The initial setup announces the full plan without a dense measurement payload.');
      observer.accept(packets[lane], h.now);
    }
    assert.equal(observer.state.totalProfiles, 60);
    const layouts = new Set(Array.from(observer.state.results, profile => `${profile.grid.columns}x${profile.grid.rows}`));
    assert.equal(layouts.size, 10);
    for (let columns = 1; columns <= 5; columns++) for (let rows = 1; rows <= 3; rows++) {
      assert.equal(layouts.has(`${columns}x${rows}`), (columns === 1 && rows === 1) || columns > rows,
        `The default plan has the wrong inclusion rule for ${columns}×${rows}.`);
    }
    assert.match(h.els['calibration-duration'].textContent, /\b60\b/);
    assert.match(h.els['calibration-duration'].textContent, /300 s/);
    assert.equal(h.transfers.length, 0); assert.equal(h.largeSenders.length, 0);
    assert.ok(h.encodings.every(item => h.context.WGCalibration.isFrame(item.bytes)));
    assert.equal(h.els['source-details'].hidden, true); assert.equal(h.els['series-controls'].hidden, true);
    assert.equal(h.els['download-qr'].disabled, true);
    assert.equal(h.els['qr-result'].hidden, false); assert.equal(h.els['qr-empty'].hidden, true);
    assert.equal(h.els['calibration-setup'].parentElement, h.els['calibration-display-slot']);
    assert.equal(h.els['calibration-home'].contains(h.els['calibration-setup']), false);
    assert.equal(h.document.body.classList.contains('qr-expanded'), true);

    h.els['begin-calibration'].click(); await h.flush(); await h.tick('tickCalibration'); await h.flush();
    assert.equal(h.context.WGCalibration.parse(h.display()).alignment, false);
    h.els['stop-calibration'].click(); await h.flush();
    assert.equal(h.display(), null); assert.equal(h.els['qr-result'].hidden, true); assert.equal(h.els['qr-empty'].hidden, false);
    assert.equal(h.els['source-details'].hidden, true); assert.equal(h.els['series-controls'].hidden, true);
    assert.equal(h.els['download-qr'].disabled, true); assert.equal(h.els['animation-toggle'].disabled, true);
    assert.equal(h.els['start-calibration'].disabled, false); assert.equal(h.els['begin-calibration'].hidden, true);
    assert.equal(h.els['stop-calibration'].hidden, true);
    assert.equal(h.els['calibration-setup'].parentElement, h.els['calibration-home']);
    assert.equal(h.document.body.classList.contains('qr-expanded'), false);
    assert.ok(h.encoderJobs.every(job => job.matrices.every(matrix => matrix.data.every(value => value === 0))));
    assert.ok([...h.timers.values()].every(timer => timer.fn.name !== 'tickCalibration'));
    assert.equal(h.telemetry.snapshot().transfer, null); assert.equal(h.downloads.length, 0);

    h.choose([new File([new Uint8Array(6001).fill(27)], 'after-cancel.bin')]);
    await h.wait(() => h.transfers.length === 1 && !h.els['choose-file'].disabled);
    assert.equal(h.document.body.classList.contains('qr-expanded'), false,
      'Cancelling a standalone measurement must not schedule expansion of a later file.');
  } finally { observer.dispose(); h.close(); }
});

test('current calibration refuses portrait and square multi-code grids without changing the selected file layout', async () => {
  const h = harness();
  try {
    h.change('calibration-layout-scope', 'current');
    h.choose([new File([new Uint8Array(3500).fill(61)], 'unchanged-layout.bin')]); await h.wait(() => !h.els['choose-file'].disabled);
    const transfer = h.transfers.at(-1);
    for (const [columns, rows] of [[1, 2], [2, 2]]) {
      h.change('qr-columns', String(columns)); h.change('qr-rows', String(rows)); await h.flush();
      const visible = h.grid();
      assert.equal(h.els['start-calibration'].disabled, true);
      assert.match(h.els['calibration-duration'].textContent, /poziom/);
      h.els['start-calibration'].click(); await h.micro();
      assert.deepEqual([h.els['qr-columns'].value, h.els['qr-rows'].value], [String(columns), String(rows)]);
      assert.deepEqual(h.grid(), visible); assert.equal(h.transfers.at(-1), transfer);
      assert.equal(h.els['begin-calibration'].hidden, true);
    }
    h.change('qr-columns', '3'); h.change('qr-rows', '2'); await h.flush();
    assert.equal(h.els['start-calibration'].disabled, false);
    const packets = await openCalibration(h);
    assert.equal(packets.length, 6);
    for (const bytes of packets) {
      const parsed = h.context.WGCalibration.parse(bytes);
      assert.equal(parsed.version, 5); assert.equal(parsed.landscapeOnly, true);
      assert.deepEqual([parsed.grid.columns, parsed.grid.rows], [3, 2]);
    }
  } finally { h.close(); }
});

test('standalone calibration finishes, applies camera SET without a file and preserves settings and fullscreen for the first upload', async () => {
  const h = harness(); const observer = h.context.WGCalibration.createObserver();
  try {
    h.change('calibration-layout-scope', 'compare'); h.change('series-ecc', 'L');
    await openCalibration(h);
    await measureCalibration(h, {
      profileCount: 24,
      steps: (profile, index) => index === 16 ? Array.from({ length: 20 }, (_, step) => step) : [],
      onPackets(packets) { for (const bytes of packets) observer.accept(bytes, h.now); }
    });
    const end = h.context.WGCalibration.parse(h.display());
    assert.equal(end.ended, true); assert.equal(end.large, true);
    assert.deepEqual([observer.state.best.grid.columns, observer.state.best.grid.rows, observer.state.best.chunkBytes, observer.state.best.fps],
      [3, 1, 600, 5]);
    assert.equal(h.els['qr-result'].hidden, false); assert.equal(h.els['scan-feedback'].disabled, false);
    assert.equal(h.els['animation-toggle'].disabled, true); assert.equal(h.els['download-qr'].disabled, true);
    assert.equal(h.transfers.length, 0); assert.equal(h.largeSenders.length, 0);
    h.els['scan-feedback'].click(); await h.wait(() => h.videoCallbacks.size === 1);
    assert.equal(h.els['calibration-setup'].parentElement, h.els['calibration-home']);
    assert.equal(h.els['feedback-scan-panel'].closest('[hidden]'), null);
    await h.fireFrame('feedback-video', observer.createFeedback());
    assert.deepEqual([h.els['qr-columns'].value, h.els['qr-rows'].value, h.els['qr-density'].value, h.els['series-ecc'].value, h.rate()],
      ['3', '1', '600', 'L', 5]);
    assert.equal(h.transfers.length, 0, 'SET must store settings without creating an empty or synthetic file transfer.');
    assert.equal(h.largeSenders.length, 0); assert.equal(h.els['source-details'].hidden, true);
    assert.equal(h.els['qr-result'].hidden, true); assert.equal(h.els['qr-empty'].hidden, false);
    assert.equal(h.document.body.classList.contains('qr-expanded'), false); assert.equal(h.videoCallbacks.size, 0);
    assert.equal(h.streams[0].track.stopped, true); assert.equal(h.document.activeElement, h.els['choose-file']);

    const original = Uint8Array.from({ length: 6001 }, (_, index) => (index * 73 + Math.floor(index / 256)) % 256);
    h.choose([new File([original], 'first-after-calibration.bin')]);
    await h.wait(() => h.transfers.length === 1 && !h.els['choose-file'].disabled);
    assert.equal(h.transfers[0].chunkBytes, 600); assert.equal(h.grid().length, 3); assert.equal(h.rate(), 5);
    assert.deepEqual([h.els['qr-columns'].value, h.els['qr-rows'].value, h.els['series-ecc'].value], ['3', '1', 'L']);
    assert.equal(h.document.body.classList.contains('qr-expanded'), true,
      'The first real series must use the expanded geometry under which the standalone trial was measured.');
    assert.equal(h.els['calibration-setup'].parentElement, h.els['calibration-display-slot']);
    assert.equal(h.els['animation-toggle'].getAttribute('aria-pressed'), 'false');
    assert.ok([...h.timers.values()].every(timer => timer.fn.name !== 'tick'));
    assert.deepEqual(await collectTransfer(h.protocol, h.transfers[0]), original);
  } finally { observer.dispose(); h.close(); }
});

test('standalone calibration accepts a SET image without a file and keeps its settings through the first large-file upload', async () => {
  const h = harness(); const observer = h.context.WGCalibration.createObserver();
  try {
    h.change('calibration-layout-scope', 'current');
    h.change('qr-columns', '3'); h.change('qr-rows', '2');
    await openCalibration(h);
    await measureCalibration(h, {
      steps: (profile, index) => index === 4 ? Array.from({ length: 20 }, (_, step) => step) : [],
      onPackets(packets) { for (const bytes of packets) observer.accept(bytes, h.now); }
    });
    h.upload(observer.createFeedback(), true);
    await h.wait(() => h.els['qr-density'].value === '600' && h.rate() === 5 && !h.els['choose-feedback-image'].disabled);
    assert.equal(h.transfers.length, 0); assert.equal(h.largeSenders.length, 0); assert.equal(h.cameraConstraints.length, 0);
    assert.equal(h.els['source-details'].hidden, true); assert.equal(h.els['qr-result'].hidden, true);
    assert.equal(h.els['calibration-setup'].parentElement, h.els['calibration-home']);

    const input = lazyLargeFile(10 * 1024 * 1024 + 1, 'first-large-after-calibration.bin');
    h.choose([input.file]); await h.wait(() => h.largeSegments.length === 1 && !h.els['choose-file'].disabled);
    assert.equal(h.largeSegments[0].chunkBytes, 600); assert.equal(h.rate(), 5);
    assert.deepEqual([h.els['qr-columns'].value, h.els['qr-rows'].value], ['3', '2']);
    assert.equal(h.grid().length, 6); assert.equal(h.document.body.classList.contains('qr-expanded'), true);
    assert.equal(h.els['animation-toggle'].getAttribute('aria-pressed'), 'false');
    assert.equal(input.audit.fullReads, 0, 'Applying a standalone trial must not introduce a whole-large-file read.');
  } finally { observer.dispose(); h.close(); }
});

test('standalone calibration drops deferred setup after stop or a first-file selection', async t => {
  for (const action of ['stop', 'choose-file']) await t.test(action, async () => {
    const h = harness();
    try {
      h.change('qr-columns', '2'); h.change('qr-rows', '2');
      h.deferEncoding = true; h.els['start-calibration'].click();
      await h.wait(() => h.encoderJobs.at(-1)?.ready && h.encoderJobs.at(-1)?.release);
      const pending = h.encoderJobs.at(-1);
      assert.equal(h.display(), null); assert.equal(h.transfers.length, 0);
      assert.equal(h.document.body.classList.contains('qr-expanded'), true);
      if (action === 'stop') h.els['stop-calibration'].click();
      else {
        h.choose([new File([new Uint8Array(6001).fill(41)], 'first-file-replaces-setup.bin')]);
        await h.wait(() => h.transfers.length === 1 && !h.els['choose-file'].disabled);
      }
      const before = h.grid(), paints = h.rendered.length;
      h.deferEncoding = false; pending.release(); await h.flush();
      assert.deepEqual(h.grid(), before); assert.equal(h.rendered.length, paints);
      assert.ok(pending.matrices.every(matrix => matrix.data.every(value => value === 0)));
      assert.equal(h.els['begin-calibration'].hidden, true); assert.equal(h.els['stop-calibration'].hidden, true);
      assert.equal(h.document.body.classList.contains('qr-expanded'), false);
      assert.equal(h.els['calibration-setup'].parentElement, h.els['calibration-home']);
      assert.ok([...h.timers.values()].every(timer => timer.fn.name !== 'tickCalibration'));
      if (action === 'stop') {
        assert.equal(h.display(), null); assert.equal(h.els['qr-result'].hidden, true); assert.equal(h.els['qr-empty'].hidden, false);
        assert.equal(h.els['start-calibration'].disabled, false); assert.equal(h.els['download-qr'].disabled, true);
      } else {
        assert.ok(h.grid().every(bytes => !h.context.WGCalibration.isReserved(bytes)));
        assert.equal(h.els['source-details'].hidden, false);
      }
    } finally { h.close(); }
  });
});

test('standalone calibration remains disabled while the first selected file is still being read', async () => {
  const h = harness(); let releaseRead;
  try {
    const bytes = new Uint8Array(6001).fill(83);
    const file = new File([bytes], 'pending-first-file.bin');
    file.arrayBuffer = () => new Promise(resolve => { releaseRead = () => resolve(bytes.slice().buffer); });
    h.choose([file]); await h.wait(() => Boolean(releaseRead));
    assert.equal(h.els['start-calibration'].disabled, true);
    h.els['start-calibration'].click(); await h.micro();
    assert.equal(h.encoderJobs.length, 0); assert.equal(h.transfers.length, 0);
    assert.equal(h.document.body.classList.contains('qr-calibrating'), false);
    releaseRead(); releaseRead = null;
    await h.wait(() => h.transfers.length === 1 && !h.els['choose-file'].disabled);
    assert.equal(h.els['start-calibration'].disabled, false);
  } finally { releaseRead?.(); h.close(); }
});

test('standalone calibration ignores a delayed SET after reset and rejects an old SET image during a new trial', async () => {
  const h = harness(); const observer = h.context.WGCalibration.createObserver();
  try {
    h.change('calibration-layout-scope', 'current');
    await openCalibration(h);
    await measureCalibration(h, {
      steps: (profile, index) => index === 4 ? Array.from({ length: 20 }, (_, step) => step) : [],
      onPackets(packets) { for (const bytes of packets) observer.accept(bytes, h.now); }
    });
    const feedback = observer.createFeedback();
    h.els['scan-feedback'].click(); await h.wait(() => h.videoCallbacks.size === 1);
    h.deferScans = true;
    const pending = h.fireFrame('feedback-video', feedback); await h.wait(() => h.scanJobs.length === 1);
    h.els['clear-all'].click();
    h.deferScans = false; h.scanJobs[0].release(); await pending; await h.micro();
    assert.equal(h.rate(), 2); assert.equal(h.els['qr-density'].value, '384');
    assert.equal(h.transfers.length, 0); assert.equal(h.largeSenders.length, 0);
    assert.equal(h.videoCallbacks.size, 0); assert.equal(h.streams[0].track.stopped, true);
    assert.equal(h.els['qr-result'].hidden, true); assert.equal(h.els['start-calibration'].disabled, false);

    await openCalibration(h);
    assert.notEqual(h.context.WGCalibration.parse(h.display()).id, observer.state.id);
    h.upload(feedback, true); await h.wait(() => !h.els['choose-feedback-image'].disabled);
    assert.equal(h.rate(), 2); assert.equal(h.els['qr-density'].value, '384');
    assert.equal(h.els['feedback-message'].dataset.kind, 'error');
    assert.equal(h.transfers.length, 0); assert.equal(h.largeSenders.length, 0);
    assert.equal(h.els['source-details'].hidden, true); assert.equal(h.els['qr-result'].hidden, true);
  } finally { observer.dispose(); h.close(); }
});

test('calibration exchanges a measured dual profile, regenerates the transfer, and leaves file telemetry clean', async () => {
  const sender = harness(); const receiver = harness();
  try {
    const original = Uint8Array.from({ length: 1900 }, (_, index) => (index * 7) % 251);
    sender.change('calibration-layout-scope', 'current');
    sender.change('qr-layout', 'dual'); sender.change('series-ecc', 'L'); sender.els['transfer-mode'].value = 'series';
    sender.choose([new File([original], 'after-calibration.bin')]); await sender.wait(() => !sender.els['choose-file'].disabled);
    const old = sender.transfers.at(-1);
    receiver.els['decode-tab'].click(); receiver.els['start-camera'].click();
    await receiver.wait(() => receiver.videoCallbacks.size === 1);
    assert.equal(receiver.cameraConstraints[0].video.aspectRatio.ideal, 4 / 3);
    assert.equal(receiver.scannerOptions[0].lanes, 1);
    await openCalibration(sender);
    assert.equal(sender.els['stop-calibration'].hidden, false); assert.equal(sender.els['animation-toggle'].disabled, true);
    for (let attempt = 0; attempt < 3; attempt++) await receiver.fireFrame('camera-video', sender.grid(), { advanceMs: 250 });
    assert.equal(receiver.els['calibration-alignment'].dataset.quality, 'good');
    assert.equal(receiver.cameraConstraints.length, 1);
    assert.equal(receiver.els['calibration-progress'].value, 0, 'Static alignment packets must not count as measured samples');
    await measureCalibration(sender, {
      // A profile is eligible only when every symbol in all four seconds arrived.
      steps: (profile, index) => index === 4 ? Array.from({ length: 20 }, (_, step) => step) : [],
      async onPackets(packets, parsed) {
        assert.equal(parsed.lanes, 2); assert.equal(parsed.ecc, 'L');
        await receiver.fireFrame('camera-video', packets, { advanceMs: 1000 / parsed.fps });
      }
    });
    assert.equal(receiver.els['show-calibration-feedback'].hidden, false);
    assert.match(receiver.els['calibration-result'].textContent, /2 × 1 QR, 600 B, 5 zmian\/s/);
    const best = receiver.els['calibration-results'].children.find(row => row.dataset.best === 'true');
    assert.equal(best.dataset.quality, 'good'); assert.match(best.children[1].textContent, /40\/40 paczek.*100%.*braki: 0/);
    assert.deepEqual(best.children[2].children.map(item => item.textContent),
      [1, 2, 3, 4].map(second => `${second}. s: 10/10 · 6000 B/s`));
    assert.equal(receiver.telemetry.snapshot().transfer, null); assert.equal(receiver.els['download-file'].disabled, true);
    receiver.els['show-calibration-feedback'].click(); const feedback = receiver.display('feedback-canvas');
    assert.equal(receiver.context.WGCalibration.isFeedback(feedback), true);
    sender.els['scan-feedback'].click(); await sender.wait(() => sender.videoCallbacks.size === 1);
    await sender.fireFrame('feedback-video', feedback); await sender.wait(() => sender.transfers.length === 2 && !sender.els['choose-file'].disabled);
    const transfer = sender.transfers.at(-1);
    assert.notEqual(transfer.id, old.id); assert.throws(() => old.frame(0), error => error.code === 'TRANSFER_DISPOSED');
    assert.equal(transfer.chunkBytes, 600); assert.equal(sender.rate(), 5); assert.equal(sender.els['series-ecc'].value, 'L');
    assert.equal(sender.els['qr-layout'].value, 'dual'); assert.equal(sender.els['animation-toggle'].getAttribute('aria-pressed'), 'false');
    receiver.els['receiver-view-file'].click();
    receiver.els['resume-receiving'].click(); await receiver.wait(() => receiver.videoCallbacks.size === 1);
    assert.equal(receiver.cameraConstraints.at(-1).video.aspectRatio.ideal, 4 / 3,
      'Applying a 2×1 result must preserve the capture conditions under which it was measured');
    assert.equal(receiver.scannerOptions.at(-1).lanes, 2);
    await receiver.fireFrame('camera-video', sender.pair());
    assert.equal(receiver.els['calibration-panel'].hidden, true); assert.equal(receiver.telemetry.snapshot().usefulUnits, 1);
    sender.els['animation-toggle'].click();
    for (let step = 0; step < 2; step++) { await sender.tick(); await receiver.fireFrame('camera-video', sender.pair()); }
    assert.equal(receiver.els['download-file'].disabled, false); assert.equal(receiver.telemetry.snapshot().cameraAttempts, 3);
    receiver.els['download-file'].click(); assert.deepEqual(new Uint8Array(await receiver.downloads.at(-1).blob.arrayBuffer()), original);
  } finally { sender.close(); receiver.close(); }
});

test('calibration compares four landscape layouts without restarting the camera and applies a complete grid instead of a faster gapped one', async () => {
  const sender = harness(), receiver = harness();
  try {
    const original = Uint8Array.from({ length: 1900 }, (_, index) => (index * 13) % 251);
    sender.change('calibration-layout-scope', 'compare'); sender.els['transfer-mode'].value = 'series';
    sender.choose([new File([original], 'calibration-grid.bin')]); await sender.wait(() => !sender.els['choose-file'].disabled);
    const old = sender.transfers.at(-1);
    await openCalibration(sender);
    assert.equal(sender.grid().length, 6); assert.equal(sender.document.body.classList.contains('qr-expanded'), true);
    assert.match(sender.els['calibration-duration'].textContent, /120 s/);
    receiver.els['decode-tab'].click(); receiver.els['start-camera'].click(); await receiver.wait(() => receiver.videoCallbacks.size === 1);
    const stream = receiver.streams[0]; assert.equal(receiver.scannerOptions[0].lanes, 1);
    await receiver.fireFrame('camera-video', sender.grid()[0]);
    assert.equal(receiver.els['scan-columns'].value, '3'); assert.equal(receiver.els['scan-rows'].value, '2');
    assert.equal(receiver.els['calibration-alignment'].dataset.quality, 'warning');
    for (let attempt = 0; attempt < 3; attempt++) await receiver.fireFrame('camera-video', sender.grid(), { advanceMs: 250 });
    assert.equal(receiver.els['calibration-alignment'].dataset.quality, 'good');
    assert.equal(receiver.cameraConstraints.length, 1); assert.equal(stream.track.stopped, false);
    await measureCalibration(sender, {
      profileCount: 24,
      steps: (profile, index) => index === 22 ? Array.from({ length: 20 }, (_, step) => step)
        : index === 23 ? Array.from({ length: 39 }, (_, step) => step) : [],
      onPackets: (packets, parsed) => receiver.fireFrame('camera-video', packets, { advanceMs: 1000 / parsed.fps })
    });
    assert.equal(receiver.cameraConstraints.length, 1); assert.equal(receiver.streams[0], stream); assert.equal(stream.track.stopped, false);
    for (const [columns, rows] of [[1, 1], [2, 1], [3, 1], [3, 2]]) {
      assert.ok(receiver.scannerGridChanges.some(grid => grid.columns === columns && grid.rows === rows));
    }
    const rows = receiver.els['calibration-results'].children;
    assert.equal(rows.length, 24); assert.equal(rows[22].dataset.best, 'true'); assert.equal(rows[22].dataset.quality, 'good');
    assert.match(rows[22].children[1].textContent, /120\/120 paczek.*100%.*braki: 0/);
    assert.equal(rows[23].dataset.best, 'false'); assert.equal(rows[23].dataset.quality, 'failed');
    assert.match(rows[23].children[1].textContent, /234\/240 paczek.*braki: 6/);
    assert.equal(receiver.els['show-calibration-feedback'].hidden, false);
    receiver.els['show-calibration-feedback'].click(); const feedback = receiver.display('feedback-canvas');
    sender.els['scan-feedback'].click(); await sender.wait(() => sender.videoCallbacks.size === 1);
    await sender.fireFrame('feedback-video', feedback);
    await sender.wait(() => sender.transfers.length === 2 && !sender.els['choose-file'].disabled);
    const transfer = sender.transfers.at(-1);
    assert.equal(transfer.chunkBytes, 600); assert.equal(sender.rate(), 5);
    assert.equal(sender.els['qr-columns'].value, '3'); assert.equal(sender.els['qr-rows'].value, '2');
    assert.equal(sender.grid().length, 6); assert.equal(sender.document.body.classList.contains('qr-expanded'), true);
    assert.equal(sender.els['animation-toggle'].getAttribute('aria-pressed'), 'false');
    assert.deepEqual(await collectTransfer(sender.protocol, transfer), original);
    assert.throws(() => old.frame(0), error => error.code === 'TRANSFER_DISPOSED');
  } finally { sender.close(); receiver.close(); }
});

test('landscape calibration closes sixty profiles with missing data and applies a measured 5 by 3 result', async () => {
  const sender = harness(), receiver = harness(); const plan = sender.context.WGCalibration.createObserver();
  try {
    const original = Uint8Array.from({ length: 1900 }, (_, index) => (index * 31 + 19) % 256);
    sender.els['transfer-mode'].value = 'series'; sender.setRate(10);
    sender.choose([new File([original], 'calibration-fifteen.bin')]); await sender.wait(() => !sender.els['choose-file'].disabled);
    const old = sender.transfers.at(-1), setup = await openCalibration(sender);
    assert.equal(setup.length, 15);
    for (const bytes of setup) plan.accept(bytes, sender.now);
    assert.equal(plan.state.allLayouts, true); assert.equal(plan.state.landscapeOnly, true); assert.equal(plan.state.totalProfiles, 60);
    const target = plan.state.results.find(profile => profile.grid.columns === 5 && profile.grid.rows === 3
      && profile.chunkBytes === 600 && profile.fps === 2);
    assert.ok(target);
    receiver.els['decode-tab'].click(); receiver.els['start-camera'].click(); await receiver.wait(() => receiver.videoCallbacks.size === 1);
    const stream = receiver.streams[0]; await receiver.fireFrame('camera-video', setup);
    assert.equal(calibrationCells(receiver).length, 60);
    assert.ok(calibrationCells(receiver).every(cell => cell.dataset.state === 'pending'));
    assert.deepEqual([receiver.els['scan-columns'].value, receiver.els['scan-rows'].value], ['5', '3']);
    assert.match(receiver.els['calibration-current-density'].textContent, /29\s*×\s*29/);
    const started = sender.now; sender.els['begin-calibration'].click(); await sender.flush();
    await receiver.fireFrame('camera-video', sender.grid());
    // Skip unobserved profiles deliberately: the finished map must retain their
    // ten landscape layouts and mark their missing data instead of inventing success.
    await calibrationAt(sender, started + target.index * 5000);
    await receiver.fireFrame('camera-video', sender.grid());
    for (let step = 0; step < target.fps * 4; step++) {
      await calibrationAt(sender, started + target.index * 5000 + 1000 + step * 1000 / target.fps);
      const parsed = sender.context.WGCalibration.parse(sender.display());
      assert.equal(parsed.version, 5); assert.equal(parsed.landscapeOnly, true);
      assert.equal(parsed.allLayouts, true); assert.equal(parsed.alignment, false);
      assert.equal(sender.grid().length, 15); assert.equal(sender.display().length, 640);
      const computations = receiver.calibrationViewComputes;
      await receiver.fireFrame('camera-video', sender.grid(), { advanceMs: 1000 / target.fps });
      assert.equal(receiver.calibrationViewComputes - computations, 1, 'One camera batch must repaint the map once after accepting all fifteen symbols.');
      assert.match(renderedText(calibrationCell(receiver, target.index)), new RegExp(`${(step + 1) * 15}\\s*\\/\\s*120`));
    }
    await calibrationAt(sender, started + 60 * 5000);
    assert.equal(sender.context.WGCalibration.parse(sender.display()).ended, true);
    await receiver.fireFrame('camera-video', sender.grid());
    const cells = calibrationCells(receiver);
    assert.equal(cells.length, 60);
    assert.equal(new Set(cells.map(cell => `${cell.dataset.columns}x${cell.dataset.rows}`)).size, 10);
    assert.equal(calibrationCell(receiver, target.index).dataset.state, 'passed');
    assertCalibrationCounts(receiver, { passed: 1, failed: 59, pending: 0, running: 0 });
    assert.equal(receiver.cameraConstraints.length, 1); assert.equal(stream.track.stopped, false);
    assert.equal(receiver.telemetry.snapshot().transfer, null); assert.equal(receiver.els['download-file'].disabled, true);
    receiver.els['show-calibration-feedback'].click(); const feedback = receiver.display('feedback-canvas');
    assert.equal(receiver.context.WGCalibration.isFeedback(feedback), true);
    sender.els['scan-feedback'].click(); await sender.wait(() => sender.videoCallbacks.size === 1);
    await sender.fireFrame('feedback-video', feedback);
    await sender.wait(() => sender.transfers.length === 2 && !sender.els['choose-file'].disabled);
    const transfer = sender.transfers.at(-1);
    assert.deepEqual([sender.els['qr-columns'].value, sender.els['qr-rows'].value, transfer.chunkBytes, sender.rate()], ['5', '3', 600, 2]);
    assert.equal(sender.grid().length, 15); assert.equal(sender.els['qr-paper-15'].hidden, false);
    assert.equal(sender.els['animation-toggle'].getAttribute('aria-pressed'), 'false');
    assert.deepEqual(await collectTransfer(sender.protocol, transfer), original);
    assert.throws(() => old.frame(0), error => error.code === 'TRANSFER_DISPOSED');
  } finally { plan.dispose(); sender.close(); receiver.close(); }
});

test('calibration with three observed steps per profile exposes gaps and offers no setting feedback', async () => {
  const sender = harness(), receiver = harness();
  try {
    sender.change('calibration-layout-scope', 'current');
    sender.change('qr-columns', '3'); sender.change('qr-rows', '2');
    sender.els['series-sample'].click(); await sender.wait(() => !sender.els['choose-file'].disabled);
    await openCalibration(sender);
    receiver.els['decode-tab'].click(); receiver.els['start-camera'].click(); await receiver.wait(() => receiver.videoCallbacks.size === 1);
    await measureCalibration(sender, {
      steps: () => [0, 1, 2],
      onPackets: (packets, parsed) => receiver.fireFrame('camera-video', packets, { advanceMs: 1000 / parsed.fps })
    });
    assert.match(receiver.els['calibration-result'].textContent, /Żaden profil.*bez luk/);
    assert.match(receiver.els['calibration-coverage'].textContent, /6\/6/);
    assert.equal(receiver.els['calibration-results'].children.length, 6);
    assert.ok(receiver.els['calibration-results'].children.every(row => row.dataset.quality === 'failed' && row.dataset.best === 'false'));
    assert.equal(receiver.els['show-calibration-feedback'].hidden, true);
    receiver.els['show-calibration-feedback'].click(); assert.equal(receiver.display('feedback-canvas'), null);
    assert.equal(receiver.telemetry.snapshot().transfer, null); assert.equal(receiver.els['download-file'].disabled, true);
  } finally { sender.close(); receiver.close(); }
});

test('complete calibration images show packet coverage but cannot be presented as a camera speed recommendation', async () => {
  const h = harness(); let trial;
  try {
    trial = h.context.WGCalibration.create({ grid: { columns: 1, rows: 1 } });
    h.els['decode-tab'].click();
    for (let sequence = 0; sequence < 8; sequence++) {
      h.upload(trial.frame(0, sequence)); await h.wait(() => !h.els['choose-image'].disabled);
    }
    h.upload(trial.endFrame()); await h.wait(() => !h.els['choose-image'].disabled);
    assert.match(h.els['calibration-result'].textContent, /komplet paczek/);
    assert.match(h.els['calibration-coverage'].textContent, /z obrazów.*nową próbę kamerą/);
    assert.equal(h.els['calibration-results'].children[0].dataset.quality, 'good');
    assert.doesNotMatch(h.els['calibration-results'].children[0].children[1].textContent, /B\/s/);
    assertReceiverView(h, 'calibration');
    assert.equal(calibrationCell(h, 0).dataset.state, 'passed');
    assert.equal(calibrationCell(h, 0).dataset.best, 'false');
    assert.equal(h.els['calibration-results'].children[0].dataset.best, 'false');
    assert.match(h.els['calibration-view-status'].textContent, /bez pomiaru szybkości kamery/);
    assert.doesNotMatch(renderedText(h.els['calibration-map']), /B\/s/,
      'Packet coverage imported from images must not appear as a camera throughput measurement.');
    assert.equal(h.els['show-calibration-feedback'].hidden, true); assert.equal(h.cameraConstraints.length, 0);
    h.els['show-calibration-feedback'].click(); assert.equal(h.display('feedback-canvas'), null);
  } finally { trial?.dispose(); h.close(); }
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
    h.change('calibration-layout-scope', 'current');
    h.change('qr-layout', 'dual'); h.change('calibration-range', 'fast');
    h.els['series-sample'].click(); await h.wait(() => !h.els['choose-file'].disabled);
    const old = h.transfers.at(-1), observer = h.context.WGCalibration.createObserver();
    await openCalibration(h);
    assert.match(h.els['calibration-duration'].textContent, /50 s/);
    await measureCalibration(h, {
      profileCount: 10,
      steps: (profile, index) => index === 9 ? Array.from({ length: 80 }, (_, step) => step) : [],
      onPackets(packets, parsed) {
        assert.equal(parsed.version, 5); assert.equal(parsed.landscapeOnly, true);
        for (const bytes of packets) observer.accept(bytes, h.now);
      }
    });
    assert.equal(observer.state.best.fps, 20); assert.equal(observer.state.best.chunkBytes, 600);
    assert.equal(observer.state.best.samples, 160); assert.equal(observer.state.best.missing, 0);
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
    h.change('calibration-layout-scope', 'current');
    h.change('qr-layout', 'dual'); h.els['series-sample'].click(); await h.wait(() => !h.els['choose-file'].disabled);
    const initial = h.pair(); h.deferEncoding = true; h.els['start-calibration'].click();
    await h.wait(() => h.encoderJobs.at(-1)?.ready && h.encoderJobs.at(-1)?.release);
    const alignment = h.encoderJobs.at(-1); h.now += 550; h.deferEncoding = false; alignment.release(); await h.flush();
    assert.equal(h.context.WGCalibration.parse(h.display()).alignment, true,
      'Static alignment remains valid even when preparation takes longer than one measured display slot');
    assert.ok(alignment.matrices.every(matrix => matrix.data.some(value => value !== 0)));
    h.els['begin-calibration'].click(); await h.flush();
    h.deferEncoding = true;
    const missed = h.tick('tickCalibration'); await h.wait(() => h.encoderJobs.at(-1)?.ready && h.encoderJobs.at(-1)?.release);
    const visible = h.grid(); assert.equal(h.context.WGCalibration.parse(h.display()).sequence, 0);
    const late = h.encoderJobs.at(-1); h.now += 550; h.deferEncoding = false; late.release(); await missed; await h.flush();
    assert.deepEqual(h.grid(), visible); assert.ok(late.matrices.every(matrix => matrix.data.every(value => value === 0)));
    await h.tick('tickCalibration'); await h.flush();
    assert.equal(h.context.WGCalibration.parse(h.display()).sequence, 4, 'The late slot is omitted instead of shown as a short catch-up flash');
    h.deferEncoding = true;
    const next = h.tick('tickCalibration'); await h.wait(() => h.encoderJobs.at(-1)?.ready && h.encoderJobs.at(-1)?.release);
    const cancelled = h.encoderJobs.at(-1); h.els['stop-calibration'].click();
    h.deferEncoding = false; cancelled.release(); await next; await h.flush();
    assert.deepEqual(h.pair(), initial, 'Stopping a trial restores the original paused file view');
    assert.equal(h.els['stop-calibration'].hidden, true);
    assert.equal(h.els['animation-toggle'].disabled, false); assert.ok(cancelled.matrices.every(matrix => matrix.data.every(value => value === 0)));
    assert.ok([...h.timers.values()].every(timer => timer.fn.name !== 'tickCalibration'));
  } finally { h.close(); }
});

test('calibration prefetch gives 20 Hz samples their full 50 ms display slots despite 35 ms encoding', async () => {
  const h = harness();
  try {
    h.change('calibration-layout-scope', 'current');
    h.change('calibration-range', 'fast'); h.els['series-sample'].click();
    await h.wait(() => !h.els['choose-file'].disabled);
    const initial = h.grid(); await openCalibration(h);
    const started = h.now; h.els['begin-calibration'].click(); await h.flush();
    await calibrationAt(h, started + 9 * 5000);
    assert.equal(h.context.WGCalibration.parse(h.display()).alignment, true);
    h.deferEncoding = true;
    const paints = h.rendered.length;
    for (let step = 0; step < 5; step++) {
      await h.tick('tickCalibration', { flush: false });
      const parsed = h.context.WGCalibration.parse(h.display());
      assert.equal(parsed.index, 9); assert.equal(parsed.alignment, false); assert.equal(parsed.step, step);
      assert.equal(h.now, started + 9 * 5000 + 1000 + step * 50);
      await h.wait(() => h.encoderJobs.at(-1)?.ready && h.encoderJobs.at(-1)?.release);
      const future = h.encoderJobs.at(-1), visible = h.grid(), count = h.rendered.length;
      h.now += 35; future.release(); await h.flush();
      assert.deepEqual(h.grid(), visible); assert.equal(h.rendered.length, count,
        'Finishing a future matrix must not replace the current QR before its display boundary');
    }
    const shown = h.rendered.slice(paints).filter(paint => paint.canvas === h.els['qr-canvas']);
    assert.equal(shown.length, 5);
    assert.deepEqual(shown.map(paint => paint.at), [0, 1, 2, 3, 4].map(step => started + 46000 + step * 50));
    assert.equal(h.maxActiveEncodes, 1, 'Lookahead must keep one encoder request in flight');
    const prepared = h.encoderJobs.at(-1); assert.ok(prepared.matrices.some(matrix => matrix.data.some(Boolean)));
    h.els['stop-calibration'].click(); h.deferEncoding = false; await h.flush();
    assert.deepEqual(h.grid(), initial); assert.ok(prepared.matrices.every(matrix => matrix.data.every(value => value === 0)));
  } finally { h.close(); }
});

test('closing the QR view, changing tabs and hiding the page cancel both pending alignment and prepared measurement', async t => {
  for (const phase of ['alignment-pending', 'measurement-prepared']) {
    for (const action of ['close-view', 'change-tab', 'hide-page']) await t.test(`${phase}: ${action}`, async () => {
      const h = harness();
      try {
        h.change('calibration-layout-scope', 'current');
        h.change('qr-columns', '5'); h.change('qr-rows', '3'); h.els['series-sample'].click();
        await h.wait(() => !h.els['choose-file'].disabled); const initial = h.grid();
        if (phase === 'alignment-pending') {
          h.deferEncoding = true; h.els['start-calibration'].click();
          await h.wait(() => h.encoderJobs.at(-1)?.ready && h.encoderJobs.at(-1)?.release);
          assert.equal(h.display(), null, 'File content is cleared while synthetic alignment is being prepared');
        } else {
          await openCalibration(h); h.els['begin-calibration'].click(); await h.flush();
          assert.equal(h.context.WGCalibration.parse(h.display()).alignment, true);
          assert.ok(h.encoderJobs.at(-1).matrices.some(matrix => matrix.data.some(Boolean)));
        }
        assert.equal(h.document.body.classList.contains('qr-expanded'), true);
        if (action === 'close-view') h.els['close-expanded'].click();
        else if (action === 'change-tab') h.els['decode-tab'].click();
        else { h.document.hidden = true; h.dispatchWindow('visibilitychange'); }
        assert.equal(h.els['begin-calibration'].hidden, true); assert.equal(h.els['stop-calibration'].hidden, true);
        assert.equal(h.document.body.classList.contains('qr-calibrating'), false);
        assert.equal(h.els['animation-toggle'].getAttribute('aria-pressed'), 'false');
        const count = h.rendered.length;
        h.deferEncoding = false; for (const job of h.encoderJobs) job.release?.(); await h.flush();
        assert.equal(h.rendered.length, count, 'A cancelled preparation cannot paint into the restored file view');
        assert.deepEqual(h.grid(), initial);
        const trialJobs = h.encoderJobs.filter(job => h.context.WGCalibration.isFrame(job.inputs[0]));
        assert.ok(trialJobs.length > 0);
        assert.ok(trialJobs.every(job => job.inputs.length === 15 && job.matrices.length === 15));
        assert.ok(trialJobs.every(job => job.matrices.every(matrix => matrix.data.every(value => value === 0))));
        assert.ok([...h.timers.values()].every(timer => timer.fn.name !== 'tickCalibration'));
      } finally { h.close(); }
    });
  }
});

test('a late camera calibration decode cannot change the selected grid after receiver reset', async () => {
  const h = harness(); let trial;
  try {
    trial = h.context.WGCalibration.create({ grid: { columns: 2, rows: 2 } });
    h.els['decode-tab'].click(); h.els['start-camera'].click(); await h.wait(() => h.videoCallbacks.size === 1);
    h.deferScans = true;
    const pending = h.fireFrame('camera-video', trial.alignmentFrame()); await h.wait(() => h.scanJobs.length === 1);
    h.els['reset-receiver'].click(); h.change('scan-columns', '3');
    h.deferScans = false; h.scanJobs[0].release(); await pending; await h.micro();
    assert.equal(h.els['scan-columns'].value, '3'); assert.equal(h.els['scan-rows'].value, '1');
    assert.equal(h.els['calibration-panel'].hidden, true); assert.equal(h.els['calibration-alignment'].hidden, true);
    assert.equal(h.scannerGridChanges.length, 0); assert.equal(h.videoCallbacks.size, 0);
    assert.equal(h.telemetry.snapshot().transfer, null); assert.equal(h.els['download-file'].disabled, true);
  } finally { trial?.dispose(); h.close(); }
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
    const setup = h.context.WGCalibration.parse(h.display());
    assert.equal(setup.version, 5); assert.equal(setup.setup, true); assert.equal(setup.large, true);
    assert.equal(h.display().length, 40);
    h.els['begin-calibration'].click(); await h.flush();
    const parsed = h.context.WGCalibration.parse(h.display());
    assert.equal(parsed.alignment, true); assert.equal(parsed.setup, false);
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
    h.els['receiver-view-file'].click();
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

test('fifteen current QR matrices survive three prefetched screens and cache eviction stays bounded', async () => {
  const h = harness();
  try {
    const original = Uint8Array.from({ length: 384 * 180 }, (_, index) => (index * 37 + Math.floor(index / 239)) % 256);
    h.change('qr-columns', '5'); h.change('qr-rows', '3');
    h.choose([new File([original], 'matrix-cache-fifteen.bin')]);
    await h.wait(() => !h.els['choose-file'].disabled);
    const initial = h.rendered.slice(-15).map(frame => frame.matrix);
    assert.equal(h.grid().length, 15);

    // Payload labels in the renderer mock survive even when a matrix is erased.
    // Compare the actual modules with independently regenerated QR matrices.
    const verify = matrices => {
      for (const matrix of new Set(matrices)) {
        const encoded = h.encodings.find(entry => entry.matrix.data === matrix.data);
        assert.ok(encoded, 'Every cached matrix must have a source packet.');
        const expected = h.context.WGQR.encodeBytes(encoded.bytes, encoded.options);
        assert.equal(matrix.size, expected.size);
        assert.deepEqual(Uint8Array.from(matrix.data), Uint8Array.from(expected.data),
          'A visible or prefetched QR must retain all of its modules until presentation.');
      }
    };
    h.els['animation-toggle'].click(); await h.flush();
    assert.equal(h.encoderJobs.length, 3, 'Preparation must stop at three complete future screens.');
    assert.equal(h.maxActiveEncodes, 1);
    assert.ok(initial.length + h.encoderJobs.reduce((sum, job) => sum + job.matrices.length, 0) > 32,
      'This fixture must exceed the previous cache limit before presenting another screen.');
    verify([...initial, ...h.encoderJobs.flatMap(job => job.matrices)]);
    const initialPackets = h.grid();
    h.els['download-qr'].click();
    const png = h.downloads.at(-1).blob.png;
    assert.equal(png.draws.length, 15);
    assert.deepEqual(png.draws.map(draw => draw.payload), initialPackets);
    verify(png.draws.map(draw => draw.image.matrix));
    h.els['animation-toggle'].click(); await h.flush(); // Export pauses playback; cached screens can be reused.

    // Churn beyond the cache budget, checking both the new visible screen and
    // all three queued screens after every refill, including reused manifests.
    for (let step = 0; step < 8; step++) {
      await h.tick(); await h.flush();
      assert.equal(h.encoderJobs.length, step + 4);
      verify([...h.rendered.filter(frame => frame.canvas.id.startsWith('qr-canvas')).slice(-15).map(frame => frame.matrix),
        ...h.encoderJobs.slice(-3).flatMap(job => job.matrices)]);
    }
    const cached = [...new Set([...initial, ...h.encoderJobs.flatMap(job => job.matrices)])];
    assert.ok(cached.length > 100, 'The fixture must exercise eviction repeatedly.');
    assert.ok(cached.filter(matrix => matrix.data.some(value => value !== 0)).length <= 15 * 4,
      'Retained matrices must fit the current screen and three-screen cache budget.');
    assert.ok(cached.some(matrix => matrix.data.every(value => value === 0)), 'Unused evicted matrices must be erased.');
    assert.equal(h.maxActiveEncodes, 1);
    h.els['clear-all'].click();
    assert.ok(cached.every(matrix => matrix.data.every(value => value === 0)), 'Clearing the source must erase retained QR modules.');
  } finally { h.close(); }
});
