/* Synthetic optical calibration. No file data, persistent storage or networking. */
(function (root) {
  'use strict';
  const CAL = new TextEncoder().encode('WGQR-CAL');
  const SET = new TextEncoder().encode('WGQR-SET');
  const DURATION = 4000;
  const PROFILES = Object.freeze([384, 600].flatMap(chunkBytes =>
    [2, 5, 10].map(fps => Object.freeze({ chunkBytes, fps }))));
  const RATES = Object.freeze([2, 5, 10, 15, 20]);
  const FAST_PROFILES = Object.freeze([...PROFILES, ...[384, 600].flatMap(chunkBytes =>
    [15, 20].map(fps => Object.freeze({ chunkBytes, fps })))]);
  const LIMITS = Object.freeze({ columns: 5, rows: 4, lanes: 20 });
  const GRIDS = Object.freeze(Object.fromEntries([1, 2, 3, 4, 5].flatMap(columns =>
    [1, 2, 3, 4].map(rows => [(columns << 4) | rows, Object.freeze({ columns, rows })]))));
  const COMPARED_GRIDS = Object.freeze([GRIDS[0x11], GRIDS[0x21], GRIDS[0x12], GRIDS[0x22]]);
  const ALL_GRIDS = Object.freeze(Object.values(GRIDS).filter(grid => grid.rows <= 3).sort((a, b) =>
    a.columns * a.rows - b.columns * b.rows || a.columns - b.columns || a.rows - b.rows));
  const isLandscape = grid => grid.columns > grid.rows || (grid.columns === 1 && grid.rows === 1);
  const V5_LANDSCAPE_GRIDS = Object.freeze(ALL_GRIDS.filter(isLandscape));
  const LANDSCAPE_GRIDS = Object.freeze([...V5_LANDSCAPE_GRIDS, GRIDS[0x54]]);
  const LANDSCAPE_COMPARED_GRIDS = Object.freeze([GRIDS[0x11], GRIDS[0x21], GRIDS[0x31], GRIDS[0x32]]);
  const withGrids = (profiles, grids) => Object.freeze(grids.flatMap(grid => profiles.map(profile =>
    Object.freeze({ ...profile, grid, lanes: grid.columns * grid.rows }))));
  const GRID_PROFILES = Object.freeze(Object.fromEntries(Object.entries(GRIDS).map(([key, grid]) =>
    [key, Object.freeze([withGrids(PROFILES, [grid]), withGrids(FAST_PROFILES, [grid])])])));
  const COMPARED_PROFILES = Object.freeze([withGrids(PROFILES, COMPARED_GRIDS), withGrids(FAST_PROFILES, COMPARED_GRIDS)]);
  const ALL_PROFILES = Object.freeze([withGrids(PROFILES, ALL_GRIDS), withGrids(FAST_PROFILES, ALL_GRIDS)]);
  const V5_LANDSCAPE_PROFILES = Object.freeze([
    withGrids(PROFILES, V5_LANDSCAPE_GRIDS), withGrids(FAST_PROFILES, V5_LANDSCAPE_GRIDS)]);
  const LANDSCAPE_PROFILES = Object.freeze([withGrids(PROFILES, LANDSCAPE_GRIDS), withGrids(FAST_PROFILES, LANDSCAPE_GRIDS)]);
  const LANDSCAPE_COMPARED_PROFILES = Object.freeze([
    withGrids(PROFILES, LANDSCAPE_COMPARED_GRIDS), withGrids(FAST_PROFILES, LANDSCAPE_COMPARED_GRIDS)]);
  const packGrid = grid => (grid.columns << 4) | grid.rows;
  function profilesFor(version, extended = false, grid = GRIDS[0x11], compareLayouts = false, allLayouts = false) {
    if (version < 3) return version === 1 ? PROFILES : FAST_PROFILES;
    const all = version === 6 ? LANDSCAPE_PROFILES : version === 5 ? V5_LANDSCAPE_PROFILES : ALL_PROFILES;
    const compared = version >= 5 ? LANDSCAPE_COMPARED_PROFILES : COMPARED_PROFILES;
    return (allLayouts ? all : compareLayouts ? compared : GRID_PROFILES[packGrid(grid)])[Number(extended)];
  }
  const equal = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const bytes = value => ArrayBuffer.isView(value) && Object.prototype.toString.call(value) === '[object Uint8Array]';
  const starts = (value, magic) => bytes(value) && value.length >= 8 && equal(value.subarray(0, 8), magic);
  const hex = value => Array.from(value, byte => byte.toString(16).padStart(2, '0')).join('');
  function fail(message) { const error = new Error(message); error.code = 'CALIBRATION_INVALID'; return error; }
  function gridOf(value) {
    if (!value || typeof value !== 'object' || !Number.isInteger(value.columns) || !Number.isInteger(value.rows)
      || value.columns < 1 || value.columns > LIMITS.columns || value.rows < 1 || value.rows > LIMITS.rows) throw fail('Nieprawidłowa siatka próby.');
    return GRIDS[packGrid(value)];
  }
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
    if (![1, 2, 3, 4, 5, 6].includes(value[8])) throw fail('Nieobsługiwana wersja próby.');
    return view;
  }
  function parse(value) {
    if (!starts(value, CAL)) return null;
    if (![40, 424, 640, 476, 692].includes(value.length)) throw fail('Nieprawidłowy rozmiar próby.');
    const view = checked(value);
    const version = value[8], flags = value[9];
    const compareLayouts = version >= 3 && Boolean(flags & 32);
    const allLayouts = version >= 4 && Boolean(flags & 128);
    const landscapeOnly = version >= 5;
    const extended = version === 2 || (version >= 3 && Boolean(flags & 16));
    const alignment = version >= 3 && Boolean(flags & 8);
    const setup = version >= 3 && Boolean(flags & 64);
    const grid = version >= 3 ? GRIDS[value[11]] : GRIDS[(value[11] << 4) | 1];
    if ((flags & ~(version >= 4 ? 255 : version === 3 ? 127 : 7)) || !grid || (setup && !alignment)
      || (version < 4 && grid.columns > 3) || (version < 6 && grid.rows > 3) || (allLayouts && compareLayouts)
      || (landscapeOnly && !isLandscape(grid))
      || (version < 3 && ![1, 2].includes(value[11]))) {
      throw fail('Nieprawidłowa siatka próby.');
    }
    const profiles = profilesFor(version, extended, grid, compareLayouts, allLayouts);
    const index = value[10], lanes = grid.columns * grid.rows, ended = Boolean(flags & 1), large = Boolean(flags & 4);
    if (index >= profiles.length || (alignment && ended)
      || view.getUint16(32) !== DURATION || value[34] > 1 || value[35] >= (version === 1 ? 3 : RATES.length)) throw fail('Nieprawidłowy profil próby.');
    const profile = profiles[index];
    const sequence = view.getUint16(28);
    if ((version >= 3 && packGrid(profile.grid) !== packGrid(grid))
      || view.getUint16(30) !== 0 || value[34] !== (profile.chunkBytes === 600 ? 1 : 0)
      || value[35] !== RATES.indexOf(profile.fps)
      || value.length !== (ended || (version >= 4 && setup) ? 40 : profile.chunkBytes + 40 + (large ? 52 : 0))
      || (!ended && sequence >= (alignment ? lanes : profile.fps * (DURATION / 1000) * lanes))
      || (ended && (sequence !== 65535 || index !== profiles.length - 1))) throw fail('Nieprawidłowa ramka próby.');
    return { version, index, lanes, grid, compareLayouts, allLayouts, landscapeOnly, extended, alignment, setup, ended, large, sequence, ...profile,
      slot: ended ? null : sequence % lanes, step: ended || alignment ? null : Math.floor(sequence / lanes),
      window: ended || alignment ? null : Math.floor(sequence / (profile.fps * lanes)),
      ecc: flags & 2 ? 'L' : 'M', id: hex(value.subarray(12, 28)), idBytes: value.subarray(12, 28) };
  }
  function create({ lanes = 1, ecc = 'M', extended = false, large = false, grid,
    compareLayouts = false, allLayouts = false, landscapeOnly = false } = {}) {
    if (![1, 2].includes(lanes) || !['M', 'L'].includes(ecc) || typeof extended !== 'boolean'
      || typeof large !== 'boolean' || typeof compareLayouts !== 'boolean' || typeof allLayouts !== 'boolean'
      || typeof landscapeOnly !== 'boolean'
      || (allLayouts && compareLayouts)) throw fail('Nieprawidłowe ustawienia próby.');
    if (typeof root.crypto?.getRandomValues !== 'function') throw fail('Próba wymaga generatora losowego.');
    const requestedGrid = grid === undefined ? GRIDS[0x11] : gridOf(grid);
    if (landscapeOnly && !allLayouts && !compareLayouts && !isLandscape(requestedGrid)) throw fail('Próba wymaga siatki poziomej albo 1×1.');
    if (!landscapeOnly && !allLayouts && !compareLayouts && requestedGrid.rows > 3) throw fail('Cztery wiersze wymagają poziomej próby.');
    const version = landscapeOnly ? 6 : allLayouts || (!compareLayouts && requestedGrid.columns > 3) ? 4
      : grid !== undefined || compareLayouts ? 3 : extended ? 2 : 1;
    const profiles = profilesFor(version, extended, requestedGrid, compareLayouts, allLayouts);
    const alignmentLanes = version >= 3 ? Math.max(...profiles.map(profile => profile.lanes)) : lanes;
    const alignmentIndex = version >= 3 ? profiles.findIndex(profile => profile.lanes === alignmentLanes) : 0;
    const idBytes = root.crypto.getRandomValues(new Uint8Array(16));
    const id = hex(idBytes);
    let disposed = false;
    function makeFrame(index, sequence, ended, alignment = false, setup = false) {
      if (disposed || !Number.isInteger(index) || index < 0 || index >= profiles.length) throw fail('Próba jest niedostępna.');
      const profile = profiles[index];
      const profileLanes = profile.lanes || lanes;
      if (typeof ended !== 'boolean' || (ended && index !== profiles.length - 1)) throw fail('Nieprawidłowy koniec próby.');
      if (!ended && (!Number.isInteger(sequence) || sequence < 0
        || sequence >= (alignment ? profileLanes : profile.fps * DURATION / 1000 * profileLanes))) throw fail('Nieprawidłowy numer próby.');
      const value = new Uint8Array(ended || (version >= 4 && setup) ? 40 : profile.chunkBytes + 40 + (large ? 52 : 0));
      const view = new DataView(value.buffer);
      value.set(CAL); value[8] = version;
      value[9] = (ended ? 1 : 0) | (ecc === 'L' ? 2 : 0) | (large ? 4 : 0)
        | (alignment ? 8 : 0) | (version >= 3 && extended ? 16 : 0) | (compareLayouts ? 32 : 0) | (setup ? 64 : 0)
        | (allLayouts ? 128 : 0);
      value[10] = index; value[11] = version >= 3 ? packGrid(profile.grid) : lanes; value.set(idBytes, 12);
      view.setUint16(28, ended ? 65535 : sequence); view.setUint16(32, DURATION);
      value[34] = profile.chunkBytes === 600 ? 1 : 0; value[35] = RATES.indexOf(profile.fps);
      let seed = ((index + 1) * 0x9e3779b1 + sequence) >>> 0;
      for (let i = 36; i < value.length - 4; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; value[i] = seed & 255; }
      return seal(value);
    }
    function frame(index, sequence = 0, ended = false) { return makeFrame(index, sequence, ended); }
    function alignmentFrame(lane = 0, index = alignmentIndex, setup = false) {
      if (version < 3 || typeof setup !== 'boolean') throw fail('Nieprawidłowe ustawianie siatki próby.');
      return makeFrame(index, lane, false, true, setup);
    }
    function acceptFeedback(value) {
      if (disposed || !starts(value, SET) || value.length !== 40) throw fail('To nie jest wynik próby.');
      const view = checked(value);
      const profile = profiles[value[9]];
      if (value[8] !== version || !profile
        || value[10] !== (version >= 3 ? packGrid(profile.grid) : lanes)
        || value[11] !== ((ecc === 'L' ? 1 : 0) | (large ? 2 : 0) | (compareLayouts ? 4 : 0)
          | (version >= 3 && extended ? 8 : 0) | (allLayouts ? 16 : 0))
        || !equal(value.subarray(12, 28), idBytes)
        || (version < 3 && value.subarray(32, 36).some(Boolean))) throw fail('Wynik dotyczy innej próby.');
      const profileLanes = profile.lanes || lanes;
      const samples = view.getUint16(28);
      const expected = profile.fps * DURATION / 1000 * profileLanes;
      const bytesPerSecond = version >= 3 ? view.getUint32(30) : view.getUint16(30);
      const steps = version >= 3 ? view.getUint16(34) : null;
      if (samples < 3 || samples > expected
        || bytesPerSecond !== Math.round(samples * profile.chunkBytes * 1000 / DURATION)
        || (version >= 3 && (samples !== expected || steps !== profile.fps * DURATION / 1000))) {
        throw fail('Nieprawidłowa liczba lub szybkość odczytów.');
      }
      return { ...profile, lanes: profileLanes, ecc, large, bytesPerSecond, samples, allLayouts, landscapeOnly,
        ...(version >= 3 ? { steps, compareLayouts, extended } : {}) };
    }
    return { id, version, lanes: version >= 3 ? alignmentLanes : lanes, ecc, large, extended, compareLayouts, allLayouts, landscapeOnly,
      profiles, duration: DURATION, alignmentLanes, alignmentIndex, frame, alignmentFrame,
      endFrame: () => makeFrame(profiles.length - 1, 0, true), acceptFeedback,
      dispose() { disposed = true; idBytes.fill(0); } };
  }
  function createObserver() {
    let active = null;
    function reset() { if (active) active.idBytes.fill(0); active = null; }
    function snapshot() {
      if (!active) return null;
      const results = active.records.map((record, index) => {
        const profile = active.profiles[index];
        const lanes = profile.lanes || active.lanes;
        const expected = profile.fps * DURATION / 1000 * lanes;
        // Sequence numbers describe the sender's four fixed one-second windows.
        // Repeated or late reads cannot invent throughput or shift a lost frame
        // into a different window. Alignment has no sequence in these records.
        const perSecond = record.perSecond.map((received, window) => ({ index: window,
          expected: profile.fps * lanes, received, missing: profile.fps * lanes - received,
          coverage: received * 100 / (profile.fps * lanes), bytesPerSecond: received * profile.chunkBytes }));
        // Count the whole fixed observation period, including missed symbols.
        // A partial first profile after a late join is intentionally conservative.
        const rate = record.seen.size * profile.chunkBytes * 1000 / DURATION;
        return { ...profile, grid: profile.grid || active.planGrid, lanes, index,
          samples: record.seen.size, steps: record.steps.size, expected, received: record.seen.size,
          missing: expected - record.seen.size, coverage: record.seen.size * 100 / expected,
          perSecond, minBytesPerSecond: Math.min(...perSecond.map(window => window.bytesPerSecond)),
          maxBytesPerSecond: Math.max(...perSecond.map(window => window.bytesPerSecond)),
          stable: record.seen.size === expected && record.steps.size >= 3,
          bytesPerSecond: Math.min(profile.chunkBytes * profile.fps * lanes, rate) };
      });
      const candidates = active.ended ? results.filter(result => result.steps >= 3) : [];
      const rank = (a, b) => b.bytesPerSecond - a.bytesPerSecond || a.fps - b.fps || a.lanes - b.lanes || a.index - b.index;
      const fastest = [...candidates].sort(rank)[0] || null;
      const best = (active.version >= 3 ? candidates.filter(result => result.stable) : candidates).sort(rank)[0] || null;
      return { id: active.id, version: active.version, lanes: active.lanes, grid: active.grid,
        currentIndex: active.currentIndex, phase: active.phase, setup: active.setup,
        latestMeasurementIndex: active.latestMeasurementIndex, compareLayouts: active.compareLayouts,
        allLayouts: active.allLayouts, landscapeOnly: active.landscapeOnly, extended: active.extended,
        measuredProfiles: active.records.filter(record => record.seen.size > 0).length, totalProfiles: active.profiles.length,
        ecc: active.ecc, large: active.large, ended: active.ended,
        progress: active.ended ? 100 : Math.min(99, Math.round(active.progress * 100)), results, best, fastest };
    }
    function accept(value, now) {
      const frame = parse(value);
      if (!frame) return null;
      if (!Number.isFinite(now) || now < 0) throw fail('Nieprawidłowy czas próby.');
      if (active && (active.id !== frame.id || active.version !== frame.version
        || active.compareLayouts !== frame.compareLayouts || active.allLayouts !== frame.allLayouts || active.extended !== frame.extended
        || (!active.compareLayouts && !active.allLayouts && packGrid(active.planGrid) !== packGrid(frame.grid))
        || active.ecc !== frame.ecc || active.large !== frame.large)) return { foreign: true, ...snapshot() };
      if (!active) {
        const profiles = profilesFor(frame.version, frame.extended, frame.grid, frame.compareLayouts, frame.allLayouts);
        active = { id: frame.id, version: frame.version, profiles, idBytes: new Uint8Array(frame.idBytes),
          lanes: frame.lanes, grid: frame.grid, planGrid: frame.grid, compareLayouts: frame.compareLayouts,
          allLayouts: frame.allLayouts, landscapeOnly: frame.landscapeOnly, extended: frame.extended,
          currentIndex: frame.index, latestMeasurementIndex: -1, setup: frame.setup, phase: frame.alignment ? 'alignment' : 'measuring',
          ecc: frame.ecc, large: frame.large, ended: false, progress: 0,
          records: profiles.map(() => ({ seen: new Set(), steps: new Set(), perSecond: [0, 0, 0, 0] })) };
      }
      if (active.ended) return snapshot();
      if (frame.alignment) {
        // Setup previews can use the largest grid before profile zero starts.
        // A delayed setup or settling frame cannot rewind the measurement map.
        // Leaving the initial preview may start at any profile, including zero.
        const acceptSetup = frame.setup && active.setup && active.latestMeasurementIndex < 0;
        const acceptSettle = !frame.setup && frame.index > active.latestMeasurementIndex
          && (active.setup || frame.index >= active.currentIndex);
        if (acceptSetup || acceptSettle) {
          active.phase = 'alignment'; active.setup = frame.setup; active.currentIndex = frame.index;
          active.lanes = frame.lanes; active.grid = frame.grid;
        }
      } else if (frame.ended) {
        active.ended = true; active.phase = 'finished'; active.setup = false; active.currentIndex = frame.index;
        active.lanes = frame.lanes; active.grid = frame.grid;
      } else {
        if (active.setup || frame.index >= active.currentIndex) {
          active.phase = 'measuring'; active.setup = false; active.currentIndex = frame.index;
          active.lanes = frame.lanes; active.grid = frame.grid;
        }
        active.latestMeasurementIndex = Math.max(active.latestMeasurementIndex, frame.index);
        const record = active.records[frame.index];
        if (!record.seen.has(frame.sequence)) {
          record.seen.add(frame.sequence); record.steps.add(Math.floor(frame.sequence / frame.lanes));
          record.perSecond[frame.window]++;
        }
        active.progress = Math.max(active.progress, (frame.index + (frame.sequence + 1) / (frame.fps * DURATION / 1000 * frame.lanes)) / active.profiles.length);
      }
      return snapshot();
    }
    function createFeedback() {
      const state = snapshot();
      if (!state?.ended || !state.best) throw fail('Zbyt mało odczytów. Przeprowadź próbę ponownie.');
      const value = new Uint8Array(40), view = new DataView(value.buffer);
      value.set(SET); value[8] = state.version; value[9] = state.best.index;
      value[10] = state.version >= 3 ? packGrid(state.best.grid) : state.lanes;
      value[11] = (state.ecc === 'L' ? 1 : 0) | (state.large ? 2 : 0)
        | (state.compareLayouts ? 4 : 0) | (state.version >= 3 && state.extended ? 8 : 0)
        | (state.allLayouts ? 16 : 0); value.set(active.idBytes, 12);
      view.setUint16(28, state.best.samples);
      if (state.version >= 3) {
        view.setUint32(30, Math.round(state.best.bytesPerSecond));
        view.setUint16(34, state.best.steps);
      } else view.setUint16(30, Math.min(65535, Math.round(state.best.bytesPerSecond)));
      return seal(value);
    }
    return { accept, reset, dispose: reset, createFeedback, get state() { return snapshot(); } };
  }
  root.WGCalibration = Object.freeze({ create, createObserver, parse, profiles: PROFILES, fastProfiles: FAST_PROFILES,
    allGrids: ALL_GRIDS, landscapeGrids: LANDSCAPE_GRIDS, landscapeComparedGrids: LANDSCAPE_COMPARED_GRIDS, limits: LIMITS,
    isFrame: value => starts(value, CAL), isFeedback: value => starts(value, SET),
    isReserved: value => starts(value, CAL) || starts(value, SET) });
})(typeof window !== 'undefined' ? window : globalThis);
