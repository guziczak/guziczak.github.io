/* WGCamera — local QR camera tracking with bounded, reusable pixel buffers. */
(function (root) {
  'use strict';

  const SEARCH_EDGE = 960;
  const DETAIL_EDGE = 1600;
  const TRACK_EDGE = 960;
  const CORNERS = ['topLeftCorner', 'topRightCorner', 'bottomRightCorner', 'bottomLeftCorner'];

  function createScanner({ decode } = {}) {
    if (typeof decode !== 'function') throw new TypeError('WGCamera requires a decode function.');
    let canvas = root.document.createElement('canvas');
    let context = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
    if (!context) throw new Error('Nie udało się przygotować obrazu z kamery.');
    let disposed = false;
    let tracked = null;
    let sourceWidth = 0;
    let sourceHeight = 0;
    let trackedMisses = 0;
    let misses = 0;
    let searches = 0;
    let forceDetail = false;
    let preferBoth = false;
    let polarityProbe = 0;

    const now = () => root.performance.now();
    const empty = () => ({ result: null, decodeMs: 0, region: 'search', pixels: { width: 0, height: 0 } });

    function clearTracking() {
      tracked = null;
      trackedMisses = 0;
      misses = 0;
      searches = 0;
      forceDetail = false;
      preferBoth = false;
      polarityProbe = 0;
    }

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

    function trackedRegion(width, height) {
      const span = Math.max(tracked.right - tracked.left, tracked.bottom - tracked.top);
      // Keep the QR quiet zone and room for hand movement. A first miss expands
      // the same tracked region once before a full-frame detail search resumes.
      const margin = Math.max(24, span * (trackedMisses ? 0.38 : 0.22));
      const x = Math.max(0, Math.floor(tracked.left - margin));
      const y = Math.max(0, Math.floor(tracked.top - margin));
      return {
        x, y,
        width: Math.min(width, Math.ceil(tracked.right + margin)) - x,
        height: Math.min(height, Math.ceil(tracked.bottom + margin)) - y
      };
    }

    function scan(video) {
      if (disposed || !video) return empty();
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) return empty();
      if (width !== sourceWidth || height !== sourceHeight) {
        clearTracking();
        sourceWidth = width;
        sourceHeight = height;
      }

      const started = now();
      const isTracked = tracked !== null;
      const regionName = isTracked ? 'tracked' : 'search';
      const region = isTracked ? trackedRegion(width, height) : { x: 0, y: 0, width, height };
      const detail = !isTracked && (forceDetail || searches % 4 === 3);
      if (!isTracked) searches++;
      const edge = isTracked ? TRACK_EDGE : detail ? DETAIL_EDGE : SEARCH_EDGE;
      const ratio = Math.min(1, edge / Math.max(region.width, region.height));
      const pixelWidth = Math.max(1, Math.round(region.width * ratio));
      const pixelHeight = Math.max(1, Math.round(region.height * ratio));
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      context.drawImage(video, region.x, region.y, region.width, region.height, 0, 0, pixelWidth, pixelHeight);
      const pixels = context.getImageData(0, 0, pixelWidth, pixelHeight);

      let inversionAttempts = 'dontInvert';
      if (isTracked && preferBoth) {
        // A stream of inverted codes can keep using its successful polarity;
        // occasionally probe normal polarity so ordinary codes regain the fast path.
        polarityProbe++;
        if (polarityProbe % 8 !== 0) inversionAttempts = 'attemptBoth';
      }
      if (misses > 0 && (isTracked || detail || misses % 3 === 2)) inversionAttempts = 'attemptBoth';
      const decoded = decode(pixels.data, pixelWidth, pixelHeight, { inversionAttempts });
      let result = null;
      if (decoded) {
        const location = mapLocation(decoded.location, region, pixelWidth, pixelHeight);
        result = { ...decoded, location };
        tracked = bounds(location, width, height);
        trackedMisses = 0;
        misses = 0;
        searches = 0;
        forceDetail = false;
        const nextPreferBoth = inversionAttempts === 'attemptBoth';
        if (nextPreferBoth !== preferBoth) polarityProbe = 0;
        preferBoth = nextPreferBoth;
      } else {
        misses++;
        forceDetail = false;
        if (isTracked) {
          trackedMisses++;
          if (trackedMisses >= 2) {
            tracked = null;
            trackedMisses = 0;
            forceDetail = true;
          }
        }
      }
      return {
        result,
        decodeMs: Math.max(0, now() - started),
        region: regionName,
        pixels: { width: pixelWidth, height: pixelHeight }
      };
    }

    function reset() {
      clearTracking();
      sourceWidth = sourceHeight = 0;
      if (!disposed && context) context.clearRect(0, 0, canvas.width, canvas.height);
    }

    function dispose() {
      if (disposed) return;
      reset();
      disposed = true;
      if (canvas.width !== 1) canvas.width = 1;
      if (canvas.height !== 1) canvas.height = 1;
      context = null;
      canvas = null;
    }

    return { scan, reset, dispose };
  }

  root.WGCamera = Object.freeze({ createScanner });
})(globalThis);
