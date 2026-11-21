/* WGQR transfer protocol v1. Local-only binary chunks; no network or storage. */
(function (root) {
  'use strict';

  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const CHUNK_BYTES = 600;
  const MAX_NAME_BYTES = 120;
  const FIXED_HEADER_BYTES = 72;
  const CRC_BYTES = 4;
  const MAGIC = new Uint8Array([87, 71, 81, 82, 45, 88, 70, 82]); // WGQR-XFR
  const VERSION = 1;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

  function fail(code, message) {
    const error = new Error(message);
    error.name = 'QRTransferError';
    error.code = code;
    return error;
  }

  function isBytes(value) {
    return ArrayBuffer.isView(value)
      && Object.prototype.toString.call(value) === '[object Uint8Array]';
  }

  function equalBytes(left, right) {
    if (left.length !== right.length) return false;
    let different = 0;
    for (let index = 0; index < left.length; index++) different |= left[index] ^ right[index];
    return different === 0;
  }

  function hex(bytes) {
    let value = '';
    for (const byte of bytes) value += byte.toString(16).padStart(2, '0');
    return value;
  }

  function requireCrypto() {
    if (!root.crypto || typeof root.crypto.getRandomValues !== 'function'
      || !root.crypto.subtle || typeof root.crypto.subtle.digest !== 'function') {
      throw fail('CRYPTO_UNAVAILABLE', 'Do przesyłania wielu kodów QR potrzebne jest HTTPS i Web Crypto.');
    }
    return root.crypto;
  }

  async function sha256(bytes) {
    return new Uint8Array(await requireCrypto().subtle.digest('SHA-256', bytes));
  }

  function sanitizeName(filename) {
    let name = typeof filename === 'string' ? filename : 'plik.bin';
    name = name.split(/[\\/]/).pop()
      .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069\ufeff]/g, '')
      .replace(/[<>:"|?*]/g, '_')
      .trim()
      .replace(/[.\s]+$/gu, '');
    if (!name || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = 'plik.bin';
    // Round-trip through UTF-8 replaces lone UTF-16 surrogates deterministically.
    name = decoder.decode(encoder.encode(name));
    let safe = '';
    let length = 0;
    for (const character of name) {
      const bytes = encoder.encode(character).length;
      if (length + bytes > MAX_NAME_BYTES) break;
      safe += character;
      length += bytes;
    }
    safe = safe.replace(/[.\s]+$/gu, '');
    if (!safe || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safe)) return 'plik.bin';
    return safe;
  }

  const crcTable = new Uint32Array(256);
  for (let index = 0; index < crcTable.length; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
    crcTable[index] = value >>> 0;
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let index = 0; index < bytes.length; index++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[index]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  async function createTransfer(bytes, filename) {
    if (!isBytes(bytes)) throw fail('INVALID_INPUT', 'Oczekiwano tablicy bajtów Uint8Array.');
    if (bytes.length === 0) throw fail('EMPTY_INPUT', 'Plik jest pusty.');
    if (bytes.length > MAX_FILE_BYTES) throw fail('FILE_TOO_LARGE', 'Maksymalny rozmiar pliku to 10 MiB.');
    const crypto = requireCrypto();
    // Copy before the asynchronous digest so callers cannot change data mid-transfer.
    const content = new Uint8Array(bytes);
    const name = sanitizeName(filename);
    const nameBytes = encoder.encode(name);
    const transferId = crypto.getRandomValues(new Uint8Array(16));
    const digestBytes = await sha256(content);
    const size = content.length;
    const total = Math.ceil(size / CHUNK_BYTES);
    const headerLength = FIXED_HEADER_BYTES + nameBytes.length;
    const frames = [];

    for (let index = 0; index < total; index++) {
      const payload = content.subarray(index * CHUNK_BYTES, Math.min(size, (index + 1) * CHUNK_BYTES));
      const frame = new Uint8Array(headerLength + payload.length + CRC_BYTES);
      const view = new DataView(frame.buffer);
      frame.set(MAGIC, 0);
      view.setUint8(8, VERSION);
      view.setUint8(9, 0);
      view.setUint16(10, headerLength);
      frame.set(transferId, 12);
      view.setUint32(28, size);
      view.setUint16(32, index);
      view.setUint16(34, total);
      view.setUint16(36, CHUNK_BYTES);
      view.setUint16(38, nameBytes.length);
      frame.set(digestBytes, 40);
      frame.set(nameBytes, FIXED_HEADER_BYTES);
      frame.set(payload, headerLength);
      view.setUint32(frame.length - CRC_BYTES, crc32(frame.subarray(0, frame.length - CRC_BYTES)));
      frames.push(frame);
    }
    return { id: hex(transferId), name, size, total, frames, digest: hex(digestBytes) };
  }

  function parseFrame(bytes) {
    if (bytes.length < MAGIC.length || !equalBytes(bytes.subarray(0, MAGIC.length), MAGIC)) return null;
    if (bytes.length > 8 && bytes[8] !== VERSION) {
      throw fail('UNSUPPORTED_VERSION', 'Ten kod używa nieobsługiwanej wersji przesyłania plików.');
    }
    if (bytes.length < FIXED_HEADER_BYTES + 1 + CRC_BYTES
      || bytes.length > FIXED_HEADER_BYTES + MAX_NAME_BYTES + CHUNK_BYTES + CRC_BYTES) {
      throw fail('MALFORMED_FRAME', 'Nieprawidłowa długość fragmentu pliku.');
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const headerLength = view.getUint16(10);
    const size = view.getUint32(28);
    const index = view.getUint16(32);
    const total = view.getUint16(34);
    const chunkBytes = view.getUint16(36);
    const nameLength = view.getUint16(38);
    if (size > MAX_FILE_BYTES) throw fail('FILE_TOO_LARGE', 'Kod deklaruje plik większy niż 10 MiB.');
    if (bytes[9] !== 0 || size === 0 || chunkBytes !== CHUNK_BYTES
      || total !== Math.ceil(size / CHUNK_BYTES) || index >= total
      || nameLength < 1 || nameLength > MAX_NAME_BYTES
      || headerLength !== FIXED_HEADER_BYTES + nameLength
      || bytes.length !== headerLength + Math.min(CHUNK_BYTES, size - index * CHUNK_BYTES) + CRC_BYTES) {
      throw fail('MALFORMED_FRAME', 'Fragment ma nieprawidłowy nagłówek, numer lub rozmiar.');
    }
    if (view.getUint32(bytes.length - CRC_BYTES) !== crc32(bytes.subarray(0, bytes.length - CRC_BYTES))) {
      throw fail('CRC_MISMATCH', 'Fragment jest uszkodzony. Zeskanuj go ponownie.');
    }
    let name;
    try {
      name = decoder.decode(bytes.subarray(FIXED_HEADER_BYTES, headerLength));
    } catch {
      throw fail('MALFORMED_FRAME', 'Nazwa pliku ma nieprawidłowe kodowanie UTF-8.');
    }
    if (sanitizeName(name) !== name) throw fail('MALFORMED_FRAME', 'Nazwa pliku w kodzie jest nieprawidłowa.');
    return {
      id: hex(bytes.subarray(12, 28)),
      name,
      size,
      index,
      total,
      digest: new Uint8Array(bytes.subarray(40, 72)),
      payload: new Uint8Array(bytes.subarray(headerLength, bytes.length - CRC_BYTES))
    };
  }

  function createCollector() {
    let active = null;
    let epoch = 0;

    function snapshot(session) {
      const missing = [];
      for (let index = 0; index < session.total; index++) {
        if (session.chunks[index] === null) missing.push(index + 1);
      }
      return {
        received: session.received,
        total: session.total,
        name: session.name,
        size: session.size,
        id: session.id,
        missing,
        complete: session.completeBytes !== null
      };
    }

    function ensureCurrent(session, expectedEpoch) {
      if (active !== session || epoch !== expectedEpoch) {
        throw fail('TRANSFER_RESET', 'Odbieranie tego pliku zostało wyczyszczone.');
      }
    }

    async function finish(session, expectedEpoch) {
      const content = new Uint8Array(session.size);
      for (let index = 0; index < session.total; index++) content.set(session.chunks[index], index * CHUNK_BYTES);
      let digest;
      try {
        digest = await sha256(content);
      } catch (error) {
        ensureCurrent(session, expectedEpoch);
        session.completion = null;
        throw error;
      }
      ensureCurrent(session, expectedEpoch);
      if (!equalBytes(digest, session.digest)) {
        active = null;
        epoch++;
        throw fail('DIGEST_MISMATCH', 'Suma SHA-256 pliku się nie zgadza. Rozpocznij odbieranie ponownie.');
      }
      session.completeBytes = content;
    }

    async function accept(bytes) {
      if (!isBytes(bytes)) throw fail('INVALID_INPUT', 'Oczekiwano tablicy bajtów Uint8Array.');
      const frame = parseFrame(bytes);
      if (frame === null) return { kind: 'plain', bytes: new Uint8Array(bytes) };
      if (active && active.id !== frame.id) {
        return { kind: 'foreign', ...snapshot(active), foreignId: frame.id, foreignName: frame.name };
      }
      if (active && (active.size !== frame.size || active.total !== frame.total
        || active.name !== frame.name || !equalBytes(active.digest, frame.digest))) {
        throw fail('METADATA_CONFLICT', 'Fragment ma dane innego pliku mimo tego samego identyfikatora.');
      }
      if (!active) {
        active = {
          id: frame.id, name: frame.name, size: frame.size, total: frame.total, digest: frame.digest,
          chunks: new Array(frame.total).fill(null), received: 0, completeBytes: null, completion: null
        };
      }
      const session = active;
      const expectedEpoch = epoch;
      const previous = session.chunks[frame.index];
      const duplicate = previous !== null;
      if (duplicate && !equalBytes(previous, frame.payload)) {
        throw fail('CHUNK_CONFLICT', 'Powtórzony fragment zawiera inne dane.');
      }
      if (!duplicate) {
        session.chunks[frame.index] = frame.payload;
        session.received++;
      }
      if (session.received !== session.total) return { kind: 'progress', ...snapshot(session), duplicate };
      if (!session.completion) session.completion = finish(session, expectedEpoch);
      await session.completion;
      ensureCurrent(session, expectedEpoch);
      return {
        kind: 'complete', bytes: new Uint8Array(session.completeBytes), name: session.name,
        size: session.size, total: session.total, id: session.id
      };
    }

    return {
      accept,
      reset() { active = null; epoch++; },
      get state() { return active ? snapshot(active) : null; }
    };
  }

  root.WGTransfer = Object.freeze({ MAX_FILE_BYTES, CHUNK_BYTES, createTransfer, createCollector });
})(globalThis);
