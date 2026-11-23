/* Presentation model for a calibration snapshot. No DOM, clocks or I/O. */
(function (root) {
  'use strict';

  function create({ encodeBytes = root.WGQR?.encodeBytes } = {}) {
    let sessionKey = null;
    const densities = new Map();

    function reset() { sessionKey = null; densities.clear(); }

    function density(chunkBytes, state) {
      // CAL uses the same byte-mode QR encoding as a data packet. Header/CRC
      // consume 40 bytes; large transfers reserve another 52 bytes. The core
      // encoder determines the actual QR version, including the chosen ECC.
      const payloadBytes = chunkBytes + 40 + (state.large ? 52 : 0);
      const key = `${payloadBytes}/${state.ecc}`;
      if (!densities.has(key)) {
        if (typeof encodeBytes !== 'function') throw new Error('Brak kodera do wyznaczenia rozmiaru QR.');
        const payload = new Uint8Array(payloadBytes);
        let qr;
        try {
          qr = encodeBytes(payload, { errorCorrectionLevel: state.ecc });
          densities.set(key, { chunkBytes, payloadBytes, modules: qr.size, qrVersion: qr.version });
        } finally {
          payload.fill(0);
          qr?.data?.fill(0);
        }
      }
      // Never expose a cache entry: consumers may retain or modify a model.
      return { ...densities.get(key) };
    }

    function compute(state, { fromImages = false } = {}) {
      if (!state) { reset(); return null; }
      const results = state.results;
      const plan = results.map(result => `${result.grid.columns}x${result.grid.rows}/${result.chunkBytes}/${result.fps}`).join(',');
      const key = [state.id, state.version, state.ecc, Number(state.large), Number(state.extended),
        Number(state.compareLayouts), plan].join('|');
      if (sessionKey !== key) { reset(); sessionKey = key; }

      const setup = Boolean(state.setup && !state.ended);
      const phase = state.ended ? 'finished' : setup ? 'setup'
        : state.phase === 'alignment' ? 'settling' : 'measuring';
      const boundary = setup ? -1 : Math.max(state.currentIndex, state.latestMeasurementIndex ?? -1);
      const counts = { pending: 0, running: 0, passed: 0, failed: 0 };
      const groupsBySize = new Map();
      let current = null;

      for (const result of results) {
        const size = density(result.chunkBytes, state);
        const closed = Boolean(state.ended || result.index < boundary);
        const active = !state.ended && result.index === state.currentIndex;
        const complete = result.expected > 0 && result.received === result.expected && result.steps >= 3
          && result.perSecond.length === 4
          && result.perSecond.every(window => window.expected > 0 && window.received === window.expected);
        const status = closed ? complete ? 'passed' : 'failed'
          : active && phase === 'measuring' ? 'running' : 'pending';
        const cell = { ...size, index: result.index, fps: result.fps,
          grid: { ...result.grid }, lanes: result.lanes, state: status, active, closed,
          expected: result.expected, received: result.received, missing: result.missing, coverage: result.coverage,
          bytesPerSecond: fromImages ? null : result.bytesPerSecond,
          minBytesPerSecond: fromImages ? null : result.minBytesPerSecond,
          maxBytesPerSecond: fromImages ? null : result.maxBytesPerSecond,
          perSecond: result.perSecond.map(window => ({ ...window, bytesPerSecond: fromImages ? null : window.bytesPerSecond })) };
        counts[status]++;
        if (result.index === state.currentIndex) current = { ...cell, grid: { ...cell.grid }, phase };

        let group = groupsBySize.get(result.chunkBytes);
        if (!group) {
          group = { ...size, frequencies: [], layouts: [] };
          groupsBySize.set(result.chunkBytes, group);
        }
        if (!group.frequencies.includes(result.fps)) group.frequencies.push(result.fps);
        const layoutKey = `${result.grid.columns}x${result.grid.rows}`;
        let layout = group.layouts.find(item => item.key === layoutKey);
        if (!layout) {
          layout = { key: layoutKey, grid: { ...result.grid }, lanes: result.lanes, cells: [] };
          group.layouts.push(layout);
        }
        layout.cells.push(cell);
      }

      const groups = Array.from(groupsBySize.values()).sort((a, b) => a.chunkBytes - b.chunkBytes);
      for (const group of groups) {
        group.frequencies.sort((a, b) => a - b);
        for (const layout of group.layouts) layout.cells.sort((a, b) => a.fps - b.fps);
      }
      // A phase-only cache misses reads arriving within the same profile. The
      // revision also tracks every fixed one-second window, without a clock.
      const revision = [key, Number(fromImages), phase, state.currentIndex, state.latestMeasurementIndex,
        state.progress, ...results.map(result => [result.received, ...result.perSecond.map(window => window.received)].join('/'))].join('|');
      return { key, revision, phase, setup, ended: Boolean(state.ended), fromImages: Boolean(fromImages),
        rateVerified: !fromImages, current, counts, groups, totalProfiles: state.totalProfiles,
        measuredProfiles: state.measuredProfiles, progress: state.progress };
    }

    return Object.freeze({ compute, reset });
  }

  root.WGCalibrationView = Object.freeze({ create });
})(typeof window !== 'undefined' ? window : globalThis);
