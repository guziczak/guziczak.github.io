/* Bounded, rewindable packet planning for up to nine independent QR symbols. */
(function (root) {
  'use strict';
  function create(transfer, { lanes = 1, startIndex = 0, initialManifest = true, interleave } = {}) {
    if (!transfer || !Number.isSafeInteger(transfer.total) || transfer.total < 1
      || !Number.isSafeInteger(transfer.blockCount) || transfer.blockCount !== Math.ceil(transfer.total / 32)
      || typeof transfer.frame !== 'function' || typeof transfer.repairFrame !== 'function'
      || !Number.isInteger(lanes) || lanes < 1 || lanes > 9 || !Number.isFinite(startIndex) || typeof initialManifest !== 'boolean'
      || (interleave !== undefined && typeof interleave !== 'boolean')) {
      throw new TypeError('Nieprawidłowy plan nadawania.');
    }
    const compact = typeof transfer.manifestFrame === 'function' && transfer.version >= 3;
    const interleaved = interleave === undefined ? compact : interleave;
    const interval = Number.isInteger(transfer.manifestInterval) ? transfer.manifestInterval : 16;
    if ((transfer.version >= 3 && !compact) || interval < 1) throw new TypeError('Nieprawidłowy manifest nadawania.');
    const initialIndex = Math.max(0, Math.min(transfer.total - 1, Math.round(startIndex)));
    const fullBlocks = transfer.blockCount - 1;
    const lastCount = transfer.total - fullBlocks * 32;
    const fullRows = lastCount * transfer.blockCount;
    function sourcePosition(index) {
      if (!interleaved) return index;
      const block = Math.floor(index / 32), local = index % 32;
      return local < lastCount ? local * transfer.blockCount + block
        : fullRows + (local - lastCount) * fullBlocks + block;
    }
    function sourceAt(position) {
      if (!interleaved) return position;
      if (position < fullRows) return (position % transfer.blockCount) * 32 + Math.floor(position / transfer.blockCount);
      const rest = position - fullRows;
      // This branch is unreachable for a single (possibly short) block.
      return (rest % fullBlocks) * 32 + lastCount + Math.floor(rest / fullBlocks);
    }
    let state = { nextSource: initialIndex, sourceCursor: sourcePosition(initialIndex), shown: 0, phase: 'source', repairCursor: 0, serial: 0,
      sinceManifest: initialManifest ? interval : 0, targetCursor: 0,
      repairBlocks: Array.from({ length: transfer.blockCount }, (_, index) => index), targets: [] };
    let generation = 0;
    const checkpoints = new WeakSet();
    const checkpoint = () => {
      const saved = Object.freeze({ generation, ...state,
        repairBlocks: Object.freeze([...state.repairBlocks]), targets: Object.freeze([...state.targets]) });
      checkpoints.add(saved);
      return saved;
    };
    function restore(saved) {
      if (!saved || !checkpoints.has(saved) || saved.generation !== generation) return false;
      state = { ...saved, repairBlocks: [...saved.repairBlocks], targets: [...saved.targets] };
      delete state.generation;
      return true;
    }
    function packet() {
      if (state.phase !== 'source' && !state.repairBlocks.length) return null;
      if (compact && state.sinceManifest >= interval) {
        state.sinceManifest = 0;
        return { key: 'manifest', kind: 'manifest', bytes: transfer.manifestFrame() };
      }
      state.sinceManifest++;
      if (state.shown < transfer.total && state.phase === 'source') {
        const index = state.nextSource;
        state.sourceCursor = (state.sourceCursor + 1) % transfer.total;
        state.nextSource = sourceAt(state.sourceCursor);
        state.shown++;
        return { key: `source:${index}`, kind: 'source', index, bytes: transfer.frame(index) };
      }
      state.phase = 'repair';
      if (state.targetCursor < state.targets.length) {
        const index = state.targets[state.targetCursor++];
        return { key: `source:${index}`, kind: 'target', index, bytes: transfer.frame(index) };
      }
      if (!state.repairBlocks.length) return null;
      const block = state.repairBlocks[state.repairCursor % state.repairBlocks.length];
      state.repairCursor = (state.repairCursor + 1) % state.repairBlocks.length;
      const serial = state.serial++;
      if (serial > 0xffffffff) throw new RangeError('Wyczerpano numery pakietów. Rozpocznij nowy transfer.');
      return { key: `repair:${block}:${serial}`, kind: 'repair', block, serial, bytes: transfer.repairFrame(block, serial) };
    }
    function next() {
      const frames = [];
      for (let lane = 0; lane < lanes; lane++) { const frame = packet(); if (frame) frames.push(frame); }
      return { frames, checkpoint: checkpoint() };
    }
    function applyFeedback(feedback) {
      const blocks = feedback && feedback.missingBlocks;
      if (!Array.isArray(blocks) || blocks.some(index => !Number.isInteger(index) || index < 0 || index >= transfer.blockCount)) {
        throw new TypeError('Nieprawidłowa lista brakujących bloków.');
      }
      if (feedback.complete && blocks.length) throw new TypeError('Nieprawidłowe potwierdzenie końca transferu.');
      if (feedback.repairTargets !== undefined && !Array.isArray(feedback.repairTargets)) {
        throw new TypeError('Nieprawidłowe cele naprawy.');
      }
      const targets = new Set();
      for (const target of feedback.repairTargets || []) {
        if (!target || !blocks.includes(target.blockIndex) || !Array.isArray(target.missingFrames)) continue;
        for (const index of target.missingFrames || []) {
          if (Number.isInteger(index) && index >= 0 && index < transfer.total
            && Math.floor(index / 32) === target.blockIndex) targets.add(index);
        }
      }
      generation++;
      state = { ...state, shown: transfer.total, phase: feedback.complete ? 'complete' : 'repair', repairCursor: 0,
        sinceManifest: interval, targetCursor: 0, repairBlocks: [...new Set(blocks)], targets: [...targets] };
    }
    return { next, checkpoint, restore, applyFeedback, lanes, interleave: interleaved,
      get phase() { return state.phase; }, get targetedCount() { return state.targets.length; } };
  }
  function firstPassDisplays(total, lanes = 1, manifestInterval = 0, initialManifest = true) {
    if (!Number.isSafeInteger(total) || total < 1 || !Number.isInteger(lanes) || lanes < 1 || lanes > 9
      || !Number.isSafeInteger(manifestInterval) || manifestInterval < 0 || typeof initialManifest !== 'boolean') return 0;
    const manifests = manifestInterval > 0
      ? Math.floor((total - 1) / manifestInterval) + (initialManifest ? 1 : 0) : 0;
    return Math.ceil((total + manifests) / lanes);
  }
  root.WGPlayback = Object.freeze({ create, firstPassDisplays });
})(typeof window !== 'undefined' ? window : globalThis);
