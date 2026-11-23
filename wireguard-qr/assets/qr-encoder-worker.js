/* Local QR matrix encoder. Payloads remain bytes and are cleared after each reply. */
'use strict';
importScripts('qr-core.js?v=3');

self.onmessage = event => {
  const request = event.data;
  const frames = Array.isArray(request?.frames) ? request.frames : [];
  const isBytes = value => ArrayBuffer.isView(value)
    && Object.prototype.toString.call(value) === '[object Uint8Array]';
  const matrices = [];
  try {
    if (!request || !Number.isSafeInteger(request.id) || request.id < 1 || frames.length < 1 || frames.length > 20
      || frames.some(frame => !isBytes(frame?.bytes) || !frame.bytes.length || frame.bytes.length > 2953
        || !['M', 'L'].includes(frame.errorCorrectionLevel))) throw new Error('invalid');
    for (const frame of frames) {
      matrices.push(self.WGQR.encodeBytes(frame.bytes, { errorCorrectionLevel: frame.errorCorrectionLevel }));
    }
    self.postMessage({ id: request.id, matrices }, matrices.map(matrix => matrix.data.buffer));
  } catch {
    // Do not return payloads or exception text. The caller retains a safe retry copy.
    if (Number.isSafeInteger(request?.id)) {
      try { self.postMessage({ id: request.id, failed: true }); } catch { /* Caller will time out. */ }
    }
  } finally {
    for (const frame of frames) if (isBytes(frame?.bytes) && frame.bytes.byteLength) frame.bytes.fill(0);
    // Successful transfer detaches these buffers. Clear any that could not be sent.
    for (const matrix of matrices) if (matrix.data.byteLength) matrix.data.fill(0);
  }
};
