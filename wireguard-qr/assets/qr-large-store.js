/* WGLargeStore — one resumable optical transfer in origin-private storage. */
(function (root) {
  'use strict';

  const DIRECTORY = 'wgqr-large-v4';
  const LOCK = 'wgqr-large-v4-store';
  const META = 'state.json';
  const FINAL = 'received.zip';
  const PROBE = 'write-probe';
  const SEGMENT_BYTES = 2 * 1024 * 1024;
  const MAX_BYTES = 200 * 1024 * 1024;
  const COPY_BYTES = 256 * 1024;
  const MAX_METADATA_BYTES = 16384;
  const encoder = new TextEncoder();
  const HEX = /^[0-9a-f]{64}$/;
  const isBytes = value => ArrayBuffer.isView(value)
    && Object.prototype.toString.call(value) === '[object Uint8Array]';
  const segmentName = index => `segment-${String(index).padStart(3, '0')}.bin`;
  const segmentSize = (descriptor, index) => Math.min(SEGMENT_BYTES, descriptor.size - index * SEGMENT_BYTES);

  function fail(code, message, abort = false) {
    const error = new Error(message);
    error.name = abort ? 'AbortError' : 'LargeStoreError';
    error.code = code;
    return error;
  }
  function storageError(error) {
    if (typeof error?.code === 'string' && error.code.startsWith('STORE_')) return error;
    if (error?.name === 'QuotaExceededError') return fail('STORE_QUOTA', 'Brakuje miejsca na lokalny zapis. Zachowany postęp można wznowić po zwolnieniu miejsca.');
    if (error?.name === 'NotSupportedError') return fail('STORE_UNSUPPORTED', 'Ta przeglądarka nie obsługuje potrzebnego zapisu OPFS. Duży transfer nie został rozpoczęty.');
    return fail('STORE_IO', 'Nie udało się odczytać lub zapisać lokalnego transferu. Zachowane dane nie zostały zastąpione inną sesją.');
  }
  function exactKeys(value, keys) {
    return value && typeof value === 'object' && !Array.isArray(value)
      && Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
  }
  function descriptorOf(value) {
    const keys = ['version', 'id', 'name', 'size', 'segmentBytes', 'segmentCount'];
    if (!exactKeys(value, keys) || value.version !== 4 || typeof value.id !== 'string' || !HEX.test(value.id)
      || typeof value.name !== 'string' || !value.name || encoder.encode(value.name).length > 120
      || value.name !== value.name.trim() || value.name === '.' || value.name === '..'
      || /[\u0000-\u001f\u007f-\u009f/\\]/.test(value.name)
      || new TextDecoder().decode(encoder.encode(value.name)) !== value.name
      || !Number.isSafeInteger(value.size) || value.size < 1 || value.size > MAX_BYTES
      || value.segmentBytes !== SEGMENT_BYTES || !Number.isSafeInteger(value.segmentCount)
      || value.segmentCount !== Math.ceil(value.size / SEGMENT_BYTES) || value.segmentCount > 100) {
      throw fail('STORE_INVALID_DESCRIPTOR', 'Nieprawidłowy opis dużego transferu.');
    }
    return Object.fromEntries(keys.map(key => [key, value[key]]));
  }
  function metadataOf(value) {
    if (!exactKeys(value, ['format', 'descriptor', 'digests', 'complete']) || value.format !== 1
      || !Array.isArray(value.digests) || typeof value.complete !== 'boolean') throw fail('STORE_CORRUPT', 'Uszkodzony opis lokalnego transferu.');
    const descriptor = descriptorOf(value.descriptor);
    if (value.digests.length !== descriptor.segmentCount
      || value.digests.some(digest => digest !== null && (typeof digest !== 'string' || !HEX.test(digest)))
      || (value.complete && value.digests.some(digest => digest === null))) throw fail('STORE_CORRUPT', 'Uszkodzony opis lokalnego transferu.');
    return { format: 1, descriptor, digests: [...value.digests], complete: value.complete };
  }
  async function digest(bytes) {
    const result = new Uint8Array(await root.crypto.subtle.digest('SHA-256', bytes));
    return Array.from(result, value => value.toString(16).padStart(2, '0')).join('');
  }
  async function takeLock() {
    return new Promise((resolve, reject) => {
      let release;
      const held = new Promise(done => { release = done; });
      const lifetime = Promise.resolve(root.navigator.locks.request(LOCK, { mode: 'exclusive', ifAvailable: true }, async lock => {
        if (!lock) { reject(fail('STORE_BUSY', 'Ten lokalny transfer jest otwarty w innej karcie. Zamknij ją przed wznowieniem.')); return; }
        resolve(async () => { release(); await lifetime; });
        await held;
      }));
      lifetime.catch(error => reject(storageError(error)));
    });
  }

  /**
   * open holds one origin-wide Web Lock until dispose. Only one operation is
   * accepted at a time (STORE_BUSY); there is no queue of 2 MiB inputs.
   * putSegment borrows its input until the returned promise settles. A caller
   * may wipe it after await. Completed bits follow segment AND metadata close.
   * clear explicitly removes this store; dispose cancels work without deletion.
   * Progress: { phase, completedBytes, totalBytes, segmentIndex, segmentCount }.
   * A corrupt metadata file blocks begin but leaves clear available to the UI.
   * WGLarge verifies the descriptor/root id; this layer verifies the segment
   * hashes and the assembled file against the committed segment hash list.
   */
  async function open({ onProgress } = {}) {
    if (onProgress !== undefined && typeof onProgress !== 'function') throw new TypeError('Nieprawidłowa funkcja postępu.');
    if (typeof root.navigator?.storage?.getDirectory !== 'function'
      || typeof root.navigator?.locks?.request !== 'function' || typeof root.crypto?.subtle?.digest !== 'function') {
      throw fail('STORE_UNSUPPORTED', 'Ta przeglądarka nie obsługuje trwałego zapisu dużych transferów (OPFS, Web Locks i SHA-256). Użyj aktualnej przeglądarki z tymi funkcjami.');
    }
    const releaseLock = await takeLock();
    let directory;
    let record = null;
    let corrupt = false;
    let disposed = false;
    let generation = 0;
    let pending = null;
    let writable = null;
    let clearing = null;
    let disposal = null;
    let persistent = null;

    const snapshot = () => {
      const descriptor = record ? Object.freeze({ ...record.descriptor }) : null;
      const digests = record ? [...record.digests] : [];
      return Object.freeze({ descriptor, completed: Object.freeze(digests.map(value => value !== null)),
        digests: Object.freeze(digests), savedBytes: descriptor ? digests.reduce((sum, value, index) => sum + (value ? segmentSize(descriptor, index) : 0), 0) : 0,
        complete: Boolean(record?.complete), corrupt });
    };
    function check(token) {
      if (disposed || token !== generation) throw fail('STORE_CANCELLED', 'Operacja lokalnego transferu została przerwana.', true);
    }
    function progress(callback, phase, completedBytes, totalBytes, segmentIndex = null) {
      if (typeof callback !== 'function') return;
      try { callback(Object.freeze({ phase, completedBytes, totalBytes, segmentIndex,
        segmentCount: record?.descriptor.segmentCount || 0 })); } catch { /* Display callbacks cannot commit or corrupt storage. */ }
    }
    async function abortWritable() {
      const stream = writable;
      if (!stream) return;
      try { await stream.abort(); } catch { /* A close may already have settled. */ }
    }
    async function write(name, token, body) {
      check(token);
      const handle = await directory.getFileHandle(name, { create: true });
      check(token);
      if (typeof handle.createWritable !== 'function') throw fail('STORE_UNSUPPORTED', 'Ta przeglądarka nie udostępnia zapisu OPFS createWritable. Duży transfer nie został rozpoczęty.');
      const stream = await handle.createWritable({ keepExistingData: false });
      writable = stream;
      try {
        check(token);
        await body(stream);
        check(token);
        await stream.close();
        check(token);
      } catch (error) {
        try { await stream.abort(); } catch { /* Preserve the original error. */ }
        throw error;
      } finally { if (writable === stream) writable = null; }
      return handle;
    }
    async function persist(next, token) {
      const bytes = encoder.encode(JSON.stringify(next));
      try { await write(META, token, stream => stream.write(bytes)); }
      finally { bytes.fill(0); }
      check(token);
      record = next;
    }
    async function getFile(name, token) {
      check(token);
      const handle = await directory.getFileHandle(name);
      check(token);
      const file = await handle.getFile();
      check(token);
      return file;
    }
    async function bytesMatch(file, offset, length, expected, token) {
      check(token);
      const bytes = new Uint8Array(await file.slice(offset, offset + length).arrayBuffer());
      try {
        check(token);
        if (bytes.length !== length) return false;
        const actual = await digest(bytes);
        check(token);
        return actual === expected;
      } finally { bytes.fill(0); }
    }
    async function segmentMatches(index, expected, token) {
      try {
        const file = await getFile(segmentName(index), token);
        const length = segmentSize(record.descriptor, index);
        return file.size === length && await bytesMatch(file, 0, length, expected, token);
      } catch (error) { if (error?.name === 'NotFoundError') return false; throw error; }
    }
    async function finalMatches(token, callback) {
      let file;
      try { file = await getFile(FINAL, token); }
      catch (error) { if (error?.name === 'NotFoundError') return null; throw error; }
      if (file.size !== record.descriptor.size) return null;
      for (let index = 0; index < record.descriptor.segmentCount; index++) {
        if (!record.digests[index] || !await bytesMatch(file, index * SEGMENT_BYTES,
          segmentSize(record.descriptor, index), record.digests[index], token)) return null;
        progress(callback, 'verify-file', Math.min(file.size, (index + 1) * SEGMENT_BYTES), file.size, index);
        check(token);
      }
      return file;
    }
    async function revalidate(token) {
      if (!record) return;
      const next = { ...record, digests: [...record.digests] };
      let changed = false, checkedBytes = 0;
      const total = snapshot().savedBytes;
      for (let index = 0; index < next.digests.length; index++) {
        if (!next.digests[index]) continue;
        if (!await segmentMatches(index, next.digests[index], token)) {
          next.digests[index] = null; next.complete = false; changed = true;
        }
        checkedBytes += segmentSize(next.descriptor, index);
        progress(onProgress, 'verify', checkedBytes, total, index);
        check(token);
      }
      if (next.complete && !await finalMatches(token, onProgress)) { next.complete = false; changed = true; }
      if (changed) {
        // Invalid data must never remain visible as complete if metadata I/O fails.
        record = next;
        await persist(next, token);
      }
    }
    function run(body) {
      if (disposed) return Promise.reject(fail('STORE_CANCELLED', 'Magazyn został zamknięty.', true));
      if (pending) return Promise.reject(fail('STORE_BUSY', 'Trwa poprzednia operacja lokalnego transferu.'));
      const token = generation;
      const operation = Promise.resolve().then(() => { check(token); return body(token); })
        .catch(error => { check(token); throw storageError(error); })
        .finally(() => { if (pending === operation) pending = null; });
      pending = operation;
      return operation;
    }
    function requireSession() {
      if (corrupt) throw fail('STORE_CORRUPT', 'Lokalny opis transferu jest uszkodzony. Usuń go jawnie przed rozpoczęciem nowego odbioru.');
      if (!record) throw fail('STORE_NOT_STARTED', 'Najpierw rozpocznij lokalny transfer.');
    }
    async function invalidate(index, token) {
      const next = { ...record, digests: [...record.digests], complete: false };
      if (index !== null) next.digests[index] = null;
      record = next;
      await persist(next, token);
    }
    async function checkQuota(descriptor, token) {
      if (record?.complete) return;
      if (typeof root.navigator.storage.estimate !== 'function') return;
      let estimate;
      try { estimate = await root.navigator.storage.estimate(); } catch { return; }
      check(token);
      if (!Number.isFinite(estimate?.quota) || estimate.quota < 0
        || !Number.isFinite(estimate?.usage) || estimate.usage < 0) return;
      let existingOutput = 0;
      if (record) {
        try { existingOutput = Math.min(descriptor.size, (await getFile(FINAL, token)).size); }
        catch (error) { if (error?.name !== 'NotFoundError') throw error; }
      }
      const needed = Math.max(0, descriptor.size * 2 - snapshot().savedBytes - existingOutput) + SEGMENT_BYTES;
      if (estimate.quota - estimate.usage < needed) throw fail('STORE_QUOTA', 'Za mało miejsca na segmenty i złożony plik. Potrzebne jest miejsce do około dwukrotnego rozmiaru pliku oraz 2 MiB zapasu.');
    }
    const store = {
      get state() { return snapshot(); },
      get persistent() { return persistent; },
      begin(value) {
        return run(async token => {
          const descriptor = descriptorOf(value);
          if (corrupt) requireSession();
          if (record) {
            if (Object.keys(descriptor).some(key => descriptor[key] !== record.descriptor[key])) {
              throw fail('STORE_SESSION_CONFLICT', 'Zachowany jest inny transfer. Wznów go albo usuń jawnie przed rozpoczęciem nowego.');
            }
            await revalidate(token);
            await checkQuota(descriptor, token);
          } else {
            await checkQuota(descriptor, token);
            await persist({ format: 1, descriptor, digests: Array(descriptor.segmentCount).fill(null), complete: false }, token);
          }
          return snapshot();
        });
      },
      putSegment(index, bytes, digestHex) {
        return run(async token => {
          requireSession();
          if (!Number.isSafeInteger(index) || index < 0 || index >= record.descriptor.segmentCount
            || !isBytes(bytes) || bytes.length !== segmentSize(record.descriptor, index)
            || typeof digestHex !== 'string' || !HEX.test(digestHex)) throw fail('STORE_INVALID_SEGMENT', 'Nieprawidłowy segment dużego transferu.');
          if (record.digests[index] && record.digests[index] !== digestHex) throw fail('STORE_SEGMENT_CONFLICT', 'Ten segment ma inną sumę niż zachowany fragment.');
          if (await digest(bytes) !== digestHex) throw fail('STORE_DIGEST_MISMATCH', 'Suma SHA-256 odebranego segmentu jest niezgodna.');
          check(token);
          if (record.digests[index]) {
            if (await segmentMatches(index, digestHex, token)) return snapshot();
            await invalidate(index, token);
          }
          await write(segmentName(index), token, async stream => {
            for (let offset = 0; offset < bytes.length; offset += COPY_BYTES) {
              check(token);
              await stream.write(bytes.subarray(offset, Math.min(bytes.length, offset + COPY_BYTES)));
            }
          });
          if (!await segmentMatches(index, digestHex, token)) throw fail('STORE_DIGEST_MISMATCH', 'Nie udało się potwierdzić zapisanego segmentu.');
          const next = { ...record, digests: [...record.digests], complete: false };
          next.digests[index] = digestHex;
          await persist(next, token);
          progress(onProgress, 'saved', snapshot().savedBytes, record.descriptor.size, index);
          check(token);
          return snapshot();
        });
      },
      finish({ onProgress: callback = onProgress } = {}) {
        return run(async token => {
          requireSession();
          if (callback !== undefined && typeof callback !== 'function') throw new TypeError('Nieprawidłowa funkcja postępu.');
          if (record.digests.some(value => !value)) throw fail('STORE_INCOMPLETE', 'Brakuje segmentów do złożenia pliku.');
          if (record.complete) {
            const existing = await finalMatches(token, callback);
            if (existing) return existing;
            await invalidate(null, token);
          }
          // Remove only a derived, incomplete output. All source segments remain
          // recoverable, and replacement does not need a third full-file copy.
          try { await directory.removeEntry(FINAL); }
          catch (error) { if (error?.name !== 'NotFoundError') throw error; }
          check(token);
          let invalidIndex = null;
          try {
            await write(FINAL, token, async stream => {
              let copied = 0;
              for (let index = 0; index < record.descriptor.segmentCount; index++) {
                let file;
                try { file = await getFile(segmentName(index), token); }
                catch (error) { if (error?.name === 'NotFoundError') invalidIndex = index; throw error; }
                const length = segmentSize(record.descriptor, index);
                if (file.size !== length) { invalidIndex = index; throw fail('STORE_DIGEST_MISMATCH', 'Zapisany segment ma nieprawidłowy rozmiar.'); }
                const bytes = new Uint8Array(await file.slice(0, length).arrayBuffer());
                try {
                  check(token);
                  if (bytes.length !== length || await digest(bytes) !== record.digests[index]) {
                    invalidIndex = index; throw fail('STORE_DIGEST_MISMATCH', 'Zapisany segment jest uszkodzony; trzeba odebrać go ponownie.');
                  }
                  for (let offset = 0; offset < bytes.length; offset += COPY_BYTES) {
                    check(token);
                    const part = bytes.subarray(offset, Math.min(bytes.length, offset + COPY_BYTES));
                    await stream.write(part);
                    copied += part.length;
                    progress(callback, 'assemble', copied, record.descriptor.size, index);
                    check(token);
                  }
                } finally { bytes.fill(0); }
              }
            });
          } catch (error) {
            check(token);
            if (invalidIndex !== null) await invalidate(invalidIndex, token);
            throw error;
          }
          const file = await finalMatches(token, callback);
          if (!file) throw fail('STORE_DIGEST_MISMATCH', 'Scalony plik nie przeszedł sprawdzenia segmentów.');
          await persist({ ...record, complete: true }, token);
          return file;
        });
      },
      file() {
        return run(async token => {
          requireSession();
          if (!record.complete) throw fail('STORE_INCOMPLETE', 'Plik nie został jeszcze złożony i sprawdzony.');
          const file = await finalMatches(token);
          if (!file) { await invalidate(null, token); throw fail('STORE_DIGEST_MISMATCH', 'Zapisany plik końcowy wymaga ponownego złożenia.'); }
          return file;
        });
      },
      clear() {
        if (disposed) return Promise.reject(fail('STORE_CANCELLED', 'Magazyn został zamknięty.', true));
        if (clearing) return clearing;
        const token = ++generation;
        const earlier = pending;
        // A failed deletion may already have removed some data. Do not offer a
        // stale complete snapshot or permit another session until clear succeeds.
        if (record) record = { ...record, digests: record.digests.map(() => null), complete: false };
        corrupt = true;
        const operation = (async () => {
          await abortWritable();
          if (earlier) await earlier.catch(() => {});
          check(token);
          const names = [];
          for await (const [name] of directory.entries()) names.push(name);
          // The session descriptor is the last thing removed, so interrupted
          // deletion cannot silently make surviving segments a different session.
          names.sort((a, b) => Number(a === META) - Number(b === META));
          for (const name of names) { check(token); await directory.removeEntry(name, { recursive: true }); }
          check(token);
          record = null; corrupt = false;
          return snapshot();
        })().catch(error => { throw storageError(error); }).finally(() => {
          if (pending === operation) pending = null;
          if (clearing === operation) clearing = null;
        });
        pending = clearing = operation;
        return operation;
      },
      dispose() {
        if (disposal) return disposal;
        disposed = true; generation++;
        const earlier = pending;
        disposal = (async () => {
          await abortWritable();
          if (earlier) await earlier.catch(() => {});
          await releaseLock();
        })();
        return disposal;
      }
    };
    try {
      const origin = await root.navigator.storage.getDirectory();
      directory = await origin.getDirectoryHandle(DIRECTORY, { create: true });
      if (typeof root.navigator.storage.persisted === 'function') {
        try { persistent = Boolean(await root.navigator.storage.persisted()); } catch { /* Informational only; do not request persistence. */ }
      }
      // Check the actual writable implementation before accepting any payload.
      await write(PROBE, generation, stream => stream.write(new Uint8Array([0])));
      await directory.removeEntry(PROBE);
      let file;
      try { file = await getFile(META, generation); }
      catch (error) { if (error?.name !== 'NotFoundError') throw error; }
      if (file) {
        if (file.size < 1 || file.size > MAX_METADATA_BYTES) corrupt = true;
        else {
          const text = await file.text();
          try { record = metadataOf(JSON.parse(text)); }
          catch { corrupt = true; record = null; }
        }
      } else {
        for await (const _entry of directory.entries()) { corrupt = true; break; }
      }
      await run(token => revalidate(token));
      return store;
    } catch (error) {
      await store.dispose();
      throw storageError(error);
    }
  }
  root.WGLargeStore = Object.freeze({ open, SEGMENT_BYTES, MAX_BYTES });
})(typeof window !== 'undefined' ? window : globalThis);
