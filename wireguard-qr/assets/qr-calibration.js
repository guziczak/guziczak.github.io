/* Synthetic optical calibration. No file data, persistent storage or networking. */
(function (root) {
  'use strict';
  const CAL = new TextEncoder().encode('WGQR-CAL');
  const SET = new TextEncoder().encode('WGQR-SET');
  const DURATION = 4000;
  const PROFILES = Object.freeze([384, 600].flatMap(chunkBytes =>
    [2, 5, 10].map(fps => Object.freeze({ chunkBytes, fps }))));
  const equal = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const bytes = value => ArrayBuffer.isView(value) && Object.prototype.toString.call(value) === '[object Uint8Array]';
  const starts = (value, magic) => bytes(value) && value.length >= 8 && equal(value.subarray(0, 8), magic);
  const hex = value => Array.from(value, byte => byte.toString(16).padStart(2, '0')).join('');
  function fail(message) { const error = new Error(message); error.code = 'CALIBRATION_INVALID'; return error; }
  function checksum(value) {
    let crc = 0xffffffff;
    for (const byte of value) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  function seal(value) {
    new DataView(value.buffer, value.byteOffset, value.byteLength).setUint32(value.length - 4, checksum(value.subarray(0, -4)));
    return value;
  }
  function checked(value) {
    if (!bytes(value) || value.length < 40) throw fail('Niepełny kod próby.');
    const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
    if (view.getUint32(value.length - 4) !== checksum(value.subarray(0, -4))) throw fail('Uszkodzony kod próby.');
    if (value[8] !== 1) throw fail('Nieobsługiwana wersja próby.');
    return view;
  }
  function parse(value) {
    if (!starts(value, CAL)) return null;
    if (![40, 424, 640].includes(value.length)) throw fail('Nieprawidłowy rozmiar próby.');
    const view = checked(value);
    const index = value[10], lanes = value[11], ended = Boolean(value[9] & 1);
    if ((value[9] & ~3) || index >= PROFILES.length || ![1, 2].includes(lanes)
      || view.getUint16(32) !== DURATION || value[34] > 1 || value[35] > 2) throw fail('Nieprawidłowy profil próby.');
    const profile = PROFILES[index];
    const sequence = view.getUint16(28);
    if (view.getUint16(30) !== 0 || value[34] !== (profile.chunkBytes === 600 ? 1 : 0)
      || value[35] !== [2, 5, 10].indexOf(profile.fps)
      || value.length !== (ended ? 40 : profile.chunkBytes + 40)
      || (!ended && sequence >= profile.fps * (DURATION / 1000) * lanes)
      || (ended && (sequence !== 65535 || index !== PROFILES.length - 1))) throw fail('Nieprawidłowa ramka próby.');
    return { index, lanes, ended, sequence, ...profile, ecc: value[9] & 2 ? 'L' : 'M', id: hex(value.subarray(12, 28)), idBytes: value.subarray(12, 28) };
  }
  function create({ lanes = 1, ecc = 'M' } = {}) {
    if (![1, 2].includes(lanes) || !['M', 'L'].includes(ecc)) throw fail('Nieprawidłowe ustawienia próby.');
    if (typeof root.crypto?.getRandomValues !== 'function') throw fail('Próba wymaga generatora losowego.');
    const idBytes = root.crypto.getRandomValues(new Uint8Array(16));
    const id = hex(idBytes);
    let disposed = false;
    function frame(index, sequence = 0, ended = false) {
      if (disposed || !Number.isInteger(index) || index < 0 || index >= PROFILES.length) throw fail('Próba jest niedostępna.');
      const profile = PROFILES[index];
      if (typeof ended !== 'boolean' || (ended && index !== PROFILES.length - 1)) throw fail('Nieprawidłowy koniec próby.');
      if (!ended && (!Number.isInteger(sequence) || sequence < 0 || sequence >= profile.fps * DURATION / 1000 * lanes)) throw fail('Nieprawidłowy numer próby.');
      const value = new Uint8Array(ended ? 40 : profile.chunkBytes + 40);
      const view = new DataView(value.buffer);
      value.set(CAL); value[8] = 1; value[9] = (ended ? 1 : 0) | (ecc === 'L' ? 2 : 0);
      value[10] = index; value[11] = lanes; value.set(idBytes, 12);
      view.setUint16(28, ended ? 65535 : sequence); view.setUint16(32, DURATION);
      value[34] = profile.chunkBytes === 600 ? 1 : 0; value[35] = [2, 5, 10].indexOf(profile.fps);
      let seed = ((index + 1) * 0x9e3779b1 + sequence) >>> 0;
      for (let i = 36; i < value.length - 4; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; value[i] = seed & 255; }
      return seal(value);
    }
    function acceptFeedback(value) {
      if (disposed || !starts(value, SET) || value.length !== 40) throw fail('To nie jest wynik próby.');
      const view = checked(value);
      if (value[9] >= PROFILES.length || value[10] !== lanes || value[11] !== (ecc === 'L' ? 1 : 0)
        || !equal(value.subarray(12, 28), idBytes)
        || value.subarray(32, 36).some(Boolean)) throw fail('Wynik dotyczy innej próby.');
      const profile = PROFILES[value[9]];
      const samples = view.getUint16(28);
      if (samples < 3 || samples > profile.fps * DURATION / 1000 * lanes
        || view.getUint16(30) !== Math.round(samples * profile.chunkBytes * 1000 / DURATION)) {
        throw fail('Nieprawidłowa liczba lub szybkość odczytów.');
      }
      return { ...profile, lanes, ecc, bytesPerSecond: view.getUint16(30), samples };
    }
    return { id, lanes, ecc, profiles: PROFILES, duration: DURATION, frame,
      endFrame: () => frame(PROFILES.length - 1, 0, true), acceptFeedback,
      dispose() { disposed = true; idBytes.fill(0); } };
  }
  function createObserver() {
    let active = null;
    function reset() { if (active) active.idBytes.fill(0); active = null; }
    function snapshot() {
      if (!active) return null;
      const results = active.records.map((record, index) => {
        const profile = PROFILES[index];
        // Count the whole fixed observation period, including missed symbols.
        // A partial first profile after a late join is intentionally conservative.
        const rate = record.seen.size * profile.chunkBytes * 1000 / DURATION;
        return { ...profile, index, samples: record.seen.size, steps: record.steps.size,
          bytesPerSecond: Math.min(profile.chunkBytes * profile.fps * active.lanes, rate) };
      });
      const candidates = active.ended ? results.filter(result => result.steps >= 3) : [];
      const best = candidates.sort((a, b) => b.bytesPerSecond - a.bytesPerSecond || a.fps - b.fps)[0] || null;
      return { id: active.id, lanes: active.lanes, ecc: active.ecc, ended: active.ended,
        progress: active.ended ? 100 : Math.min(99, Math.round(active.progress * 100)), results, best };
    }
    function accept(value, now) {
      const frame = parse(value);
      if (!frame) return null;
      if (!Number.isFinite(now) || now < 0) throw fail('Nieprawidłowy czas próby.');
      if (active && (active.id !== frame.id || active.lanes !== frame.lanes || active.ecc !== frame.ecc)) return { foreign: true, ...snapshot() };
      if (!active) active = { id: frame.id, idBytes: new Uint8Array(frame.idBytes), lanes: frame.lanes, ecc: frame.ecc,
        ended: false, progress: 0, records: PROFILES.map(() => ({ seen: new Set(), steps: new Set() })) };
      if (frame.ended) active.ended = true;
      else if (!active.ended) {
        const record = active.records[frame.index];
        if (!record.seen.has(frame.sequence)) {
          record.seen.add(frame.sequence); record.steps.add(Math.floor(frame.sequence / frame.lanes));
        }
        active.progress = Math.max(active.progress, (frame.index + (frame.sequence + 1) / (frame.fps * DURATION / 1000 * frame.lanes)) / PROFILES.length);
      }
      return snapshot();
    }
    function createFeedback() {
      const state = snapshot();
      if (!state?.ended || !state.best) throw fail('Zbyt mało odczytów. Przeprowadź próbę ponownie.');
      const value = new Uint8Array(40), view = new DataView(value.buffer);
      value.set(SET); value[8] = 1; value[9] = state.best.index; value[10] = state.lanes;
      value[11] = state.ecc === 'L' ? 1 : 0; value.set(active.idBytes, 12);
      view.setUint16(28, state.best.samples); view.setUint16(30, Math.min(65535, Math.round(state.best.bytesPerSecond)));
      return seal(value);
    }
    return { accept, reset, dispose: reset, createFeedback, get state() { return snapshot(); } };
  }
  root.WGCalibration = Object.freeze({ create, createObserver, parse, profiles: PROFILES,
    isFrame: value => starts(value, CAL), isFeedback: value => starts(value, SET),
    isReserved: value => starts(value, CAL) || starts(value, SET) });
})(typeof window !== 'undefined' ? window : globalThis);
