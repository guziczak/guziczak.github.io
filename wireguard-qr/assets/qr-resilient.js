/* WGQR v2/v3: bounded binary fountain generations and offline optical feedback. */
(function (root) {
  'use strict';

  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const DEFAULT_CHUNK_BYTES = 384;
  const BLOCK_CHUNKS = 32;
  const MAX_NAME_BYTES = 120;
  const HEADER_BYTES = 80;
  const COMPACT_HEADER_BYTES = 36;
  const MANIFEST_HEADER_BYTES = 76;
  const MANIFEST_INTERVAL = 16;
  const ACK_HEADER_BYTES = 76;
  const MAX_REPAIR_TARGETS = 16;
  const REPAIR_TARGET_BYTES = 6;
  const CRC_BYTES = 4;
  const DATA_MAGIC = new Uint8Array([87, 71, 81, 82, 45, 88, 70, 82]); // WGQR-XFR
  const ACK_MAGIC = new Uint8Array([87, 71, 81, 82, 45, 65, 67, 75]); // WGQR-ACK
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
  function hasMagic(bytes, magic) {
    return bytes.length >= magic.length && equalBytes(bytes.subarray(0, magic.length), magic);
  }
  function isReserved(bytes) {
    return isBytes(bytes) && (hasMagic(bytes, DATA_MAGIC) || hasMagic(bytes, ACK_MAGIC));
  }
  function hex(bytes) {
    let result = '';
    for (const byte of bytes) result += byte.toString(16).padStart(2, '0');
    return result;
  }
  function requireCrypto() {
    if (!root.crypto || typeof root.crypto.getRandomValues !== 'function'
      || !root.crypto.subtle || typeof root.crypto.subtle.digest !== 'function') {
      throw fail('CRYPTO_UNAVAILABLE', 'Seria QR wymaga HTTPS i obsługi Web Crypto.');
    }
    return root.crypto;
  }
  async function sha256(bytes) {
    return new Uint8Array(await requireCrypto().subtle.digest('SHA-256', bytes));
  }
  function sanitizeName(value) {
    let name = (typeof value === 'string' ? value : 'plik.bin').split(/[\\/]/).pop()
      .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069\ufeff]/g, '')
      .replace(/[<>:"|?*]/g, '_').trim().replace(/[.\s]+$/gu, '');
    name = decoder.decode(encoder.encode(name));
    let result = '';
    let length = 0;
    for (const character of name) {
      const count = encoder.encode(character).length;
      if (length + count > MAX_NAME_BYTES) break;
      result += character;
      length += count;
    }
    result = result.replace(/[.\s]+$/gu, '');
    return !result || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(result) ? 'plik.bin' : result;
  }
  const crcTable = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
    crcTable[index] = value >>> 0;
  }
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
    return (crc ^ 0xffffffff) >>> 0;
  }
  function appendCrc(bytes) {
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      .setUint32(bytes.length - CRC_BYTES, crc32(bytes.subarray(0, -CRC_BYTES)));
    return bytes;
  }
  function checkCrc(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(bytes.length - CRC_BYTES) !== crc32(bytes.subarray(0, -CRC_BYTES))) {
      throw fail('CRC_MISMATCH', 'Kod jest uszkodzony. Zeskanuj go ponownie.');
    }
  }
  function validChunkSize(size) { return size === 384 || size === 600; }
  function dimensions(size, chunkBytes) {
    const total = Math.ceil(size / chunkBytes);
    return { total, blockCount: Math.ceil(total / BLOCK_CHUNKS) };
  }
  function sourceCount(total, blockIndex) { return Math.min(BLOCK_CHUNKS, total - blockIndex * BLOCK_CHUNKS); }
  function allowedMask(count) { return count === 32 ? 0xffffffff : (2 ** count - 1) >>> 0; }
  function packetType(mask) { return (mask & (mask - 1)) === 0 ? 'single' : 'mixed'; }
  function xor(left, right) {
    for (let index = 0; index < left.length; index++) left[index] ^= right[index];
  }
  function mix32(value) {
    value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
    value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
    return (value ^ (value >>> 16)) >>> 0;
  }
  function repairMask(seed, blockIndex, serial, count) {
    const value = mix32(seed ^ Math.imul(blockIndex + 1, 0x9e3779b1) ^ mix32(serial ^ 0xa5a5a5a5));
    const mask = (value & allowedMask(count)) >>> 0;
    return mask || (2 ** (value % count)) >>> 0;
  }
  function assertInteger(value, maximum, code = 'INVALID_INPUT') {
    if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
      throw fail(code, 'Nieprawidłowy numer fragmentu lub bloku.');
    }
  }

  function parseFeedback(bytes) {
    if (!isBytes(bytes)) throw fail('INVALID_INPUT', 'Oczekiwano bajtów kodu QR.');
    if (!hasMagic(bytes, ACK_MAGIC) || bytes.length < ACK_HEADER_BYTES + 1 + CRC_BYTES
      || bytes.length > ACK_HEADER_BYTES + Math.ceil(Math.ceil(Math.ceil(MAX_FILE_BYTES / 384) / BLOCK_CHUNKS) / 8)
        + MAX_REPAIR_TARGETS * REPAIR_TARGET_BYTES + CRC_BYTES) {
      throw fail('MALFORMED_FEEDBACK', 'To nie jest prawidłowy kod potwierdzenia.');
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const version = bytes[9];
    const flags = bytes[10];
    const suggestedRate = bytes[11];
    const size = view.getUint32(28);
    const chunkBytes = view.getUint16(32);
    const blockCount = view.getUint16(34);
    const total = view.getUint32(36);
    const bitmapLength = view.getUint16(72);
    const format = bytes[8];
    const targetCount = view.getUint16(74);
    if (!((format === 1 && (version === 1 || version === 2)) || (format === 2 && version === 3)) || flags > 1
      || ![1, 2, 5, 10].includes(suggestedRate) || size < 1 || size > MAX_FILE_BYTES
      || !validChunkSize(chunkBytes) || (version === 1 && chunkBytes !== 600)
      || total !== Math.ceil(size / chunkBytes) || blockCount !== Math.ceil(total / BLOCK_CHUNKS)
      || bitmapLength !== Math.ceil(blockCount / 8) || targetCount > MAX_REPAIR_TARGETS
      || (format === 1 && targetCount !== 0)
      || bytes.length !== ACK_HEADER_BYTES + bitmapLength + targetCount * REPAIR_TARGET_BYTES + CRC_BYTES) {
      throw fail('MALFORMED_FEEDBACK', 'Potwierdzenie ma nieprawidłowy nagłówek lub rozmiar.');
    }
    const bitmap = bytes.subarray(ACK_HEADER_BYTES, ACK_HEADER_BYTES + bitmapLength);
    if (blockCount % 8 && (bitmap[bitmap.length - 1] & (255 << (blockCount % 8)))) {
      throw fail('MALFORMED_FEEDBACK', 'Potwierdzenie zawiera nieprawidłowe bity bloków.');
    }
    checkCrc(bytes);
    const missingBlocks = [];
    for (let index = 0; index < blockCount; index++) {
      if (!(bitmap[index >>> 3] & (1 << (index & 7)))) missingBlocks.push(index);
    }
    if ((flags & 1) && missingBlocks.length) {
      throw fail('MALFORMED_FEEDBACK', 'Potwierdzenie końca transferu zawiera brakujące bloki.');
    }
    const repairTargets = [];
    let previousBlock = -1;
    for (let target = 0; target < targetCount; target++) {
      const offset = ACK_HEADER_BYTES + bitmapLength + target * REPAIR_TARGET_BYTES;
      const blockIndex = view.getUint16(offset);
      const missingMask = view.getUint32(offset + 2);
      const count = sourceCount(total, blockIndex);
      if (blockIndex >= blockCount || blockIndex <= previousBlock || !missingMask
        || (missingMask & ~allowedMask(count)) !== 0
        || (bitmap[blockIndex >>> 3] & (1 << (blockIndex & 7)))) {
        throw fail('MALFORMED_FEEDBACK', 'Potwierdzenie zawiera nieprawidłowe cele naprawy.');
      }
      const missingFrames = [];
      for (let local = 0; local < count; local++) {
        if ((missingMask >>> local) & 1) missingFrames.push(blockIndex * BLOCK_CHUNKS + local);
      }
      repairTargets.push({ blockIndex, missingFrames });
      previousBlock = blockIndex;
    }
    return {
      version, id: bytes.subarray(12, 28), size, chunkBytes, blockCount, total,
      digest: bytes.subarray(40, 72), missingBlocks, complete: Boolean(flags & 1), suggestedRate, repairTargets
    };
  }

  async function createTransfer(bytes, filename, options = {}) {
    if (!isBytes(bytes) || !options || typeof options !== 'object') throw fail('INVALID_INPUT', 'Nieprawidłowe dane do przesłania.');
    if (!bytes.length) throw fail('EMPTY_INPUT', 'Plik jest pusty.');
    if (bytes.length > MAX_FILE_BYTES) throw fail('FILE_TOO_LARGE', 'Maksymalny rozmiar pliku to 10 MiB.');
    const chunkBytes = options.chunkBytes === undefined ? DEFAULT_CHUNK_BYTES : options.chunkBytes;
    if (!validChunkSize(chunkBytes)) throw fail('INVALID_INPUT', 'Rozmiar fragmentu musi wynosić 384 lub 600 bajtów.');
    if (options.compact !== undefined && typeof options.compact !== 'boolean') throw fail('INVALID_INPUT', 'Nieprawidłowy tryb kompaktowy.');
    const compact = options.compact === true;
    const version = compact ? 3 : 2;
    const crypto = requireCrypto();
    const content = new Uint8Array(bytes);
    const idBytes = crypto.getRandomValues(new Uint8Array(16));
    let digestBytes;
    try { digestBytes = await sha256(content); }
    catch (error) { content.fill(0); idBytes.fill(0); throw error; }
    const name = sanitizeName(filename);
    const nameBytes = encoder.encode(name);
    const size = content.length;
    const { total, blockCount } = dimensions(size, chunkBytes);
    let seed = 0x811c9dc5;
    for (const byte of idBytes) seed = Math.imul(seed ^ byte, 0x01000193) >>> 0;
    let disposed = false;
    function ensureLive() {
      if (disposed) throw fail('TRANSFER_DISPOSED', 'Ten transfer został wyczyszczony.');
    }
    function makeFrame(blockIndex, mask, serial) {
      ensureLive();
      const count = sourceCount(total, blockIndex);
      const headerLength = compact ? COMPACT_HEADER_BYTES : HEADER_BYTES + nameBytes.length;
      const frame = new Uint8Array(headerLength + chunkBytes + CRC_BYTES);
      const view = new DataView(frame.buffer);
      frame.set(DATA_MAGIC);
      view.setUint8(8, version);
      view.setUint16(10, headerLength);
      frame.set(idBytes, 12);
      if (compact) {
        view.setUint16(28, blockIndex);
        view.setUint32(30, mask);
        view.setUint16(34, count);
      } else {
        view.setUint32(28, size);
        view.setUint16(32, chunkBytes);
        view.setUint16(34, blockIndex);
        view.setUint32(36, mask);
        view.setUint32(40, serial);
        view.setUint16(44, nameBytes.length);
        view.setUint16(46, count);
        frame.set(digestBytes, 48);
        frame.set(nameBytes, HEADER_BYTES);
      }
      const payload = frame.subarray(headerLength, headerLength + chunkBytes);
      for (let local = 0; local < count; local++) {
        if (!((mask >>> local) & 1)) continue;
        const offset = (blockIndex * BLOCK_CHUNKS + local) * chunkBytes;
        const end = Math.min(size, offset + chunkBytes);
        for (let index = offset; index < end; index++) payload[index - offset] ^= content[index];
      }
      return appendCrc(frame);
    }
    function manifestFrame() {
      ensureLive();
      const headerLength = MANIFEST_HEADER_BYTES + nameBytes.length;
      const frame = new Uint8Array(headerLength + CRC_BYTES);
      const view = new DataView(frame.buffer);
      frame.set(DATA_MAGIC);
      frame[8] = 3;
      frame[9] = 1;
      view.setUint16(10, headerLength);
      frame.set(idBytes, 12);
      view.setUint32(28, size);
      view.setUint16(32, chunkBytes);
      view.setUint16(34, blockCount);
      view.setUint32(36, total);
      view.setUint16(40, nameBytes.length);
      frame.set(digestBytes, 44);
      frame.set(nameBytes, MANIFEST_HEADER_BYTES);
      return appendCrc(frame);
    }
    return {
      version, id: hex(idBytes), name, size, total, blockCount, chunkBytes, digest: hex(digestBytes),
      ...(compact ? { manifestFrame, manifestInterval: MANIFEST_INTERVAL } : {}),
      frame(index) {
        ensureLive();
        assertInteger(index, total - 1);
        return makeFrame(Math.floor(index / BLOCK_CHUNKS), (2 ** (index % BLOCK_CHUNKS)) >>> 0, index);
      },
      repairFrame(blockIndex, serial) {
        ensureLive();
        assertInteger(blockIndex, blockCount - 1);
        assertInteger(serial, 0xffffffff);
        return makeFrame(blockIndex, repairMask(seed, blockIndex, serial, sourceCount(total, blockIndex)), serial);
      },
      acceptFeedback(feedback) {
        ensureLive();
        const result = parseFeedback(feedback);
        if (result.version !== version || !equalBytes(result.id, idBytes) || !equalBytes(result.digest, digestBytes)
          || result.size !== size || result.chunkBytes !== chunkBytes || result.total !== total || result.blockCount !== blockCount) {
          throw fail('FEEDBACK_SESSION_MISMATCH', 'Potwierdzenie dotyczy innego lub wcześniejszego transferu.');
        }
        return {
          missingBlocks: result.missingBlocks, complete: result.complete, suggestedRate: result.suggestedRate,
          ...(compact ? { repairTargets: result.repairTargets } : {})
        };
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        content.fill(0);
        idBytes.fill(0);
        digestBytes.fill(0);
        nameBytes.fill(0);
        seed = 0;
      }
    };
  }

  function parseCompactFrame(bytes) {
    if (bytes.length < COMPACT_HEADER_BYTES + CRC_BYTES) throw fail('MALFORMED_FRAME', 'Niepełny nagłówek serii QR.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const headerLength = view.getUint16(10);
    const common = { version: 3, id: hex(bytes.subarray(12, 28)), idBytes: bytes.subarray(12, 28) };
    if (bytes[9] === 0) {
      const chunkBytes = bytes.length - COMPACT_HEADER_BYTES - CRC_BYTES;
      const blockIndex = view.getUint16(28);
      const mask = view.getUint32(30);
      const count = view.getUint16(34);
      if (headerLength !== COMPACT_HEADER_BYTES || !validChunkSize(chunkBytes)
        || blockIndex >= dimensions(MAX_FILE_BYTES, chunkBytes).blockCount
        || count < 1 || count > BLOCK_CHUNKS || !mask || (mask & ~allowedMask(count)) !== 0) {
        throw fail('MALFORMED_FRAME', 'Nieprawidłowy kompaktowy fragment serii.');
      }
      checkCrc(bytes);
      return { ...common, compactData: true, chunkBytes, blockIndex, count, mask,
        packetType: packetType(mask), payload: bytes.subarray(COMPACT_HEADER_BYTES, -CRC_BYTES) };
    }
    if (bytes[9] !== 1 || bytes.length < MANIFEST_HEADER_BYTES + 1 + CRC_BYTES
      || bytes.length > MANIFEST_HEADER_BYTES + MAX_NAME_BYTES + CRC_BYTES) {
      throw fail('MALFORMED_FRAME', 'Nieprawidłowy manifest serii.');
    }
    const size = view.getUint32(28);
    if (size > MAX_FILE_BYTES) throw fail('FILE_TOO_LARGE', 'Kod deklaruje plik większy niż 10 MiB.');
    const chunkBytes = view.getUint16(32);
    const nameLength = view.getUint16(40);
    if (size < 1 || !validChunkSize(chunkBytes) || nameLength < 1 || nameLength > MAX_NAME_BYTES
      || headerLength !== MANIFEST_HEADER_BYTES + nameLength || bytes.length !== headerLength + CRC_BYTES
      || view.getUint16(42) !== 0) {
      throw fail('MALFORMED_FRAME', 'Nieprawidłowy nagłówek manifestu.');
    }
    const { total, blockCount } = dimensions(size, chunkBytes);
    if (view.getUint16(34) !== blockCount || view.getUint32(36) !== total) {
      throw fail('MALFORMED_FRAME', 'Nieprawidłowe wymiary manifestu.');
    }
    checkCrc(bytes);
    let name;
    try { name = decoder.decode(bytes.subarray(MANIFEST_HEADER_BYTES, headerLength)); }
    catch { throw fail('MALFORMED_FRAME', 'Nieprawidłowa nazwa UTF-8.'); }
    if (name !== sanitizeName(name)) throw fail('MALFORMED_FRAME', 'Nieprawidłowa nazwa pliku.');
    return { ...common, manifest: true, packetType: 'manifest', size, chunkBytes, name, total, blockCount,
      digest: bytes.subarray(44, 76) };
  }

  function parseFrame(bytes) {
    if (!isBytes(bytes)) throw fail('INVALID_INPUT', 'Oczekiwano bajtów kodu QR.');
    if (hasMagic(bytes, ACK_MAGIC)) throw fail('FEEDBACK_FRAME', 'To kod potwierdzenia dla nadajnika, a nie plik.');
    if (!hasMagic(bytes, DATA_MAGIC)) return null;
    if (bytes.length < 9) throw fail('MALFORMED_FRAME', 'Niepełny nagłówek serii QR.');
    const version = bytes[8];
    if (version === 3) return parseCompactFrame(bytes);
    if (version !== 1 && version !== 2) throw fail('UNSUPPORTED_VERSION', 'Nieobsługiwana wersja serii QR.');
    const fixedHeader = version === 1 ? 72 : HEADER_BYTES;
    if (bytes.length < fixedHeader + 1 + CRC_BYTES || bytes.length > fixedHeader + MAX_NAME_BYTES + 600 + CRC_BYTES) {
      throw fail('MALFORMED_FRAME', 'Nieprawidłowa długość kodu serii.');
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const size = view.getUint32(28);
    if (size > MAX_FILE_BYTES) throw fail('FILE_TOO_LARGE', 'Kod deklaruje plik większy niż 10 MiB.');
    const headerLength = view.getUint16(10);
    const chunkBytes = view.getUint16(version === 1 ? 36 : 32);
    const nameLength = view.getUint16(version === 1 ? 38 : 44);
    if (bytes[9] !== 0 || size < 1 || !validChunkSize(chunkBytes) || (version === 1 && chunkBytes !== 600)
      || nameLength < 1 || nameLength > MAX_NAME_BYTES || headerLength !== fixedHeader + nameLength) {
      throw fail('MALFORMED_FRAME', 'Nieprawidłowy nagłówek serii QR.');
    }
    const { total, blockCount } = dimensions(size, chunkBytes);
    let blockIndex;
    let count;
    let mask;
    if (version === 1) {
      const index = view.getUint16(32);
      if (view.getUint16(34) !== total || index >= total
        || bytes.length !== headerLength + Math.min(chunkBytes, size - index * chunkBytes) + CRC_BYTES) {
        throw fail('MALFORMED_FRAME', 'Nieprawidłowy numer lub rozmiar fragmentu v1.');
      }
      blockIndex = Math.floor(index / BLOCK_CHUNKS);
      count = sourceCount(total, blockIndex);
    } else {
      blockIndex = view.getUint16(34);
      count = sourceCount(total, blockIndex);
      mask = view.getUint32(36);
      if (blockIndex >= blockCount || view.getUint16(46) !== count || !mask
        || (mask & ~allowedMask(count)) !== 0 || bytes.length !== headerLength + chunkBytes + CRC_BYTES) {
        throw fail('MALFORMED_FRAME', 'Nieprawidłowy blok, maska lub rozmiar fragmentu v2.');
      }
    }
    checkCrc(bytes);
    let name;
    try { name = decoder.decode(bytes.subarray(fixedHeader, headerLength)); }
    catch { throw fail('MALFORMED_FRAME', 'Nieprawidłowa nazwa UTF-8.'); }
    if (name !== sanitizeName(name)) throw fail('MALFORMED_FRAME', 'Nieprawidłowa nazwa pliku.');
    return {
      version, id: hex(bytes.subarray(12, 28)), idBytes: bytes.subarray(12, 28), name, size, total, blockCount, chunkBytes,
      blockIndex, count, mask, packetType: version === 1 ? 'legacy' : packetType(mask),
      digest: bytes.subarray(version === 1 ? 40 : 48, version === 1 ? 72 : 80),
      payload: bytes.subarray(headerLength, bytes.length - CRC_BYTES)
    };
  }

  function createCollector() {
    let active = null;
    let epoch = 0;
    function wipe(session) {
      if (!session) return;
      if (session.legacy) session.legacy.reset();
      if (session.content) session.content.fill(0);
      if (session.blocks) {
        for (const block of session.blocks) {
          if (block && block.rows) {
            for (const row of block.rows) if (row) row.data.fill(0);
            block.rows.fill(null);
          }
        }
        session.blocks.fill(null);
      }
      session.idBytes.fill(0);
      session.digestBytes.fill(0);
      session.verified = false;
    }
    function ensureCurrent(session, expectedEpoch) {
      if (active !== session || epoch !== expectedEpoch) throw fail('TRANSFER_RESET', 'Odbiór tego transferu został wyczyszczony.');
    }
    function blockBitmap(session) {
      const bitmap = new Uint8Array(Math.ceil(session.blockCount / 8));
      if (session.version === 1) {
        const state = session.legacy.state;
        if (!state) return bitmap;
        const incomplete = new Set(state.missing.map(index => Math.floor((index - 1) / BLOCK_CHUNKS)));
        for (let index = 0; index < session.blockCount; index++) {
          if (!incomplete.has(index)) bitmap[index >>> 3] |= 1 << (index & 7);
        }
      } else {
        for (let index = 0; index < session.blockCount; index++) {
          if (session.blocks[index] && session.blocks[index].done) bitmap[index >>> 3] |= 1 << (index & 7);
        }
      }
      return bitmap;
    }
    function snapshot(session) {
      if (!session) return null;
      const bitmap = blockBitmap(session);
      const missing = [];
      let missingCount = 0;
      for (let index = 0; index < session.blockCount; index++) {
        if (!(bitmap[index >>> 3] & (1 << (index & 7)))) {
          if (missing.length < 18) missing.push(index + 1);
          missingCount++;
        }
      }
      const legacyState = session.version === 1 ? session.legacy.state : null;
      return {
        version: session.version, id: session.id, name: session.name, size: session.size, total: session.total,
        chunkBytes: session.chunkBytes, blockCount: session.blockCount, blocksComplete: session.blockCount - missingCount,
        received: legacyState ? legacyState.received : session.received,
        recovered: legacyState ? legacyState.received : session.recovered,
        missing, missingCount, complete: session.verified
      };
    }
    function invalidate(session) {
      if (active === session) { active = null; epoch++; }
      wipe(session);
    }
    function solveBlock(session, blockIndex, block) {
      for (let pivot = block.count - 1; pivot >= 0; pivot--) {
        const row = block.rows[pivot];
        for (let bit = pivot + 1; bit < block.count; bit++) {
          if ((row.mask >>> bit) & 1) xor(row.data, block.rows[bit].data);
        }
        row.mask = (2 ** pivot) >>> 0;
      }
      for (let local = 0; local < block.count; local++) {
        const offset = (blockIndex * BLOCK_CHUNKS + local) * session.chunkBytes;
        const length = Math.min(session.chunkBytes, session.size - offset);
        const data = block.rows[local].data;
        for (let index = length; index < data.length; index++) {
          if (data[index] !== 0) throw fail('DIGEST_MISMATCH', 'Odtworzony blok ma nieprawidłowe dopełnienie.');
        }
        session.content.set(data.subarray(0, length), offset);
      }
      for (const row of block.rows) row.data.fill(0);
      block.rows.fill(null);
      block.done = true;
      session.recovered += block.count;
    }
    function addEquation(session, frame) {
      let block = session.blocks[frame.blockIndex];
      if (block && block.done) return false;
      if (!block) {
        block = { count: frame.count, rank: 0, done: false, rows: new Array(frame.count).fill(null) };
        session.blocks[frame.blockIndex] = block;
      }
      let mask = frame.mask;
      const data = new Uint8Array(frame.payload);
      let retained = false;
      try {
        for (let pivot = 0; pivot < block.count; pivot++) {
          if (!((mask >>> pivot) & 1)) continue;
          const previous = block.rows[pivot];
          if (previous) {
            mask = (mask ^ previous.mask) >>> 0;
            xor(data, previous.data);
          } else {
            block.rows[pivot] = { mask, data };
            retained = true;
            block.rank++;
            session.received++;
            if (block.rank === block.count) solveBlock(session, frame.blockIndex, block);
            return true;
          }
        }
        if (data.some(byte => byte !== 0)) throw fail('CHUNK_CONFLICT', 'Fragment jest sprzeczny z już odebranymi danymi.');
        return false;
      } finally {
        if (!retained) data.fill(0);
      }
    }
    async function finish(session, expectedEpoch) {
      let digest;
      try {
        digest = await sha256(session.content);
        ensureCurrent(session, expectedEpoch);
        if (!equalBytes(digest, session.digestBytes)) {
          invalidate(session);
          throw fail('DIGEST_MISMATCH', 'Suma SHA-256 pliku się nie zgadza. Rozpocznij odbiór ponownie.');
        }
        session.verified = true;
      } catch (error) {
        if (error.code === 'DIGEST_MISMATCH') throw error;
        ensureCurrent(session, expectedEpoch);
        session.completion = null;
        throw error;
      } finally {
        if (digest) digest.fill(0);
      }
    }
    async function accept(bytes) {
      const frame = parseFrame(bytes);
      if (frame === null) return { kind: 'plain', bytes: new Uint8Array(bytes) };
      if (active && (active.version !== frame.version || active.id !== frame.id)) {
        return { kind: 'foreign', ...snapshot(active), foreignId: frame.id, foreignName: frame.name || '', foreignVersion: frame.version };
      }
      if (frame.compactData) {
        // Data before the next repeated manifest is discarded, never buffered or
        // counted as progress. A lost manifest therefore cannot grow memory.
        if (!active) return { kind: 'pending', version: 3, id: frame.id, reason: 'manifest', packetType: frame.packetType };
        if (frame.chunkBytes !== active.chunkBytes || frame.blockIndex >= active.blockCount
          || frame.count !== sourceCount(active.total, frame.blockIndex)) {
          throw fail('METADATA_CONFLICT', 'Fragment nie pasuje do wymiarów manifestu.');
        }
      }
      if (active && !frame.compactData && (active.size !== frame.size || active.chunkBytes !== frame.chunkBytes || active.name !== frame.name
        || !equalBytes(active.digestBytes, frame.digest))) {
        throw fail('METADATA_CONFLICT', 'Fragment ma inne metadane mimo tego samego identyfikatora.');
      }
      if (!active) {
        if (frame.version === 1 && (!root.WGTransfer || typeof root.WGTransfer.createCollector !== 'function')) {
          throw fail('V1_UNAVAILABLE', 'Nie udało się wczytać odbiornika starszych serii. Odśwież stronę.');
        }
        active = {
          version: frame.version, id: frame.id, idBytes: new Uint8Array(frame.idBytes), name: frame.name,
          size: frame.size, total: frame.total, blockCount: frame.blockCount, chunkBytes: frame.chunkBytes,
          digestBytes: new Uint8Array(frame.digest), received: 0, recovered: 0, verified: false, completion: null,
          legacy: frame.version === 1 ? root.WGTransfer.createCollector() : null,
          content: frame.version >= 2 ? new Uint8Array(frame.size) : null,
          blocks: frame.version >= 2 ? new Array(frame.blockCount).fill(null) : null
        };
      }
      const session = active;
      const expectedEpoch = epoch;
      if (session.version === 1) {
        let result;
        try {
          result = await session.legacy.accept(bytes);
          ensureCurrent(session, expectedEpoch);
        } catch (error) {
          if (result && result.bytes) result.bytes.fill(0);
          if (error.code === 'DIGEST_MISMATCH' && active === session) invalidate(session);
          throw error;
        }
        session.verified = result.kind === 'complete';
        return result.kind === 'complete'
          ? { kind: 'complete', ...snapshot(session), packetType: 'legacy', bytes: result.bytes }
          : { kind: 'progress', ...snapshot(session), packetType: 'legacy', duplicate: result.duplicate };
      }
      if (frame.manifest && session.recovered !== session.total) {
        return { kind: 'manifest', ...snapshot(session), packetType: 'manifest' };
      }
      let gained = false;
      try { if (!frame.manifest) gained = addEquation(session, frame); }
      catch (error) {
        if (error.code === 'DIGEST_MISMATCH') invalidate(session);
        throw error;
      }
      if (session.recovered !== session.total) return { kind: 'progress', ...snapshot(session), packetType: frame.packetType, duplicate: !gained };
      if (!session.completion) session.completion = finish(session, expectedEpoch);
      await session.completion;
      ensureCurrent(session, expectedEpoch);
      return { kind: 'complete', ...snapshot(session), packetType: frame.packetType, bytes: new Uint8Array(session.content) };
    }
    return {
      accept,
      reset() { const previous = active; active = null; epoch++; wipe(previous); },
      dispose() { const previous = active; active = null; epoch++; wipe(previous); },
      get state() { return snapshot(active); },
      createFeedback(options = {}) {
        if (!active) throw fail('NO_TRANSFER', 'Najpierw zeskanuj fragment serii.');
        if (!options || typeof options !== 'object') throw fail('INVALID_INPUT', 'Nieprawidłowe opcje potwierdzenia.');
        const suggestedRate = options.suggestedRate === undefined ? 2 : options.suggestedRate;
        if (![1, 2, 5, 10].includes(suggestedRate)) throw fail('INVALID_INPUT', 'Nieprawidłowe sugerowane tempo.');
        const session = active;
        const bitmap = blockBitmap(session);
        const targets = [];
        if (session.version === 3) {
          for (let blockIndex = 0; blockIndex < session.blockCount && targets.length < MAX_REPAIR_TARGETS; blockIndex++) {
            const block = session.blocks[blockIndex];
            if (block && block.done) continue;
            const count = sourceCount(session.total, blockIndex);
            let missingMask = 0;
            for (let local = 0; local < count; local++) {
              if (!block || !block.rows[local]) missingMask = (missingMask | (2 ** local)) >>> 0;
            }
            if (missingMask) targets.push({ blockIndex, missingMask });
          }
        }
        const feedback = new Uint8Array(ACK_HEADER_BYTES + bitmap.length + targets.length * REPAIR_TARGET_BYTES + CRC_BYTES);
        const view = new DataView(feedback.buffer);
        feedback.set(ACK_MAGIC);
        feedback[8] = session.version === 3 ? 2 : 1;
        feedback[9] = session.version;
        feedback[10] = session.verified ? 1 : 0;
        feedback[11] = suggestedRate;
        feedback.set(session.idBytes, 12);
        view.setUint32(28, session.size);
        view.setUint16(32, session.chunkBytes);
        view.setUint16(34, session.blockCount);
        view.setUint32(36, session.total);
        feedback.set(session.digestBytes, 40);
        view.setUint16(72, bitmap.length);
        view.setUint16(74, targets.length);
        feedback.set(bitmap, ACK_HEADER_BYTES);
        for (let index = 0; index < targets.length; index++) {
          const offset = ACK_HEADER_BYTES + bitmap.length + index * REPAIR_TARGET_BYTES;
          view.setUint16(offset, targets[index].blockIndex);
          view.setUint32(offset + 2, targets[index].missingMask);
        }
        return appendCrc(feedback);
      }
    };
  }

  root.WGResilient = Object.freeze({
    MAX_FILE_BYTES, DEFAULT_CHUNK_BYTES, BLOCK_CHUNKS,
    SUPPORTED_CHUNK_BYTES: Object.freeze([384, 600]), isReserved, createTransfer, createCollector
  });
})(typeof window !== 'undefined' ? window : globalThis);
