/* WGTelemetry — bounded, local reception statistics; never stores file contents or identifiers. */
(function (root) {
  'use strict';

  const DEFAULT_VERSION = '2026.11.21-telemetry.1';
  const WINDOW_MS = 5000;
  const BUCKET_MS = 100;
  const BUCKET_COUNT = 51;
  const MAX_COUNT = Number.MAX_SAFE_INTEGER;
  const TYPES = ['single', 'mixed', 'legacy', 'plain', 'manifest', 'unknown'];
  const REASONS = ['foreign', 'invalid', 'feedback'];
  const TRANSFER_FIELDS = ['version', 'size', 'total', 'chunkBytes', 'blockCount', 'received', 'blocksComplete'];

  function integer(value, maximum = MAX_COUNT) {
    return Number.isSafeInteger(value) && value >= 0 && value <= maximum ? value : null;
  }
  function finite(value, maximum = MAX_COUNT) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maximum ? value : null;
  }
  function add(left, right = 1) { return Math.min(MAX_COUNT, left + right); }
  function round(value) {
    if (value === null || !Number.isFinite(value)) return null;
    return value > MAX_COUNT / 1000 ? value : Math.round(value * 1000) / 1000;
  }
  function copy(value) {
    return {
      ...value,
      rejections: { ...value.rejections },
      video: value.video ? { ...value.video } : null,
      lastScanPixels: value.lastScanPixels ? { ...value.lastScanPixels } : null,
      transfer: value.transfer ? { ...value.transfer } : null
    };
  }
  function latencyBin(milliseconds) {
    if (milliseconds === 0) return 0;
    if (milliseconds <= 1000) return Math.ceil(milliseconds / 5);
    if (milliseconds <= 10000) return 200 + Math.ceil((milliseconds - 1000) / 100);
    if (milliseconds <= 60000) return 290 + Math.ceil((milliseconds - 10000) / 1000);
    return 341;
  }
  function latencyUpperBound(index, maximum) {
    if (index === 0) return 0;
    if (index <= 200) return Math.min(maximum, index * 5);
    if (index <= 290) return Math.min(maximum, 1000 + (index - 200) * 100);
    if (index <= 340) return Math.min(maximum, 10000 + (index - 290) * 1000);
    return maximum;
  }

  function create(options = {}) {
    const configuration = options && typeof options === 'object' ? options : {};
    const now = typeof configuration.now === 'function' ? configuration.now : () => (
      root.performance && typeof root.performance.now === 'function' ? root.performance.now() : Date.now()
    );
    const appVersion = typeof configuration.appVersion === 'string'
      && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(configuration.appVersion)
      ? configuration.appVersion : DEFAULT_VERSION;

    let lastNow;
    let firstAcceptedAt;
    let cameraStartedAt;
    let cameraMs;
    let frozen;
    let counters;
    let rejections;
    let transfer;
    let video;
    let lastScanPixels;
    let latencyTotal;
    let latencyMaximum;
    let histogram;
    let recent;

    function clock() {
      let timestamp;
      try { timestamp = finite(now()); } catch { timestamp = null; }
      if (timestamp === null) timestamp = lastNow === null ? 0 : lastNow;
      if (lastNow !== null) timestamp = Math.max(timestamp, lastNow);
      lastNow = timestamp;
      return timestamp;
    }
    function reset() {
      lastNow = null;
      firstAcceptedAt = null;
      cameraStartedAt = null;
      cameraMs = 0;
      frozen = null;
      transfer = null;
      video = null;
      lastScanPixels = null;
      latencyTotal = 0;
      latencyMaximum = 0;
      // Fixed-size histogram: 5 ms buckets through 1 s, 100 ms through 10 s,
      // 1 s through 60 s, then one overflow bucket represented by observed max.
      histogram = new Float64Array(342);
      recent = Array.from({ length: BUCKET_COUNT }, () => ({ slot: -1, units: 0 }));
      counters = {
        cameraStarts: 0, cameraAttempts: 0, decodeAttempts: 0, opticalReads: 0, imageReads: 0,
        acceptedPackets: 0, usefulPackets: 0, redundantPackets: 0, usefulUnits: 0,
        cameraPackets: 0, imagePackets: 0,
        singleFragmentPackets: 0, mixedEquationPackets: 0,
        legacyPackets: 0, plainPackets: 0, manifestPackets: 0, unknownPackets: 0,
        rejectedPackets: 0, latencySamples: 0, trackedAttempts: 0, searchAttempts: 0
      };
      rejections = { foreign: 0, invalid: 0, feedback: 0 };
    }
    function increment(name, value = 1) { counters[name] = add(counters[name], value); }
    function percentile95() {
      if (!counters.latencySamples) return null;
      const threshold = Math.ceil(counters.latencySamples * 0.95);
      let count = 0;
      for (let index = 0; index < histogram.length; index++) {
        count += histogram[index];
        if (count >= threshold) return latencyUpperBound(index, latencyMaximum);
      }
      return latencyMaximum;
    }
    function recentRate(timestamp, elapsedMs) {
      if (elapsedMs <= 0) return null;
      const start = Math.max(firstAcceptedAt, timestamp - WINDOW_MS);
      let units = 0;
      for (const bucket of recent) {
        // The partially overlapping boundary bucket makes this a bounded
        // indicator with at most 100 ms of time quantization, not an exact log.
        if (bucket.slot >= 0 && bucket.slot * BUCKET_MS <= timestamp
          && (bucket.slot + 1) * BUCKET_MS > start) units += bucket.units;
      }
      return units * 1000 / Math.min(WINDOW_MS, elapsedMs);
    }
    function buildSnapshot(timestamp, complete = false) {
      const elapsedMs = firstAcceptedAt === null ? 0 : Math.max(0, timestamp - firstAcceptedAt);
      const activeMs = cameraMs + (cameraStartedAt === null ? 0 : Math.max(0, timestamp - cameraStartedAt));
      return {
        schemaVersion: 1,
        appVersion,
        started: firstAcceptedAt !== null,
        complete,
        elapsedMs: round(elapsedMs),
        cameraActiveMs: round(activeMs),
        ...counters,
        qrReads: add(counters.opticalReads, counters.imageReads),
        rejections: { ...rejections },
        latencyAvgMs: counters.latencySamples ? round(latencyTotal / counters.latencySamples) : null,
        latencyP95Ms: round(percentile95()),
        latencyP95Approximate: true,
        video: video ? { ...video } : null,
        lastScanPixels: lastScanPixels ? { ...lastScanPixels } : null,
        transfer: transfer ? { ...transfer } : null,
        averageBytesPerSecond: complete && elapsedMs > 0 && transfer && transfer.size !== null
          ? round(transfer.size * 1000 / elapsedMs) : null,
        averageUnitsPerSecond: elapsedMs > 0 ? round(counters.usefulUnits * 1000 / elapsedMs) : null,
        recentUsefulUnitsPerSecond: round(recentRate(timestamp, elapsedMs))
      };
    }
    function startCamera(settings = {}) {
      if (frozen) return;
      const timestamp = clock();
      if (cameraStartedAt === null) {
        cameraStartedAt = timestamp;
        increment('cameraStarts');
      }
      const input = settings && typeof settings === 'object' ? settings : {};
      video = {
        width: integer(input.width, 65536),
        height: integer(input.height, 65536),
        frameRate: finite(input.frameRate, 1000)
      };
    }
    function stopCamera() {
      if (frozen || cameraStartedAt === null) return;
      const timestamp = clock();
      cameraMs += Math.max(0, timestamp - cameraStartedAt);
      cameraStartedAt = null;
    }
    function recordScan(sample = {}) {
      if (frozen) return;
      const input = sample && typeof sample === 'object' ? sample : {};
      increment('cameraAttempts');
      const attempts = integer(input.attempts, 15);
      increment('decodeAttempts', attempts === null ? 1 : attempts);
      const symbols = integer(input.symbols, 15);
      if (symbols !== null) increment('opticalReads', symbols);
      else if (input.result) increment('opticalReads');
      if (input.region === 'tracked') increment('trackedAttempts');
      else if (input.region === 'search') increment('searchAttempts');
      const latency = finite(input.decodeMs);
      if (latency !== null) {
        increment('latencySamples');
        latencyTotal += latency;
        latencyMaximum = Math.max(latencyMaximum, latency);
        const bin = latencyBin(latency);
        histogram[bin] = add(histogram[bin]);
      }
      const pixels = input.pixels;
      if (pixels && typeof pixels === 'object') {
        const width = integer(pixels.width, 65536);
        const height = integer(pixels.height, 65536);
        if (width !== null && height !== null) lastScanPixels = { width, height };
      }
    }
    function recordPacket(metadata, options = {}) {
      if (frozen || !metadata || typeof metadata !== 'object') return;
      const timestamp = clock();
      const input = options && typeof options === 'object' ? options : {};
      if (firstAcceptedAt === null) firstAcceptedAt = timestamp;
      if (!transfer) transfer = Object.fromEntries(TRANSFER_FIELDS.map(field => [field, null]));
      for (const field of TRANSFER_FIELDS) {
        const value = integer(metadata[field]);
        if (value !== null) transfer[field] = value;
      }
      increment('acceptedPackets');
      if (input.source === 'image') { increment('imagePackets'); increment('imageReads'); }
      else increment('cameraPackets');
      const type = TYPES.includes(input.packetType) ? input.packetType : 'unknown';
      const counter = {
        single: 'singleFragmentPackets', mixed: 'mixedEquationPackets',
        legacy: 'legacyPackets', plain: 'plainPackets', manifest: 'manifestPackets', unknown: 'unknownPackets'
      }[type];
      increment(counter);
      const delta = integer(input.delta) || 0;
      if (delta > 0) {
        // A manifest can unlock previously buffered data. Count those rank gains,
        // while keeping the metadata packet separate from data and duplicates.
        if (type !== 'manifest') increment('usefulPackets');
        increment('usefulUnits', delta);
        const slot = Math.floor(timestamp / BUCKET_MS);
        const bucket = recent[slot % BUCKET_COUNT];
        if (bucket.slot !== slot) { bucket.slot = slot; bucket.units = 0; }
        bucket.units = add(bucket.units, delta);
      } else if (type !== 'manifest') increment('redundantPackets');
      if (metadata.complete === true) {
        if (cameraStartedAt !== null) {
          cameraMs += Math.max(0, timestamp - cameraStartedAt);
          cameraStartedAt = null;
        }
        frozen = buildSnapshot(timestamp, true);
      }
    }
    function recordRejected(reason = 'invalid', options = {}) {
      if (frozen) return;
      const acceptedReason = REASONS.includes(reason) ? reason : 'invalid';
      const input = options && typeof options === 'object' ? options : {};
      increment('rejectedPackets');
      rejections[acceptedReason] = add(rejections[acceptedReason]);
      if (input.source === 'image') increment('imageReads');
    }
    function snapshot() { return frozen ? copy(frozen) : buildSnapshot(clock()); }
    reset();
    return { reset, startCamera, stopCamera, recordScan, recordPacket, recordRejected, snapshot, report: () => JSON.stringify(snapshot(), null, 2) };
  }

  root.WGTelemetry = Object.freeze({ create });
})(typeof window !== 'undefined' ? window : globalThis);
