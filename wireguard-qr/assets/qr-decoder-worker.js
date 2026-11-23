/* Local, byte-preserving QR decoder. One caller-owned batch at a time. */
'use strict';
importScripts('qr-core.js?v=3');

self.onmessage = event => {
  const request = event.data;
  if (!request || !Number.isSafeInteger(request.id) || !Array.isArray(request.frames)
    || request.frames.length < 1 || request.frames.length > 20) return;
  try {
    const answers = [];
    for (const [index, frame] of request.frames.entries()) {
      const previous = request.frames.findIndex((candidate, other) => other < index
        && candidate.data === frame.data && candidate.width === frame.width
        && candidate.height === frame.height && candidate.inversionAttempts === frame.inversionAttempts);
      if (previous !== -1) { answers.push(answers[previous]); continue; }
      const started = performance.now();
      const decoded = self.WGQR.decodePixels(frame.data, frame.width, frame.height,
        { inversionAttempts: frame.inversionAttempts });
      answers.push({ decoded, decodeMs: Math.max(0, performance.now() - started) });
    }
    const buffers = [...new Set(answers.filter(answer => answer.decoded).map(answer => answer.decoded.bytes.buffer))];
    self.postMessage({ id: request.id, answers }, buffers);
  } catch {
    // No payloads or exception text leave the worker; the scanner retries locally.
    self.postMessage({ id: request.id, failed: true });
  }
};
