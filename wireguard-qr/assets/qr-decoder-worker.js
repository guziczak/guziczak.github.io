/* Local, byte-preserving QR decoder. One caller-owned batch at a time. */
'use strict';
importScripts('qr-core.js?v=3');

self.onmessage = event => {
  const request = event.data;
  if (!request || !Number.isSafeInteger(request.id) || !Array.isArray(request.frames)
    || request.frames.length < 1 || request.frames.length > 2) return;
  try {
    const answers = request.frames.map(frame => {
      const started = performance.now();
      const decoded = self.WGQR.decodePixels(frame.data, frame.width, frame.height,
        { inversionAttempts: frame.inversionAttempts });
      return { decoded, decodeMs: Math.max(0, performance.now() - started) };
    });
    const buffers = answers.filter(answer => answer.decoded).map(answer => answer.decoded.bytes.buffer);
    self.postMessage({ id: request.id, answers }, buffers);
  } catch {
    // No payloads or exception text leave the worker; the scanner retries locally.
    self.postMessage({ id: request.id, failed: true });
  }
};
