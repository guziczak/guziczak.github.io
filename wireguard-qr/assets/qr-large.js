/* WGQR v4: bounded segments, durable progress and a canonical ordered-hash root. */
(function (root) {
  'use strict';

  const VERSION = 4;
  const MAX_FILE_BYTES = 200 * 1024 * 1024;
  const SEGMENT_BYTES = 2 * 1024 * 1024;
  const MAX_SEGMENTS = MAX_FILE_BYTES / SEGMENT_BYTES;
  const MAX_NAME_BYTES = 120;
  const HEADER_BYTES = 48;
  const MANIFEST_BYTES = 92;
  const ACK_BYTES = 56;
  const INNER_NAME = 'segment.bin';
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  const MAGIC = encoder.encode('WGQR-LRG');
  const ACK_MAGIC = encoder.encode('WGQR-LAK');
  const INNER_MAGIC = encoder.encode('WGQR-XFR');
  const ROOT_DOMAIN = encoder.encode('WGQR-LARGE-ROOT\0');
  const INNER_NAME_BYTES = encoder.encode(INNER_NAME);
  const RATES = [1, 2, 5, 10, 15, 20];

  function fail(code, message, abort = false) {
    const error = new Error(message);
    error.name = abort ? 'AbortError' : 'LargeTransferError';
    error.code = code;
    return error;
  }
  const isBytes = value => ArrayBuffer.isView(value)
    && Object.prototype.toString.call(value) === '[object Uint8Array]';
  function equal(left, right) {
    if (left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
    return difference === 0;
  }
  const hasMagic = (bytes, magic) => isBytes(bytes) && bytes.length >= 8 && equal(bytes.subarray(0, 8), magic);
  const isFrame = bytes => hasMagic(bytes, MAGIC);
  const isFeedback = bytes => hasMagic(bytes, ACK_MAGIC);
  const isReserved = bytes => isFrame(bytes) || isFeedback(bytes);
  function hex(bytes) {
    let output = '';
    for (const byte of bytes) output += byte.toString(16).padStart(2, '0');
    return output;
  }
  function unhex(value) {
    if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) throw fail('INVALID_DIGEST', 'Nieprawidłowa suma segmentu.');
    const bytes = new Uint8Array(32);
    for (let index = 0; index < 32; index++) bytes[index] = parseInt(value.slice(index * 2, index * 2 + 2), 16);
    return bytes;
  }
  async function sha256(bytes) {
    if (!root.crypto?.subtle || typeof root.crypto.subtle.digest !== 'function') {
      throw fail('CRYPTO_UNAVAILABLE', 'Duży transfer wymaga HTTPS i obsługi Web Crypto.');
    }
    return new Uint8Array(await root.crypto.subtle.digest('SHA-256', bytes));
  }
  function cleanName(value) {
    let name = (typeof value === 'string' ? value : 'plik.bin').split(/[\\/]/).pop()
      .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069\ufeff]/g, '')
      .replace(/[<>:"|?*]/g, '_').trim().replace(/[.\s]+$/gu, '');
    name = decoder.decode(encoder.encode(name));
    let result = '', length = 0;
    for (const character of name) {
      const size = encoder.encode(character).length;
      if (length + size > MAX_NAME_BYTES) break;
      result += character;
      length += size;
    }
    result = result.replace(/[.\s]+$/gu, '');
    return !result || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(result) ? 'plik.bin' : result;
  }
  function validDescriptor(value) {
    return value && value.version === VERSION && typeof value.id === 'string' && /^[0-9a-f]{64}$/.test(value.id)
      && typeof value.name === 'string' && value.name === cleanName(value.name)
      && encoder.encode(value.name).length >= 1 && encoder.encode(value.name).length <= MAX_NAME_BYTES
      && Number.isSafeInteger(value.size) && value.size >= 1 && value.size <= MAX_FILE_BYTES
      && value.segmentBytes === SEGMENT_BYTES && value.segmentCount === Math.ceil(value.size / SEGMENT_BYTES);
  }
  function descriptorCopy(value) {
    if (!validDescriptor(value)) throw fail('INVALID_DESCRIPTOR', 'Nieprawidłowy opis dużego pliku.');
    return Object.freeze({ version: VERSION, id: value.id, name: value.name, size: value.size,
      segmentBytes: SEGMENT_BYTES, segmentCount: value.segmentCount });
  }
  function sameDescriptor(left, right) {
    return ['version', 'id', 'name', 'size', 'segmentBytes', 'segmentCount'].every(key => left[key] === right[key]);
  }
  const segmentSize = (descriptor, index) => Math.min(SEGMENT_BYTES, descriptor.size - index * SEGMENT_BYTES);
  function checkIndex(index, count) {
    if (!Number.isInteger(index) || index < 0 || index >= count) throw fail('INVALID_SEGMENT', 'Nieprawidłowy numer segmentu.');
  }
  async function rootDigest(metadata, digests) {
    const name = encoder.encode(metadata.name);
    if (digests.length !== metadata.segmentCount || digests.some(value => !isBytes(value) || value.length !== 32)) {
      throw fail('INVALID_DIGEST', 'Brakuje sum segmentów dużego pliku.');
    }
    const bytes = new Uint8Array(ROOT_DOMAIN.length + 13 + name.length + digests.length * 32);
    const view = new DataView(bytes.buffer);
    bytes.set(ROOT_DOMAIN);
    let offset = ROOT_DOMAIN.length;
    bytes[offset++] = VERSION;
    view.setUint32(offset, metadata.size); offset += 4;
    view.setUint32(offset, SEGMENT_BYTES); offset += 4;
    view.setUint16(offset, metadata.segmentCount); offset += 2;
    view.setUint16(offset, name.length); offset += 2;
    bytes.set(name, offset); offset += name.length;
    for (const digest of digests) { bytes.set(digest, offset); offset += 32; }
    try { return await sha256(bytes); }
    finally { bytes.fill(0); name.fill(0); }
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
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint32(bytes.length - 4, crc32(bytes.subarray(0, -4)));
    return bytes;
  }
  function checkCrc(bytes) {
    if (new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(bytes.length - 4) !== crc32(bytes.subarray(0, -4))) {
      throw fail('CRC_MISMATCH', 'Kod dużego transferu jest uszkodzony.');
    }
  }

  function inspectInner(bytes, manifest, descriptor, index, expectedDigest) {
    if (!hasMagic(bytes, INNER_MAGIC) || bytes[8] !== 3 || bytes[9] !== (manifest ? 1 : 0)) {
      throw fail('MALFORMED_FRAME', 'Nieprawidłowa wewnętrzna ramka segmentu.');
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let chunkBytes, packetType;
    if (manifest) {
      const size = segmentSize(descriptor, index);
      chunkBytes = view.getUint16(32);
      if (bytes.length !== 80 + INNER_NAME_BYTES.length || view.getUint16(10) !== 76 + INNER_NAME_BYTES.length
        || view.getUint32(28) !== size || ![384, 600].includes(chunkBytes)
        || view.getUint16(34) !== Math.ceil(Math.ceil(size / chunkBytes) / 32)
        || view.getUint32(36) !== Math.ceil(size / chunkBytes)
        || view.getUint16(40) !== INNER_NAME_BYTES.length || view.getUint16(42) !== 0
        || !equal(bytes.subarray(44, 76), expectedDigest)
        || !equal(bytes.subarray(76, -4), INNER_NAME_BYTES)) {
        throw fail('MALFORMED_FRAME', 'Manifest segmentu ma nieprawidłowe wymiary lub sumę.');
      }
      packetType = 'manifest';
    } else {
      chunkBytes = bytes.length - 40;
      const count = view.getUint16(34), mask = view.getUint32(30);
      const allowed = count === 32 ? 0xffffffff : (2 ** count - 1) >>> 0;
      if (view.getUint16(10) !== 36 || ![384, 600].includes(chunkBytes)
        || count < 1 || count > 32 || !mask || (mask & ~allowed) !== 0
        || view.getUint16(28) >= Math.ceil(Math.ceil(SEGMENT_BYTES / chunkBytes) / 32)) {
        throw fail('MALFORMED_FRAME', 'Nieprawidłowy fragment segmentu.');
      }
      packetType = (mask & (mask - 1)) === 0 ? 'single' : 'mixed';
    }
    checkCrc(bytes);
    return { innerId: hex(bytes.subarray(12, 28)), chunkBytes, packetType };
  }
  function parseFrame(bytes) {
    if (!isBytes(bytes)) throw fail('INVALID_INPUT', 'Oczekiwano bajtów kodu QR.');
    if (isFeedback(bytes)) throw fail('FEEDBACK_FRAME', 'To potwierdzenie dla nadajnika, a nie dane pliku.');
    if (!isFrame(bytes) || bytes.length < HEADER_BYTES + 40 + 4 || bytes.length > HEADER_BYTES + 640 + 4) {
      throw fail('MALFORMED_FRAME', 'Nieprawidłowa długość dużego transferu.');
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const flags = bytes[9], headerLength = view.getUint16(10), index = view.getUint16(44), innerLength = view.getUint16(46);
    if (bytes[8] !== VERSION || flags > 1 || index >= MAX_SEGMENTS
      || bytes.length !== headerLength + innerLength + 4
      || (flags === 0 && (headerLength !== HEADER_BYTES || ![424, 640].includes(innerLength)))
      || (flags === 1 && (headerLength < MANIFEST_BYTES + 1 || headerLength > MANIFEST_BYTES + MAX_NAME_BYTES
        || innerLength !== 80 + INNER_NAME_BYTES.length))) {
      throw fail('MALFORMED_FRAME', 'Nieprawidłowy nagłówek dużego transferu.');
    }
    checkCrc(bytes);
    const id = hex(bytes.subarray(12, 44)), manifest = flags === 1;
    let descriptor = null, digest = null;
    if (manifest) {
      const nameLength = view.getUint16(58);
      if (headerLength !== MANIFEST_BYTES + nameLength || nameLength < 1 || nameLength > MAX_NAME_BYTES) {
        throw fail('MALFORMED_FRAME', 'Nieprawidłowa długość nazwy dużego pliku.');
      }
      let name;
      try { name = decoder.decode(bytes.subarray(MANIFEST_BYTES, headerLength)); }
      catch { throw fail('MALFORMED_FRAME', 'Nieprawidłowa nazwa UTF-8 dużego pliku.'); }
      descriptor = descriptorCopy({ version: VERSION, id, name, size: view.getUint32(48),
        segmentBytes: view.getUint32(52), segmentCount: view.getUint16(56) });
      checkIndex(index, descriptor.segmentCount);
      digest = bytes.subarray(60, 92);
    }
    const inner = bytes.subarray(headerLength, -4);
    return { version: VERSION, id, segmentIndex: index, manifest, descriptor,
      digest: digest ? hex(digest) : null, inner, ...inspectInner(inner, manifest, descriptor, index, digest) };
  }
  function parseFeedback(bytes) {
    if (!isBytes(bytes) || !isFeedback(bytes) || bytes.length < ACK_BYTES + 1 + 4 || bytes.length > ACK_BYTES + Math.ceil(MAX_SEGMENTS / 8) + 4) {
      throw fail('MALFORMED_FEEDBACK', 'Nieprawidłowy kod zwrotny dużego transferu.');
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const size = view.getUint32(44), count = view.getUint16(52), bitmapLength = view.getUint16(54);
    if (bytes[8] !== VERSION || bytes[9] > 1 || !RATES.includes(bytes[10]) || bytes[11] !== 0
      || size < 1 || size > MAX_FILE_BYTES || view.getUint32(48) !== SEGMENT_BYTES
      || count !== Math.ceil(size / SEGMENT_BYTES) || bitmapLength !== Math.ceil(count / 8)
      || bytes.length !== ACK_BYTES + bitmapLength + 4) {
      throw fail('MALFORMED_FEEDBACK', 'Nieprawidłowe pola kodu zwrotnego dużego transferu.');
    }
    checkCrc(bytes);
    const bitmap = bytes.subarray(ACK_BYTES, -4);
    if (count % 8 && (bitmap[bitmap.length - 1] & (255 << (count % 8)))) {
      throw fail('MALFORMED_FEEDBACK', 'Nieprawidłowe bity postępu dużego transferu.');
    }
    const missingSegments = [];
    for (let index = 0; index < count; index++) if (!(bitmap[index >>> 3] & (1 << (index & 7)))) missingSegments.push(index);
    if (bytes[9] && missingSegments.length) throw fail('MALFORMED_FEEDBACK', 'Potwierdzenie końca zawiera brakujące segmenty.');
    return { version: VERSION, id: hex(bytes.subarray(12, 44)), size, segmentBytes: SEGMENT_BYTES,
      segmentCount: count, complete: bytes[9] === 1, missingSegments, suggestedRate: bytes[10] };
  }

  async function createSender(file, options = {}) {
    if (!file || typeof file.slice !== 'function' || !Number.isSafeInteger(file.size) || file.size < 1
      || file.size > MAX_FILE_BYTES || !options || typeof options !== 'object') {
      throw fail('INVALID_FILE', 'Wybierz niepusty plik do 200 MiB.');
    }
    const chunkBytes = options.chunkBytes === undefined ? 384 : options.chunkBytes;
    const isCurrent = options.isCurrent === undefined ? (() => true) : options.isCurrent, onProgress = options.onProgress;
    if (![384, 600].includes(chunkBytes) || typeof isCurrent !== 'function'
      || (onProgress !== undefined && typeof onProgress !== 'function')
      || !root.WGResilient?.createTransfer) throw fail('INVALID_INPUT', 'Nieprawidłowe ustawienia dużego transferu.');
    const metadata = { version: VERSION, name: cleanName(file.name), size: file.size,
      segmentBytes: SEGMENT_BYTES, segmentCount: Math.ceil(file.size / SEGMENT_BYTES) };
    const digests = [];
    let disposed = false, generation = 0, activeTransfer = null;
    const ensureLive = () => {
      if (disposed || !isCurrent()) throw fail('CANCELLED', 'Przygotowanie dużego transferu zostało przerwane.', true);
    };
    async function readSegment(index) {
      ensureLive();
      if (file.size !== metadata.size) throw fail('FILE_CHANGED', 'Rozmiar pliku zmienił się podczas odczytu.');
      const start = index * SEGMENT_BYTES;
      const blob = file.slice(start, start + segmentSize(metadata, index));
      if (!blob || typeof blob.arrayBuffer !== 'function') throw fail('READ_FAILED', 'Nie udało się odczytać segmentu pliku.');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      try {
        ensureLive();
        if (file.size !== metadata.size || bytes.length !== segmentSize(metadata, index)) {
          throw fail('FILE_CHANGED', 'Nie udało się odczytać całego segmentu pliku.');
        }
        return bytes;
      } catch (error) { bytes.fill(0); throw error; }
    }
    let digestRoot;
    try {
      ensureLive();
      for (let index = 0; index < metadata.segmentCount; index++) {
        const bytes = await readSegment(index);
        let digest;
        try { digest = await sha256(bytes); ensureLive(); digests.push(digest); }
        catch (error) { digest?.fill(0); throw error; }
        finally { bytes.fill(0); }
        onProgress?.({ phase: 'hash', completedBytes: Math.min(metadata.size, (index + 1) * SEGMENT_BYTES),
          totalBytes: metadata.size, segmentIndex: index, segmentCount: metadata.segmentCount });
      }
      digestRoot = await rootDigest(metadata, digests);
      ensureLive();
    } catch (error) {
      for (const digest of digests) digest.fill(0);
      digestRoot?.fill(0);
      throw error;
    }
    const descriptor = descriptorCopy({ ...metadata, id: hex(digestRoot) });
    const idBytes = digestRoot;
    const nameBytes = encoder.encode(descriptor.name);
    function wrap(innerBytes, index, manifest) {
      try {
        ensureLive();
        const headerLength = manifest ? MANIFEST_BYTES + nameBytes.length : HEADER_BYTES;
        const packet = new Uint8Array(headerLength + innerBytes.length + 4);
        const view = new DataView(packet.buffer);
        packet.set(MAGIC); packet[8] = VERSION; packet[9] = manifest ? 1 : 0;
        view.setUint16(10, headerLength); packet.set(idBytes, 12);
        view.setUint16(44, index); view.setUint16(46, innerBytes.length);
        if (manifest) {
          view.setUint32(48, descriptor.size); view.setUint32(52, SEGMENT_BYTES);
          view.setUint16(56, descriptor.segmentCount); view.setUint16(58, nameBytes.length);
          packet.set(digests[index], 60); packet.set(nameBytes, MANIFEST_BYTES);
        }
        packet.set(innerBytes, headerLength);
        return appendCrc(packet);
      } finally { innerBytes.fill(0); }
    }
    return {
      descriptor, version: VERSION, id: descriptor.id, name: descriptor.name, size: descriptor.size,
      segmentBytes: SEGMENT_BYTES, segmentCount: descriptor.segmentCount, chunkBytes,
      async loadSegment(index) {
        ensureLive(); checkIndex(index, descriptor.segmentCount);
        const token = ++generation;
        activeTransfer?.dispose(); activeTransfer = null;
        let bytes, inner;
        const current = () => { ensureLive(); if (token !== generation) throw fail('CANCELLED', 'Wybrano inny segment.', true); };
        try {
          bytes = await readSegment(index); current();
          inner = await root.WGResilient.createTransfer(bytes, INNER_NAME, { chunkBytes, compact: true });
          current();
          if (inner.digest !== hex(digests[index])) throw fail('FILE_CHANGED', 'Zawartość pliku zmieniła się po przygotowaniu transferu.');
          let released = false;
          const check = () => { ensureLive(); if (released) throw fail('TRANSFER_DISPOSED', 'Ten segment został zwolniony.', true); };
          const transfer = { version: VERSION, descriptor, segmentIndex: index, id: descriptor.id,
            name: descriptor.name, size: inner.size, total: inner.total, blockCount: inner.blockCount,
            chunkBytes, digest: inner.digest, manifestInterval: 16,
            manifestFrame() { check(); return wrap(inner.manifestFrame(), index, true); },
            frame(sourceIndex) { check(); return wrap(inner.frame(sourceIndex), index, false); },
            repairFrame(blockIndex, serial) { check(); return wrap(inner.repairFrame(blockIndex, serial), index, false); },
            dispose() { if (!released) { released = true; inner.dispose(); if (activeTransfer === transfer) activeTransfer = null; } }
          };
          activeTransfer = transfer;
          return transfer;
        } catch (error) { inner?.dispose(); throw error; }
        finally { bytes?.fill(0); }
      },
      acceptFeedback(bytes) {
        ensureLive();
        const feedback = parseFeedback(bytes);
        if (feedback.id !== descriptor.id || feedback.size !== descriptor.size || feedback.segmentCount !== descriptor.segmentCount) {
          throw fail('FEEDBACK_SESSION_MISMATCH', 'Ten kod dotyczy innego dużego pliku.');
        }
        return { complete: feedback.complete, missingSegments: feedback.missingSegments, suggestedRate: feedback.suggestedRate };
      },
      dispose() {
        if (disposed) return;
        disposed = true; generation++;
        activeTransfer?.dispose(); activeTransfer = null;
        for (const digest of digests) digest.fill(0);
        idBytes.fill(0); nameBytes.fill(0); file = null;
      }
    };
  }

  function createCollector({ store, onProgress } = {}) {
    if (!store || !['begin', 'putSegment', 'finish', 'file'].every(name => typeof store[name] === 'function')
      || (onProgress !== undefined && typeof onProgress !== 'function') || !root.WGResilient?.createCollector) {
      throw fail('INVALID_STORE', 'Duży odbiór wymaga magazynu pliku.');
    }
    let active = null, epoch = 0, disposed = false;
    function durable() {
      const state = store.state;
      if (!state?.descriptor) return null;
      const descriptor = descriptorCopy(state.descriptor);
      if (!Array.isArray(state.completed) || state.completed.length !== descriptor.segmentCount
        || state.completed.some(value => typeof value !== 'boolean')
        || !Array.isArray(state.digests) || state.digests.length !== descriptor.segmentCount
        || state.digests.some((value, index) => state.completed[index] && (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)))) {
        throw fail('INVALID_STORE', 'Nieprawidłowy zapis postępu dużego transferu.');
      }
      let savedBytes = 0, completedSegments = 0;
      for (let index = 0; index < descriptor.segmentCount; index++) {
        if (state.completed[index]) { savedBytes += segmentSize(descriptor, index); completedSegments++; }
      }
      return { descriptor, completed: state.completed, digests: state.digests, savedBytes, completedSegments, complete: state.complete === true };
    }
    function snapshot() {
      const saved = durable(), descriptor = active?.descriptor || saved?.descriptor;
      if (!descriptor) return null;
      if (saved && !sameDescriptor(descriptor, saved.descriptor)) throw fail('STORE_CONFLICT', 'Magazyn zawiera inny duży plik.');
      const inner = active?.inner?.state;
      const currentSegment = active?.segmentIndex ?? null;
      const length = currentSegment === null ? 0 : segmentSize(descriptor, currentSegment);
      const savedBytes = saved?.savedBytes || 0;
      return { ...descriptor, descriptor, completedSegments: saved?.completedSegments || 0,
        savedBytes, receivedBytes: savedBytes,
        pendingBytes: inner ? Math.min(length, inner.received * inner.chunkBytes) : 0,
        currentSegment, segmentSize: length, chunkBytes: active?.chunkBytes ?? null,
        received: inner?.received || 0, total: inner?.total || 0, recovered: inner?.recovered || 0,
        complete: Boolean(active?.verified && saved?.complete), packetType: active?.packetType || 'unknown' };
    }
    function current(session, token) {
      if (disposed || token !== epoch || session !== active) throw fail('TRANSFER_RESET', 'Odbiór dużego pliku został przerwany.', true);
    }
    function releaseInner(session) {
      session?.inner?.dispose();
      if (session) { session.inner = null; session.innerId = null; session.segmentIndex = null; session.chunkBytes = null; }
    }
    function newSession(descriptor) {
      return { descriptor, inner: null, innerId: null, segmentIndex: null, chunkBytes: null,
        verified: false, file: null, packetType: 'unknown', known: new Array(descriptor.segmentCount).fill(null) };
    }
    async function finish(session, token) {
      const saved = durable();
      if (!saved || saved.completedSegments !== session.descriptor.segmentCount) return null;
      current(session, token);
      if (session.verified && saved.complete) return session.file || await store.file();
      const digests = saved.digests.map(unhex);
      let digest;
      try {
        digest = await rootDigest(session.descriptor, digests);
        current(session, token);
        if (hex(digest) !== session.descriptor.id) throw fail('ROOT_MISMATCH', 'Sumy segmentów nie pasują do opisu dużego pliku.');
      } finally { digest?.fill(0); digests.forEach(value => value.fill(0)); }
      current(session, token);
      const file = saved.complete ? await store.file() : await store.finish({ onProgress: progress => {
        if (!disposed && token === epoch && session === active) onProgress?.(progress);
      } });
      current(session, token);
      if (!file || file.size !== session.descriptor.size || typeof file.slice !== 'function') {
        throw fail('INVALID_STORE', 'Zapisany plik ma nieprawidłowy rozmiar.');
      }
      session.verified = true; session.file = file;
      releaseInner(session);
      return file;
    }
    async function accept(input) {
      if (disposed) throw fail('TRANSFER_DISPOSED', 'Odbiornik dużego pliku został zamknięty.', true);
      if (!isBytes(input)) throw fail('INVALID_INPUT', 'Oczekiwano bajtów kodu QR.');
      // Copy only one bounded optical packet; callers retain ownership of input.
      if (input.length > HEADER_BYTES + 640 + 4) throw fail('MALFORMED_FRAME', 'Kod dużego transferu jest za długi.');
      const bytes = new Uint8Array(input);
      let completedBytes;
      try {
        const packet = parseFrame(bytes), token = epoch;
        const savedBefore = durable(), descriptor = active?.descriptor || savedBefore?.descriptor;
        if (descriptor && descriptor.id !== packet.id) {
          return { kind: 'foreign', ...snapshot(), foreignId: packet.id, packetType: packet.packetType };
        }
        if (packet.manifest && descriptor && !sameDescriptor(descriptor, packet.descriptor)) {
          throw fail('METADATA_CONFLICT', 'Ten sam identyfikator zawiera inny opis dużego pliku.');
        }
        if (descriptor) checkIndex(packet.segmentIndex, descriptor.segmentCount);
        if (!active) {
          if (!packet.manifest) return { kind: 'pending', version: VERSION, id: packet.id,
            segmentIndex: packet.segmentIndex, reason: 'manifest', packetType: packet.packetType };
          const session = newSession(packet.descriptor);
          session.packetType = 'manifest';
          active = session;
          try { await store.begin(packet.descriptor); current(session, token); }
          catch (error) { if (active === session && token === epoch) active = null; throw error; }
        }
        const session = active;
        current(session, token);
        checkIndex(packet.segmentIndex, session.descriptor.segmentCount);
        session.packetType = packet.packetType;
        const saved = durable();
        if (!saved || !sameDescriptor(saved.descriptor, session.descriptor)) throw fail('INVALID_STORE', 'Nie rozpoczęto zapisu dużego pliku.');
        if (packet.manifest) {
          const expected = saved.completed[packet.segmentIndex] ? saved.digests[packet.segmentIndex] : session.known[packet.segmentIndex];
          if (expected && expected !== packet.digest) throw fail('METADATA_CONFLICT', 'Zmieniono sumę segmentu w tej samej serii.');
          session.known[packet.segmentIndex] = packet.digest;
        }
        if (saved.completed[packet.segmentIndex]) {
          const file = await finish(session, token); current(session, token);
          return file ? { kind: 'complete', ...snapshot(), file, packetType: packet.packetType }
            : { kind: 'progress', ...snapshot(), segmentIndex: packet.segmentIndex, segmentComplete: true, duplicate: true, packetType: packet.packetType };
        }
        if (!packet.manifest && (session.segmentIndex !== packet.segmentIndex || session.innerId !== packet.innerId)) {
          return { kind: 'pending', ...snapshot(), segmentIndex: packet.segmentIndex, reason: 'manifest', packetType: packet.packetType };
        }
        if (packet.manifest && (session.segmentIndex !== packet.segmentIndex || session.innerId !== packet.innerId)) {
          releaseInner(session);
          session.inner = root.WGResilient.createCollector(); session.innerId = packet.innerId;
          session.segmentIndex = packet.segmentIndex; session.chunkBytes = packet.chunkBytes;
        }
        const result = await session.inner.accept(packet.inner);
        if (result.kind === 'complete') completedBytes = result.bytes;
        current(session, token);
        if (result.kind !== 'complete') return { kind: result.kind === 'manifest' ? 'manifest' : 'progress',
          ...snapshot(), segmentIndex: packet.segmentIndex, duplicate: Boolean(result.duplicate), packetType: packet.packetType };
        const index = packet.segmentIndex, digest = session.known[index];
        if (!digest) throw fail('INVALID_DIGEST', 'Brakuje sumy ukończonego segmentu.');
        onProgress?.({ phase: 'write', segmentIndex: index, completedBytes: saved.savedBytes, totalBytes: session.descriptor.size });
        await store.putSegment(index, completedBytes, digest);
        current(session, token);
        releaseInner(session);
        const file = await finish(session, token); current(session, token);
        return file ? { kind: 'complete', ...snapshot(), file, segmentIndex: index, segmentComplete: true, packetType: packet.packetType }
          : { kind: 'progress', ...snapshot(), segmentIndex: index, segmentComplete: true, duplicate: false, packetType: packet.packetType };
      } finally { bytes.fill(0); completedBytes?.fill(0); }
    }
    return {
      accept,
      async resume() {
        if (disposed) throw fail('TRANSFER_DISPOSED', 'Odbiornik dużego pliku został zamknięty.', true);
        const saved = durable();
        if (!saved) return null;
        if (!active) active = newSession(saved.descriptor);
        if (!sameDescriptor(active.descriptor, saved.descriptor)) throw fail('STORE_CONFLICT', 'Magazyn zawiera inny duży plik.');
        const session = active, token = epoch;
        const file = await finish(session, token); current(session, token);
        return file ? { kind: 'complete', ...snapshot(), file, resumed: true }
          : { kind: 'progress', ...snapshot(), resumed: true };
      },
      get state() { return disposed ? null : snapshot(); },
      createFeedback(options = {}) {
        if (disposed || !options || typeof options !== 'object') throw fail('INVALID_INPUT', 'Nieprawidłowe potwierdzenie dużego transferu.');
        const suggestedRate = options.suggestedRate === undefined ? 2 : options.suggestedRate;
        if (!RATES.includes(suggestedRate)) throw fail('INVALID_INPUT', 'Nieprawidłowe sugerowane tempo.');
        const saved = durable(), state = snapshot();
        if (!saved || !state) throw fail('NO_TRANSFER', 'Najpierw odbierz opis dużego pliku.');
        const bitmapLength = Math.ceil(saved.descriptor.segmentCount / 8);
        const bytes = new Uint8Array(ACK_BYTES + bitmapLength + 4), view = new DataView(bytes.buffer);
        bytes.set(ACK_MAGIC); bytes[8] = VERSION; bytes[9] = state.complete ? 1 : 0; bytes[10] = suggestedRate;
        bytes.set(unhex(saved.descriptor.id), 12);
        view.setUint32(44, saved.descriptor.size); view.setUint32(48, SEGMENT_BYTES);
        view.setUint16(52, saved.descriptor.segmentCount); view.setUint16(54, bitmapLength);
        for (let index = 0; index < saved.completed.length; index++) if (saved.completed[index]) bytes[ACK_BYTES + (index >>> 3)] |= 1 << (index & 7);
        return appendCrc(bytes);
      },
      reset() { if (!disposed) { epoch++; releaseInner(active); active = null; } },
      dispose() { if (!disposed) { disposed = true; epoch++; releaseInner(active); active = null; } }
    };
  }

  root.WGLarge = Object.freeze({ VERSION, MAX_FILE_BYTES, SEGMENT_BYTES, MAX_SEGMENTS,
    isFrame, isFeedback, isReserved, parseFrame, parseFeedback, createSender, createCollector });
})(typeof window !== 'undefined' ? window : globalThis);
