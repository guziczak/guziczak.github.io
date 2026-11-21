import { deflateSync, Zip, ZipPassThrough } from 'fflate/browser';

export const MAX_FILES = 100;
export const MAX_INPUT_BYTES = 8 * 1024 * 1024;
// The caller enforces this transfer limit after compression, not before it.
export const MAX_OUTPUT_BYTES = 256 * 1024;
const MAX_NAME_BYTES = 240;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

function fail(code, message) {
  const error = new Error(message);
  error.name = 'ZipCoreError';
  error.code = code;
  return error;
}

function isBytes(value) {
  return ArrayBuffer.isView(value)
    && Object.prototype.toString.call(value) === '[object Uint8Array]';
}

export function isZip(bytes) {
  return isBytes(bytes) && bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b
    && ((bytes[2] === 3 && bytes[3] === 4)
      || (bytes[2] === 5 && bytes[3] === 6)
      || (bytes[2] === 7 && bytes[3] === 8));
}

function truncateUtf8(value, maximum) {
  let result = '';
  let length = 0;
  for (const character of value) {
    const bytes = encoder.encode(character).length;
    if (length + bytes > maximum) break;
    result += character;
    length += bytes;
  }
  return result;
}

function safeName(value) {
  let name = value.split(/[\\/]/).pop()
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069\ufeff]/g, '')
    .replace(/[<>:"|?*]/g, '_')
    .trim()
    .replace(/[.\s]+$/gu, '');
  // Preserve ordinary Unicode spelling, while replacing lone UTF-16 surrogates.
  name = decoder.decode(encoder.encode(name));
  name = truncateUtf8(name, MAX_NAME_BYTES).replace(/[.\s]+$/gu, '');
  return !name || reserved.test(name) ? 'plik.bin' : name;
}

function uniqueName(name, used) {
  // Also avoid collisions on common case-insensitive or normalization-insensitive filesystems.
  const key = value => value.normalize('NFC').toLowerCase();
  let candidate = name;
  const dot = name.lastIndexOf('.');
  const hasExtension = dot > 0 && encoder.encode(name.slice(dot)).length <= 80;
  const extension = hasExtension ? name.slice(dot) : '';
  const stem = hasExtension ? name.slice(0, dot) : name;
  for (let number = 2; used.has(key(candidate)); number++) {
    const suffix = ` (${number})`;
    const available = MAX_NAME_BYTES - encoder.encode(extension + suffix).length;
    candidate = truncateUtf8(stem, available) + suffix + extension;
  }
  used.add(key(candidate));
  return candidate;
}

function checkCurrent(isCurrent) {
  let current = false;
  try { current = Boolean(isCurrent()); } catch { /* A failed epoch check cancels the result. */ }
  if (!current) throw fail('CANCELLED', 'Tworzenie archiwum zostało anulowane.');
}

function yieldTask() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function validateFiles(files) {
  if (!files || !Number.isSafeInteger(files.length) || files.length < 1) {
    throw fail('INVALID_INPUT', 'Wybierz co najmniej jeden plik do archiwum ZIP.');
  }
  if (files.length > MAX_FILES) throw fail('TOO_MANY_FILES', 'Możesz spakować maksymalnie 100 plików.');
  const used = new Set();
  let inputBytes = 0;
  const pending = [];
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    if (!file || typeof file.name !== 'string' || !Number.isSafeInteger(file.size)
      || file.size < 0 || typeof file.arrayBuffer !== 'function') {
      throw fail('INVALID_FILE', 'Wybrany element nie jest prawidłowym plikiem.');
    }
    inputBytes += file.size;
    if (inputBytes > MAX_INPUT_BYTES) throw fail('INPUT_TOO_LARGE', 'Łączny rozmiar plików nie może przekroczyć 8 MiB.');
    pending.push({
      name: uniqueName(safeName(file.name), used),
      size: file.size,
      read: file.arrayBuffer.bind(file)
    });
  }
  return { pending, inputBytes };
}

export async function createArchive(files, options = {}) {
  if (!options || typeof options !== 'object'
    || (options.isCurrent !== undefined && typeof options.isCurrent !== 'function')) {
    throw fail('INVALID_INPUT', 'Nieprawidłowe opcje tworzenia archiwum.');
  }
  const isCurrent = options.isCurrent || (() => true);
  checkCurrent(isCurrent);
  // Validate every declared size and the entire file count before the first read.
  const { pending, inputBytes } = validateFiles(files);
  const entries = pending.map(({ name, size }) => ({ name, size }));
  const pieces = [];
  let length = 0;
  let finished = false;
  let output = null;
  let released = false;
  const archive = new Zip((error, bytes, final) => {
    if (error) throw fail('ZIP_FAILED', 'Nie udało się utworzyć archiwum ZIP.');
    // Own the emitted bytes so source/compression buffers can be cleared immediately.
    const owned = new Uint8Array(bytes);
    pieces.push(owned);
    length += owned.length;
    if (final) finished = true;
  });

  try {
    for (const file of pending) {
      let source = null;
      let compressed = null;
      let payload = null;
      try {
        await yieldTask();
        checkCurrent(isCurrent);
        let buffer;
        try { buffer = await file.read(); } catch (error) {
          checkCurrent(isCurrent);
          throw fail('READ_FAILED', 'Nie udało się odczytać wybranego pliku.');
        }
        if (Object.prototype.toString.call(buffer) !== '[object ArrayBuffer]') {
          throw fail('READ_FAILED', 'Odczyt pliku nie zwrócił prawidłowych danych.');
        }
        // File.arrayBuffer() creates a new owned buffer; no original File is modified.
        source = new Uint8Array(buffer);
        checkCurrent(isCurrent);
        if (source.length !== file.size) throw fail('FILE_SIZE_CHANGED', 'Rozmiar odczytanego pliku nie zgadza się z jego opisem.');
        if (source.length > 0) compressed = deflateSync(source, { level: 6 });
        const useDeflate = compressed !== null && compressed.length < source.length;
        payload = useDeflate ? compressed : source;
        await yieldTask();
        checkCurrent(isCurrent);

        // fflate explicitly supports overriding ZipPassThrough.process. Its push()
        // still computes CRC32 and the original size from the uncompressed bytes.
        const entry = new ZipPassThrough(file.name);
        entry.compression = useDeflate ? 8 : 0;
        entry.mtime = new Date(1980, 0, 1, 0, 0, 0);
        entry.os = 0;
        entry.attrs = 0;
        entry.process = (_chunk, final) => {
          const encoded = payload;
          payload = null;
          entry.ondata(null, encoded, final);
        };
        archive.add(entry);
        entry.push(source, true);
      } finally {
        if (source) source.fill(0);
        if (compressed) compressed.fill(0);
        payload = null;
      }
    }
    checkCurrent(isCurrent);
    archive.end();
    if (!finished) throw fail('ZIP_FAILED', 'Archiwum ZIP nie zostało poprawnie zakończone.');
    output = new Uint8Array(length);
    let offset = 0;
    for (const piece of pieces) {
      output.set(piece, offset);
      offset += piece.length;
    }
    await yieldTask();
    checkCurrent(isCurrent);
    released = true;
    return { bytes: output, name: 'pliki.zip', count: entries.length, inputBytes, entries };
  } catch (error) {
    if (error && error.name === 'ZipCoreError') throw error;
    throw fail('ZIP_FAILED', 'Nie udało się utworzyć archiwum ZIP.');
  } finally {
    archive.terminate();
    for (const piece of pieces) piece.fill(0);
    pieces.length = 0;
    if (!released && output) output.fill(0);
  }
}
