/* WGCamera — local QR tracking, independent grid symbols, bounded worker decoding. */
(function (root) {
  'use strict';

  const SEARCH_EDGE = 960;
  const DETAIL_EDGE = 1600;
  const TRACK_EDGE = 960;
  const WORKER_TIMEOUT = 3000;
  const CORNERS = ['topLeftCorner', 'topRightCorner', 'bottomRightCorner', 'bottomLeftCorner'];

  function validGrid(columns, rows) {
    return Number.isInteger(columns) && columns >= 1 && columns <= 5
      && Number.isInteger(rows) && rows >= 1 && rows <= 4;
  }

  function createScanner({ decode, lanes, columns, rows, workerUrl = null } = {}) {
    if (typeof decode !== 'function') throw new TypeError('WGCamera requires a decode function.');
    let explicitGrid = columns !== undefined || rows !== undefined;
    if (explicitGrid) {
      if (!validGrid(columns, rows) || (lanes !== undefined && lanes !== columns * rows)) {
        throw new TypeError('WGCamera requires 1–5 columns and 1–4 rows.');
      }
      lanes = columns * rows;
    } else {
      if (lanes === undefined) lanes = 1;
      if (lanes !== 1 && lanes !== 2) throw new TypeError('WGCamera requires one/two legacy lanes or an explicit grid.');
      columns = lanes; rows = 1;
    }
    const ownerDocument = root.document;
    const now = () => root.performance.now();
    const makeSurface = () => {
      const canvas = ownerDocument.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
      if (!context) throw new Error('Nie udało się przygotować obrazu z kamery.');
      return { canvas, context };
    };
    const state = () => ({ tracked: null, trackedMisses: 0, misses: 0, searches: 0,
      forceDetail: false, preferBoth: false, polarityProbe: 0, version: 0, stableHits: 0, latency: 0 });
    const surfaces = [makeSurface()];
    let states = Array.from({ length: lanes }, state);
    let snapshot = null;
    let disposed = false;
    let sourceWidth = 0;
    let sourceHeight = 0;
    let searchRound = 0;
    let generation = 0;
    let activeScan = null;
    let worker = null;
    let workerFailed = false;
    let workerPending = null;
    let workerSerial = 0;

    function empty(extra = {}) {
      return { result: null, results: [], decodeMs: 0, region: 'search',
        pixels: { width: 0, height: 0 }, pixelCount: 0, attempts: 0, ...extra };
    }
    function ensureSurfaces() {
      while (surfaces.length < lanes) surfaces.push(makeSurface());
      if (lanes > 1 && !snapshot) snapshot = makeSurface();
    }
    ensureSurfaces();

    function clearTracking() { states = Array.from({ length: lanes }, state); searchRound = 0; }
    function mapLocation(location, region, width, height) {
      if (!location || typeof location !== 'object') return location;
      const mapped = {};
      for (const [name, point] of Object.entries(location)) {
        mapped[name] = point && Number.isFinite(point.x) && Number.isFinite(point.y)
          ? { ...point, x: region.x + point.x * region.width / width, y: region.y + point.y * region.height / height }
          : point;
      }
      return mapped;
    }
    function bounds(location, width, height) {
      if (!location || CORNERS.some(name => !location[name]
        || !Number.isFinite(location[name].x) || !Number.isFinite(location[name].y))) return null;
      const left = Math.max(0, Math.min(...CORNERS.map(name => location[name].x)));
      const top = Math.max(0, Math.min(...CORNERS.map(name => location[name].y)));
      const right = Math.min(width, Math.max(...CORNERS.map(name => location[name].x)));
      const bottom = Math.min(height, Math.max(...CORNERS.map(name => location[name].y)));
      if (right - left < 8 || bottom - top < 8) return null;
      return { left, top, right, bottom };
    }
    function samePosition(a, b) {
      if (!a || !b) return false;
      const intersection = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
        * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      const smaller = Math.min((a.right - a.left) * (a.bottom - a.top), (b.right - b.left) * (b.bottom - b.top));
      return intersection > smaller * 0.6;
    }
    function trackedRegion(lane, width, height) {
      const tracked = lane.tracked;
      const span = Math.max(tracked.right - tracked.left, tracked.bottom - tracked.top);
      const margin = Math.max(24, span * (lane.trackedMisses ? 0.38 : 0.22));
      const x = Math.max(0, Math.floor(tracked.left - margin));
      const y = Math.max(0, Math.floor(tracked.top - margin));
      return { x, y, width: Math.min(width, Math.ceil(tracked.right + margin)) - x,
        height: Math.min(height, Math.ceil(tracked.bottom + margin)) - y };
    }
    function gridRegion(index, width, height, detail) {
      const tracked = states.filter(lane => lane.tracked);
      // If the sender returned to one large code, all untracked lanes can share
      // one detailed full-frame probe instead of decoding up to twenty copies.
      if (detail && !tracked.length && (states[index].forceDetail || searchRound % 8 === 7)) {
        return { x: 0, y: 0, width, height };
      }
      // Try both axes without changing the video stream. Clean and overlapping
      // crops cover each orientation, including a monitor or phone turned 90°.
      const transpose = columns !== rows && Math.floor(searchRound / 2) % 2 === 1;
      const cols = transpose ? rows : columns, lines = transpose ? columns : rows;
      const occupied = new Set(tracked.map(lane => {
        const x = (lane.tracked.left + lane.tracked.right) / 2;
        const y = (lane.tracked.top + lane.tracked.bottom) / 2;
        return Math.min(lines - 1, Math.floor(y * lines / height)) * cols
          + Math.min(cols - 1, Math.floor(x * cols / width));
      }));
      const cells = Array.from({ length: lanes }, (_, cell) => cell).filter(cell => !occupied.has(cell));
      const rank = states.slice(0, index).filter(lane => !lane.tracked).length;
      // Existing tracks can share a search cell in the wrong orientation. Cycle
      // remaining cells so those tracks cannot permanently hide a missing code.
      const offset = Math.floor(searchRound / (columns === rows ? 2 : 4));
      const cell = cells.length ? cells[(rank + offset) % cells.length] : index;
      const col = cell % cols, row = Math.floor(cell / cols);
      const overlapX = searchRound % 2 === 0 ? Math.ceil(width / cols * 0.14) : 0;
      const overlapY = searchRound % 2 === 0 ? Math.ceil(height / lines * 0.14) : 0;
      const x = Math.max(0, Math.floor(col * width / cols) - overlapX);
      const y = Math.max(0, Math.floor(row * height / lines) - overlapY);
      return { x, y, width: Math.min(width, Math.ceil((col + 1) * width / cols) + overlapX) - x,
        height: Math.min(height, Math.ceil((row + 1) * height / lines) + overlapY) - y };
    }
    function searchRegion(index, width, height, detail) {
      if (lanes > 2) return gridRegion(index, width, height, detail);
      const other = lanes === 2 ? states[1 - index].tracked : null;
      const lane = states[index];
      // Once one symbol is tracked, a detailed search of the opposite half is
      // more useful than finding that same symbol again in the entire image.
      // Alternate detailed half/full searches: several finder patterns can
      // confuse a single-QR decoder even when the complete image is sharp.
      if (lanes === 1 || (detail && !other && (lane.forceDetail || lane.searches % 8 === 7))) {
        return { x: 0, y: 0, width, height };
      }
      // Try both orientations. A rotated phone must not permanently hide one lane.
      const horizontal = (explicitGrid ? columns >= rows : width >= height) !== (Math.floor(lane.searches / 2) % 2 === 1);
      const span = horizontal ? width : height;
      const center = other ? horizontal ? (other.left + other.right) / 2 : (other.top + other.bottom) / 2 : null;
      const farSide = center === null ? index === 1 : center < span / 2;
      // A generous seam helps off-center codes; the next probe uses a clean split
      // so a neighbor's partial finder patterns cannot poison the single-QR decoder.
      const overlap = lane.searches % 2 === 0 ? Math.ceil(span * 0.14) : 0;
      const start = farSide ? Math.max(0, Math.floor(span / 2) - overlap) : 0;
      const end = farSide ? span : Math.min(span, Math.ceil(span / 2) + overlap);
      return horizontal ? { x: start, y: 0, width: end - start, height }
        : { x: 0, y: start, width, height: end - start };
    }
    function trackedEdge(lane, region) {
      if (lane.trackedMisses || lane.stableHits < 2 || !lane.version) return TRACK_EDGE;
      const modules = 17 + 4 * lane.version;
      const pitch = Math.min(lane.tracked.right - lane.tracked.left,
        lane.tracked.bottom - lane.tracked.top) / modules;
      // Keep five samples/module normally; only a stable, expensive crop tries four.
      // A miss immediately restores the full tracked resolution before reacquisition.
      const samples = lane.stableHits >= 5 && lane.latency > 45 ? 4 : 5;
      return Math.min(TRACK_EDGE, Math.max(240,
        Math.ceil(Math.max(region.width, region.height) * Math.min(1, samples / pitch))));
    }
    function sameCrop(a, b) {
      return a.region.x === b.region.x && a.region.y === b.region.y
        && a.region.width === b.region.width && a.region.height === b.region.height
        && a.width === b.width && a.height === b.height
        && a.inversionAttempts === b.inversionAttempts;
    }
    function sizeSnapshot(width, height) {
      // Small changes in detected bounds must not repeatedly reallocate the
      // snapshot canvas. Only the valid captured rectangle below is sampled.
      const roundedWidth = Math.ceil(width / 64) * 64;
      const roundedHeight = Math.ceil(height / 64) * 64;
      if (snapshot.canvas.width < width || snapshot.canvas.width > roundedWidth * 1.5) snapshot.canvas.width = roundedWidth;
      if (snapshot.canvas.height < height || snapshot.canvas.height > roundedHeight * 1.5) snapshot.canvas.height = roundedHeight;
    }
    function prepare(video) {
      if (disposed || !video) return null;
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) return null;
      if (width !== sourceWidth || height !== sourceHeight) {
        clearTracking(); sourceWidth = width; sourceHeight = height;
      }
      const started = now();
      const frames = states.map((lane, index) => {
        const tracked = lane.tracked !== null;
        const detail = !tracked && (lane.forceDetail || lane.searches % 4 === 3);
        const region = tracked ? trackedRegion(lane, width, height) : searchRegion(index, width, height, detail);
        if (!tracked) lane.searches++;
        const edge = tracked ? trackedEdge(lane, region) : detail ? DETAIL_EDGE : SEARCH_EDGE;
        const ratio = Math.min(1, edge / Math.max(region.width, region.height));
        const pixelWidth = Math.max(1, Math.round(region.width * ratio));
        const pixelHeight = Math.max(1, Math.round(region.height * ratio));
        let inversionAttempts = 'dontInvert';
        if (tracked && lane.preferBoth && ++lane.polarityProbe % 8 !== 0) inversionAttempts = 'attemptBoth';
        if (lane.misses > 0 && (tracked || detail || lane.misses % 3 === 2)) inversionAttempts = 'attemptBoth';
        return { index, tracked, region, width: pixelWidth, height: pixelHeight, inversionAttempts, sourceIndex: index };
      });
      if (frames.some(frame => !frame.tracked)) searchRound++;
      let image = video;
      let captureX = 0, captureY = 0;
      if (lanes > 1) {
        // Freeze ONE source frame, at 1:1 resolution, covering the union of the
        // planned crops. Stable tracks do not need a full-frame extra copy.
        captureX = Math.min(...frames.map(frame => frame.region.x));
        captureY = Math.min(...frames.map(frame => frame.region.y));
        const captureWidth = Math.max(...frames.map(frame => frame.region.x + frame.region.width)) - captureX;
        const captureHeight = Math.max(...frames.map(frame => frame.region.y + frame.region.height)) - captureY;
        sizeSnapshot(captureWidth, captureHeight);
        snapshot.context.drawImage(video, captureX, captureY, captureWidth, captureHeight, 0, 0, captureWidth, captureHeight);
        image = snapshot.canvas;
      }
      for (const frame of frames) {
        const previous = frames.find(candidate => candidate.index < frame.index && sameCrop(candidate, frame));
        if (previous) {
          // Full-frame reacquisition can give both lanes the identical crop.
          // Share that one pixel buffer and decode it once, not twice.
          frame.sourceIndex = previous.sourceIndex;
          frame.data = previous.data;
          continue;
        }
        const { canvas, context } = surfaces[frame.index];
        if (canvas.width !== frame.width) canvas.width = frame.width;
        if (canvas.height !== frame.height) canvas.height = frame.height;
        context.drawImage(image, frame.region.x - captureX, frame.region.y - captureY,
          frame.region.width, frame.region.height, 0, 0, frame.width, frame.height);
        frame.data = context.getImageData(0, 0, frame.width, frame.height).data;
      }
      return { started, width, height, frames, generation };
    }
    function decodeSync(frames) {
      const answers = [];
      for (const frame of frames) {
        if (frame.sourceIndex !== frame.index) { answers.push(answers[frame.sourceIndex]); continue; }
        // Successful transfer detached this buffer. On worker failure only, read
        // the SAME frozen crop again; never capture a later video frame as fallback.
        if (frame.data.byteLength !== frame.width * frame.height * 4) {
          frame.data = surfaces[frame.index].context.getImageData(0, 0, frame.width, frame.height).data;
        }
        const started = now();
        const decoded = decode(frame.data, frame.width, frame.height, { inversionAttempts: frame.inversionAttempts });
        answers.push({ decoded, decodeMs: Math.max(0, now() - started) });
      }
      return answers;
    }
    function finish(batch, answers, decoder) {
      if (disposed || batch.generation !== generation) return empty();
      const found = [];
      const results = [];
      // Existing tracks take precedence if the searching lane sees the same QR.
      const ordered = [...batch.frames].sort((a, b) => Number(b.tracked) - Number(a.tracked));
      for (const frame of ordered) {
        const lane = states[frame.index];
        const answer = answers[frame.index];
        let decoded = answer?.decoded;
        // A false finder-pattern match can decode to an empty payload. It must
        // remain a miss rather than a useful optical read or a new track.
        if (decoded && !decoded.bytes?.length) decoded = null;
        const location = decoded ? mapLocation(decoded.location, frame.region, frame.width, frame.height) : null;
        const position = decoded ? bounds(location, batch.width, batch.height) : null;
        if (decoded && found.some(item => samePosition(item, position))) decoded = null;
        lane.latency = lane.latency ? lane.latency * 0.8 + (answer?.decodeMs || 0) * 0.2 : answer?.decodeMs || 0;
        if (decoded) {
          const result = { ...decoded, location };
          results.push(result);
          found.push(position);
          lane.tracked = position;
          lane.trackedMisses = lane.misses = lane.searches = 0;
          lane.forceDetail = false;
          lane.stableHits++;
          lane.version = Number.isInteger(decoded.version) && decoded.version >= 1 && decoded.version <= 40 ? decoded.version : 0;
          const preferBoth = frame.inversionAttempts === 'attemptBoth';
          if (preferBoth !== lane.preferBoth) lane.polarityProbe = 0;
          lane.preferBoth = preferBoth;
        } else {
          lane.misses++;
          lane.stableHits = 0;
          lane.forceDetail = false;
          if (frame.tracked && ++lane.trackedMisses >= 2) {
            lane.tracked = null; lane.trackedMisses = 0; lane.forceDetail = true;
          }
        }
      }
      const largest = batch.frames.reduce((a, b) => a.width * a.height >= b.width * b.height ? a : b);
      return { result: results[0] || null, results, decodeMs: Math.max(0, now() - batch.started),
        region: batch.frames.every(frame => frame.tracked) ? 'tracked' : 'search',
        pixels: { width: largest.width, height: largest.height },
        pixelCount: batch.frames.reduce((sum, frame) => sum + (frame.sourceIndex === frame.index ? frame.width * frame.height : 0), 0),
        attempts: batch.frames.filter(frame => frame.sourceIndex === frame.index).length, decoder };
    }
    function stopWorker(cancelled = false) {
      if (worker) { worker.terminate(); worker = null; }
      if (workerPending) {
        const pending = workerPending;
        workerPending = null;
        root.clearTimeout(pending.timer);
        pending.resolve({ cancelled });
      }
    }
    function failWorker() { workerFailed = true; stopWorker(); }
    function getWorker() {
      if (worker || workerFailed || !workerUrl || typeof root.Worker !== 'function') return worker;
      try {
        // Classic Workers enforce same-origin script URLs. The worker imports the
        // existing local qr-core bundle; no CDN, data upload, or text conversion.
        worker = new root.Worker(workerUrl);
        const target = worker;
        worker.onmessage = event => {
          const message = event.data;
          if (worker !== target || !workerPending || !message || message.id !== workerPending.id) return;
          if (!Array.isArray(message.answers) || message.answers.length !== workerPending.count) { failWorker(); return; }
          const pending = workerPending;
          workerPending = null;
          root.clearTimeout(pending.timer);
          pending.resolve({ answers: message.answers });
        };
        worker.onerror = event => { if (event.preventDefault) event.preventDefault(); if (worker === target) failWorker(); };
        worker.onmessageerror = () => { if (worker === target) failWorker(); };
      } catch { workerFailed = true; worker = null; }
      return worker;
    }
    function decodeAsync(frames) {
      const epoch = generation;
      const target = getWorker();
      if (!target) return Promise.resolve({ answers: decodeSync(frames), decoder: 'main' });
      return new Promise(resolve => {
        const id = ++workerSerial;
        const timer = root.setTimeout(failWorker, WORKER_TIMEOUT);
        workerPending = { id, count: frames.length, timer, resolve };
        try {
          // Transfer ownership instead of cloning megabytes of RGBA per scan.
          // The crop canvases stay unchanged until this bounded batch finishes,
          // so a worker failure can re-read them without retaining a pixel copy.
          const buffers = [...new Set(frames.map(frame => frame.data.buffer))];
          target.postMessage({ id, frames: frames.map(({ data, width, height, inversionAttempts }) => ({ data, width, height, inversionAttempts })) }, buffers);
        } catch { failWorker(); }
      }).then(answer => disposed || epoch !== generation ? { cancelled: true } : answer.cancelled ? answer : answer.answers
        ? { ...answer, decoder: 'worker' } : { answers: decodeSync(frames), decoder: 'main' });
    }
    function scan(video) {
      if (activeScan) return empty({ busy: true });
      const batch = prepare(video);
      return batch ? finish(batch, decodeSync(batch.frames), 'main') : empty();
    }
    function scanAsync(video) {
      if (activeScan) return Promise.resolve(empty({ busy: true }));
      const batch = prepare(video);
      if (!batch) return Promise.resolve(empty());
      const operation = decodeAsync(batch.frames).then(answer => answer.cancelled ? empty()
        : finish(batch, answer.answers, answer.decoder));
      activeScan = operation;
      return operation.finally(() => { if (activeScan === operation) activeScan = null; });
    }
    function reset() {
      generation++;
      stopWorker(true);
      activeScan = null;
      clearTracking(); sourceWidth = sourceHeight = 0;
      if (!disposed) {
        for (const surface of [...surfaces, snapshot].filter(Boolean)) {
          surface.context.clearRect(0, 0, surface.canvas.width, surface.canvas.height);
        }
      }
    }
    function setLanes(value) {
      if (value !== 1 && value !== 2) throw new TypeError('WGCamera supports one or two QR symbols.');
      if (disposed || (!explicitGrid && value === lanes)) return;
      lanes = value; columns = value; rows = 1; explicitGrid = false;
      reset(); ensureSurfaces();
    }
    function setGrid(nextColumns, nextRows) {
      if (!validGrid(nextColumns, nextRows)) throw new TypeError('WGCamera requires 1–5 columns and 1–4 rows.');
      if (disposed || (explicitGrid && columns === nextColumns && rows === nextRows)) return;
      columns = nextColumns; rows = nextRows; lanes = columns * rows; explicitGrid = true;
      reset(); ensureSurfaces();
    }
    function dispose() {
      if (disposed) return;
      reset(); disposed = true;
      for (const surface of [...surfaces, snapshot].filter(Boolean)) {
        if (surface.canvas.width !== 1) surface.canvas.width = 1;
        if (surface.canvas.height !== 1) surface.canvas.height = 1;
      }
    }
    return { scan, scanAsync, reset, dispose, setLanes, setGrid };
  }

  root.WGCamera = Object.freeze({ createScanner });
})(globalThis);
