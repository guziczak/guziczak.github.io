/* WGEncoder — bounded, byte-preserving QR matrix preparation in a local Worker. */
(function (root) {
  'use strict';
  const isBytes = value => ArrayBuffer.isView(value)
    && Object.prototype.toString.call(value) === '[object Uint8Array]';
  function failure(code, message, abort = false) {
    const error = new Error(message);
    error.name = abort ? 'AbortError' : 'QREncoderError';
    error.code = code;
    return error;
  }
  function wipeMatrices(matrices) {
    if (!Array.isArray(matrices)) return;
    for (const matrix of matrices) {
      if (isBytes(matrix?.data) && matrix.data.byteLength) matrix.data.fill(0);
    }
  }
  function validatedMatrix(matrix, level) {
    const size = matrix?.size;
    const version = (size - 17) / 4;
    if (!Number.isInteger(size) || size < 21 || size > 177 || !Number.isInteger(version)
      || !isBytes(matrix.data) || matrix.data.length !== size * size || matrix.level !== level
      || (matrix.version !== undefined && matrix.version !== version)) {
      throw failure('ENCODER_INVALID_MATRIX', 'Nieprawidłowa matryca kodu QR.');
    }
    for (const value of matrix.data) {
      if (value !== 0 && value !== 1) throw failure('ENCODER_INVALID_MATRIX', 'Nieprawidłowa matryca kodu QR.');
    }
    return { size, data: matrix.data, level, version };
  }

  /**
   * encodeBatch accepts one to twenty { bytes: Uint8Array, errorCorrectionLevel?: 'M'|'L' }
   * items and resolves to core-compatible matrices in the same order. Inputs are
   * copied synchronously before this method returns; callers retain their buffers
   * and may immediately overwrite them. Internal copies are cleared on completion,
   * failure, reset and disposal. Returned matrix buffers belong to the caller.
   *
   * Only one batch can be pending (ENCODER_BUSY); there is no hidden work queue.
   * Worker failures retry the retained bytes with the supplied synchronous encoder.
   * reset/dispose reject pending work with AbortError; reset permits another batch.
   */
  function create({ encode, workerUrl = null, timeoutMs = 3000 } = {}) {
    if (typeof encode !== 'function' || (workerUrl !== null && typeof workerUrl !== 'string')
      || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) {
      throw new TypeError('Nieprawidłowe ustawienia kodowania QR.');
    }
    let worker = null;
    let workerFailed = false;
    let pending = null;
    let serial = 0;
    let disposed = false;

    function clearInputs(job) {
      for (const item of job.items) item.bytes.fill(0);
      job.items = [];
      if (job.timer !== null) root.clearTimeout(job.timer);
      job.timer = null;
    }
    function stopWorker() {
      const target = worker;
      worker = null;
      if (target) {
        try { target.terminate(); } catch { /* Already stopped. */ }
      }
    }
    function settle(job, matrices, error) {
      if (pending !== job) { wipeMatrices(matrices); return; }
      pending = null;
      clearInputs(job);
      if (error) job.reject(error);
      else job.resolve(matrices);
    }
    function fallback(job) {
      if (pending !== job || job.fallback) return;
      job.fallback = true;
      if (job.timer !== null) root.clearTimeout(job.timer);
      job.timer = null;
      // A microtask lets an immediate reset invalidate the batch before the
      // synchronous fallback begins. It never schedules a second batch.
      Promise.resolve().then(() => {
        if (pending !== job) return;
        const matrices = [];
        try {
          for (const item of job.items) {
            const matrix = encode(item.bytes, { errorCorrectionLevel: item.errorCorrectionLevel });
            matrices.push(matrix);
            if (pending !== job) { wipeMatrices(matrices); return; }
            matrices[matrices.length - 1] = validatedMatrix(matrix, item.errorCorrectionLevel);
          }
          settle(job, matrices);
        } catch (error) {
          wipeMatrices(matrices);
          settle(job, null, error);
        }
      });
    }
    function failWorker(target) {
      if (worker !== target) return;
      workerFailed = true;
      stopWorker();
      if (pending) fallback(pending);
    }
    function getWorker() {
      if (worker || workerFailed || !workerUrl || typeof root.Worker !== 'function') return worker;
      try {
        const target = new root.Worker(workerUrl);
        worker = target;
        target.onmessage = event => {
          const response = event.data;
          const job = pending;
          if (worker !== target || !job || response?.id !== job.id) {
            wipeMatrices(response?.matrices);
            return;
          }
          let matrices;
          try {
            if (response.failed || !Array.isArray(response.matrices) || response.matrices.length !== job.items.length) {
              throw failure('ENCODER_INVALID_MATRIX', 'Nieprawidłowy wynik kodowania QR.');
            }
            matrices = response.matrices.map((matrix, index) => validatedMatrix(matrix, job.items[index].errorCorrectionLevel));
          } catch {
            wipeMatrices(response.matrices);
            failWorker(target);
            return;
          }
          settle(job, matrices);
        };
        target.onerror = event => {
          event.preventDefault?.();
          failWorker(target);
        };
        target.onmessageerror = () => failWorker(target);
      } catch {
        workerFailed = true;
        stopWorker();
      }
      return worker;
    }
    function encodeBatch(batch) {
      if (disposed) return Promise.reject(failure('ENCODER_DISPOSED', 'Kodowanie QR zostało zakończone.', true));
      if (pending) return Promise.reject(failure('ENCODER_BUSY', 'Poprzedni układ kodów jest jeszcze przygotowywany.'));
      const items = [];
      try {
        if (!Array.isArray(batch) || batch.length < 1 || batch.length > 20) {
          throw failure('INVALID_INPUT', 'Oczekiwano od jednego do dwudziestu kodów QR.');
        }
        for (const item of batch) {
          if (!item || !isBytes(item.bytes)) throw failure('INVALID_INPUT', 'Oczekiwano tablicy bajtów Uint8Array.');
          if (!item.bytes.length) throw failure('EMPTY_INPUT', 'Kod QR wymaga niepustych danych.');
          const level = item.errorCorrectionLevel === undefined
            ? item.bytes.length <= 2331 ? 'M' : 'L' : item.errorCorrectionLevel;
          if (!['M', 'L'].includes(level)) throw failure('INVALID_OPTIONS', 'Nieprawidłowy poziom korekcji QR.');
          if (item.bytes.length > (level === 'M' ? 2331 : 2953)) throw failure('INPUT_TOO_LARGE', 'Za dużo danych dla kodu QR.');
          items.push({ bytes: new Uint8Array(item.bytes), errorCorrectionLevel: level });
        }
      } catch (error) {
        for (const item of items) item.bytes.fill(0);
        return Promise.reject(error);
      }
      return new Promise((resolve, reject) => {
        const job = { id: ++serial, items, resolve, reject, timer: null, fallback: false };
        pending = job;
        const target = getWorker();
        if (!target) { fallback(job); return; }
        job.timer = root.setTimeout(() => {
          if (pending === job) failWorker(target);
        }, timeoutMs);
        try {
          // The bounded clone preserves our input copies for a safe local retry.
          target.postMessage({ id: job.id, frames: items });
        } catch { failWorker(target); }
      });
    }
    function cancel(code) {
      const job = pending;
      pending = null;
      stopWorker();
      if (job) {
        clearInputs(job);
        job.reject(failure(code, 'Przygotowywanie kodów QR zostało przerwane.', true));
      }
    }
    return {
      encodeBatch,
      reset() { if (!disposed) cancel('ENCODER_RESET'); },
      dispose() { if (!disposed) { disposed = true; cancel('ENCODER_DISPOSED'); } }
    };
  }
  root.WGEncoder = Object.freeze({ create });
})(typeof window !== 'undefined' ? window : globalThis);
