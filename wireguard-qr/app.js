(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const MAX_QR_COLUMNS = 5;
  const MAX_QR_ROWS = 3;
  const MAX_QR_CODES = MAX_QR_COLUMNS * MAX_QR_ROWS;
  const MAX_PREPARED_DISPLAYS = 3;
  const MATRIX_CACHE_LIMIT = MAX_QR_CODES * (MAX_PREPARED_DISPLAYS + 1);
  const ui = {};
  [
    'encode-tab', 'decode-tab', 'encode-panel', 'decode-panel', 'clear-all',
    'file-drop', 'file-input', 'choose-file', 'sample-file', 'encode-message',
    'source-details', 'source-name', 'source-size', 'source-format', 'qr-empty',
    'qr-result', 'qr-canvas', 'qr-caption', 'download-qr', 'preview-source',
    'source-preview', 'capacity-note', 'image-drop', 'image-input', 'choose-image',
    'start-camera', 'stop-camera', 'camera-box', 'camera-stage', 'camera-video', 'scan-help',
    'decode-message', 'decoded-empty', 'decoded-result', 'decoded-size',
    'decoded-kind', 'output-name', 'download-file', 'preview-decoded',
    'decoded-preview', 'status-bar', 'transfer-mode', 'series-sample',
    'series-controls', 'animation-toggle', 'previous-frame', 'next-frame',
    'frame-position', 'frame-slider', 'frame-rate', 'transfer-info',
    'download-qr-label', 'receiving-progress', 'receiving-name',
    'receiving-count', 'receiving-progressbar', 'receiving-missing',
    'reset-receiver', 'receiving-help', 'zip-sample', 'zip-details',
    'zip-count', 'zip-entries', 'download-source-zip', 'transfer-estimate',
    'estimate-one', 'estimate-two', 'estimate-five', 'estimate-ten',
    'estimate-one-cell', 'estimate-two-cell', 'estimate-five-cell', 'estimate-ten-cell',
    'qr-density', 'scan-metrics', 'scan-rate', 'scan-latency', 'scan-advice',
    'expand-qr', 'close-expanded', 'show-feedback', 'feedback-canvas',
    'feedback-panel', 'feedback-caption', 'close-feedback', 'resume-receiving',
    'scan-feedback', 'feedback-scan-panel', 'feedback-camera-stage', 'feedback-video', 'stop-feedback-camera',
    'feedback-message', 'feedback-image-input', 'choose-feedback-image',
    'receiving-label', 'transfer-telemetry', 'telemetry-title', 'telemetry-status',
    'telemetry-duration', 'telemetry-speed', 'telemetry-useful', 'telemetry-read',
    'telemetry-detail', 'copy-diagnostics', 'diagnostics-text', 'diagnostics-message',
    'qr-layout', 'series-ecc', 'scan-layout', 'camera-profile', 'qr-pair',
    'qr-paper-second', 'qr-canvas-second', 'dual-layout-hint', 'scan-guides',
    'sender-metrics', 'sender-rate', 'sender-cost', 'frame-rate-label',
    'estimate-one-label', 'estimate-two-label', 'estimate-five-label', 'estimate-ten-label',
    'estimate-fifteen', 'estimate-twenty', 'estimate-fifteen-label', 'estimate-twenty-label',
    'estimate-fifteen-cell', 'estimate-twenty-cell', 'compress-single', 'calibration-range',
    'start-calibration', 'stop-calibration', 'speed-sample', 'calibration-status', 'calibration-panel',
    'calibration-progress', 'calibration-status-receiver', 'calibration-result', 'show-calibration-feedback', 'reset-calibration',
    'large-sender-controls', 'large-segment', 'large-segment-status', 'large-auto', 'large-next', 'large-previous',
    'large-sample', 'enable-large-receiver', 'large-storage-status', 'large-storage-details',
    'large-resume', 'large-delete', 'large-delete-confirm', 'large-delete-cancel', 'large-delete-question', 'large-repair', 'estimate-title',
    'qr-columns', 'qr-rows', 'qr-grid-count', 'scan-columns', 'scan-rows', 'scan-grid-count',
    'begin-calibration', 'calibration-step', 'calibration-layout-scope', 'calibration-duration',
    'calibration-home', 'calibration-setup', 'calibration-display-slot', 'sender-feedback',
    'calibration-alignment', 'alignment-status', 'alignment-detail', 'calibration-results', 'calibration-coverage',
    'receiver-view-file', 'receiver-view-calibration', 'receiver-file-input', 'receiver-file-output',
    'receiver-calibration-dashboard', 'calibration-view-status', 'calibration-current-grid',
    'calibration-current-rate', 'calibration-current-density', 'calibration-current-detail',
    'calibration-count-passed', 'calibration-count-failed', 'calibration-count-pending', 'calibration-count-running',
    'calibration-map', 'calibration-map-help',
    ...Array.from({ length: MAX_QR_CODES - 2 }, (_, index) => `qr-canvas-${index + 3}`),
    ...Array.from({ length: MAX_QR_CODES - 2 }, (_, index) => `qr-paper-${index + 3}`)
  ].forEach((id) => { ui[id] = $(id); });

  const MAX_BYTES = 2953;
  const FRAME_RATES = [1, 2, 5, 10, 15, 20];
  const RATE_LABELS = [['one', 1], ['two', 2], ['five', 5], ['ten', 10], ['fifteen', 15], ['twenty', 20]];
  const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
  const DEFAULT_CAPACITY = 'Jeden QR: do 2953 B. Seria: do 10 MiB. Duży plik z zapisem części: do 200 MiB. Odtwarzanie zaczyna się od pauzy.';
  let mode = 'encode';
  let receiverView = 'file';
  let receiverViewPainted = false;
  let receiverViewChosen = false;
  let receiverActivity = null;
  let sourceBytes = null;
  let decodedBytes = null;
  let sourceName = '';
  let sourceZipMetadata = null;
  let sourceOriginalFile = null;
  let largeSender = null;
  let largeSourceFile = null;
  let largeSegmentIndex = 0;
  let largeSegmentEpoch = 0;
  let largeLoading = false;
  let largeMissingSegments = null;
  let largeConfirmed = false;
  let largeStore = null;
  let largeReceiver = null;
  let largeStorageEpoch = 0;
  let largeStorageBusy = false;
  let largeResumeBytes = 0;
  let decodedFile = null;
  let sourceEpoch = 0;
  let encodingBusy = false;
  let decodeEpoch = 0;
  let cameraEpoch = 0;
  let cameraStream = null;
  let cameraRequestedGrid = null;
  let calibrationCaptureGrid = null;
  let cameraPreviewObserver = null;
  let cameraScanner = null;
  let cancelCameraScan = null;
  let feedbackEpoch = 0;
  let feedbackStream = null;
  let feedbackPreviewObserver = null;
  let feedbackScanner = null;
  let cancelFeedbackScan = null;
  let feedbackImageBusy = false;
  let pendingImageCancel = null;
  let series = null;
  let frameIndex = 0;
  let animationTimer = null;
  let animationPlaying = false;
  let transmissionPhase = 'source';
  let repairBlocks = [];
  let animationTick = 0;
  let playback = null;
  let presentedCheckpoint = null;
  let preparedDisplays = [];
  let preparationTimer = null;
  let preparationPending = false;
  let preparationEpoch = 0;
  let matrixEncoder = null;
  let animationRaf = null;
  let lastDisplayFrames = [];
  let senderMetrics = { started: 0, displays: 0, symbols: 0, cost: 0 };
  let calibration = null;
  let calibrationActive = false;
  let calibrationTimer = null;
  let calibrationCleanup = null;
  let calibrationObserver = null;
  let calibrationPhase = 'idle';
  let calibrationDisplayGrid = null;
  let calibrationSavedView = null;
  let alignmentTimer = null;
  let alignmentState = null;
  let calibrationRenderedKey = '';
  let calibrationView = null;
  let calibrationMapKey = '';
  const calibrationMapCells = new Map();
  let pendingCalibrationPaint = null;
  let calibrationWasExpanded = false;
  let expandAfterCalibration = false;
  let receiverEpoch = 0;
  let receiverChain = Promise.resolve();
  let collector = null;
  let telemetry = null;
  let lastTelemetryPaint = 0;
  let copyingDiagnostics = false;
  let receiverSnapshot = null;
  let progressTimer = null;
  let pendingProgress = null;
  let lastProgressPaint = 0;
  let expandedReturnFocus = null;
  let metrics = { started: 0, lastPaint: 0, latency: 0, attempts: 0, successes: 0, events: [], rate: 0, recommended: 2 };
  const matrixCache = new Map();
  const pendingUrls = new Set();
  const scanCanvas = document.createElement('canvas');
  const scanContext = scanCanvas.getContext('2d', { willReadFrequently: true });

  function setText(element, text) { if (element.textContent !== text) element.textContent = text; }
  function status(text) { if (ui['status-bar'].textContent !== text) ui['status-bar'].textContent = text; }
  function message(target, text = '', kind = '') {
    if (ui[target].textContent !== text) ui[target].textContent = text;
    if (ui[target].dataset.kind !== kind) ui[target].dataset.kind = kind;
  }
  function byteCount(count) { return `${count.toLocaleString('pl-PL')} B`; }
  function fileCount(count) {
    const ending = count === 1 ? 'plik' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'pliki' : 'plików';
    return `${count} ${ending}`;
  }
  function fragmentCount(count) {
    const ending = count === 1 ? 'fragment' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'fragmenty' : 'fragmentów';
    return `${count} ${ending}`;
  }
  function cleanName(name, fallback = 'wireguard.conf') {
    const cleaned = String(name || '').replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, '_').replace(/^\.+/, '').trim().slice(0, 120);
    return cleaned || fallback;
  }
  function textFrom(bytes) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { return null; }
  }
  function fileKind(bytes) {
    if (window.WGZip.isZip(bytes)) return 'Archiwum ZIP';
    const text = textFrom(bytes);
    if (text !== null && /^\s*\[Interface\]\s*$/m.test(text) && /^\s*\[Peer\]\s*$/m.test(text)) {
      return 'Konfiguracja WireGuard';
    }
    return text === null || /\u0000/.test(text) ? 'Plik binarny' : 'Plik tekstowy';
  }
  function preview(bytes) {
    if (!bytes) return '';
    if (window.WGZip.isZip(bytes)) return 'To archiwum ZIP. Pobranie zachowa całe archiwum; strona nie rozpakowuje jego zawartości.';
    const text = textFrom(bytes);
    if (text === null || /\u0000/.test(text)) {
      return 'To plik binarny. Pobranie zachowa jego oryginalne bajty.';
    }
    return text.length > 12000 ? `${text.slice(0, 12000)}\n… (skrócony podgląd; pobierany plik jest kompletny)` : text;
  }
  function closePreviews() {
    ui['preview-source'].open = false;
    ui['preview-decoded'].open = false;
    ui['source-preview'].textContent = '';
    ui['decoded-preview'].textContent = '';
  }
  function openExpanded() {
    if (ui['qr-result'].hidden) return;
    if (calibrationPhase === 'measuring') stopCalibration(false);
    if (ui['qr-result'].hidden) return;
    expandedReturnFocus = document.activeElement;
    ui['calibration-display-slot'].appendChild(ui['calibration-setup']);
    document.body.classList.add('qr-expanded');
    ui['qr-result'].setAttribute('role', 'dialog');
    ui['qr-result'].setAttribute('aria-modal', 'true');
    ui['qr-result'].setAttribute('aria-label', 'Powiększony kod QR i sterowanie transferem');
    ui['close-expanded'].hidden = false;
    ui['close-expanded'].focus();
    redrawCurrent();
  }
  function restoreCalibratedDisplay() {
    if (!expandAfterCalibration || !series || ui['qr-result'].hidden) return;
    expandAfterCalibration = false;
    openExpanded();
  }
  function closeExpanded(restoreFocus = true) {
    const wasExpanded = document.body.classList.contains('qr-expanded');
    document.body.classList.remove('qr-expanded');
    if (wasExpanded && calibrationActive) stopCalibration(false);
    ui['qr-result'].removeAttribute('role');
    ui['qr-result'].removeAttribute('aria-modal');
    ui['qr-result'].removeAttribute('aria-label');
    ui['close-expanded'].hidden = true;
    ui['calibration-home'].appendChild(ui['calibration-setup']);
    if (wasExpanded && restoreFocus) {
      const target = expandedReturnFocus && expandedReturnFocus.isConnected ? expandedReturnFocus : ui['expand-qr'];
      target.focus();
    }
    expandedReturnFocus = null;
    redrawCurrent();
  }
  function encodeBusy(busy) {
    encodingBusy = busy;
    ui['choose-file'].disabled = busy;
    ui['sample-file'].disabled = busy;
    ui['series-sample'].disabled = busy;
    ui['speed-sample'].disabled = busy;
    ui['large-sample'].disabled = busy;
    ui['zip-sample'].disabled = busy;
    ui['qr-density'].disabled = busy;
    ui['qr-layout'].disabled = busy;
    ui['qr-columns'].disabled = busy;
    ui['qr-rows'].disabled = busy;
    ui['series-ecc'].disabled = busy;
    ui['compress-single'].disabled = busy || Boolean(largeSourceFile);
    ui['calibration-range'].disabled = busy;
    ui['calibration-layout-scope'].disabled = busy;
    ui['start-calibration'].disabled = busy || calibrationActive || !calibrationGridAllowed();
    ui['scan-feedback'].disabled = busy || !canReceiveFeedback();
    ui['download-source-zip'].disabled = busy || !sourceBytes || !window.WGZip.isZip(sourceBytes);
    ui['transfer-mode'].disabled = busy;
    ui['file-drop'].setAttribute('aria-busy', String(busy));
  }
  function decodeBusy(busy) {
    ui['choose-image'].disabled = busy;
    ui['start-camera'].disabled = busy;
    ui['image-drop'].setAttribute('aria-busy', String(busy));
  }
  function clearSource() {
    largeSegmentEpoch++;
    largeLoading = false;
    stopCalibration(false);
    if (calibration) calibration.dispose();
    calibration = null;
    pauseAnimation();
    stopFeedbackCamera();
    closeExpanded(false);
    if (series) series.dispose();
    if (largeSender) largeSender.dispose();
    largeSender = null;
    largeSourceFile = null;
    largeMissingSegments = null;
    largeConfirmed = false;
    largeSegmentIndex = 0;
    series = null;
    playback = null;
    presentedCheckpoint = null;
    lastDisplayFrames.forEach(frame => frame.matrix.data.fill(0));
    lastDisplayFrames = [];
    matrixCache.forEach((matrix) => matrix.data.fill(0));
    matrixCache.clear();
    frameIndex = 0;
    transmissionPhase = 'source';
    animationTick = 0;
    repairBlocks = [];
    if (sourceBytes) sourceBytes.fill(0);
    sourceBytes = null;
    sourceName = '';
    sourceZipMetadata = null;
    sourceOriginalFile = null;
    ui['file-input'].value = '';
    ui['source-details'].hidden = true;
    ui['source-name'].textContent = '';
    ui['source-size'].textContent = '';
    ui['source-format'].textContent = '';
    ui['qr-empty'].hidden = false;
    ui['qr-result'].hidden = true;
    clearQR(ui['qr-canvas']);
    for (let index = 1; index < MAX_QR_CODES; index++) { clearQR(qrCanvas(index)); qrPaper(index).hidden = true; }
    ui['qr-pair'].dataset.layout = 'single';
    ui['dual-layout-hint'].hidden = true;
    ui['sender-metrics'].hidden = true;
    ui['calibration-status'].textContent = '';
    ui['calibration-step'].textContent = '1. Ustaw telefon → 2. Zmierz odbiór → 3. Przekaż wynik QR';
    ui['start-calibration'].disabled = encodingBusy || !calibrationGridAllowed();
    ui['qr-caption'].textContent = '';
    ui['capacity-note'].textContent = DEFAULT_CAPACITY;
    ui['download-qr'].disabled = true;
    ui['preview-source'].open = false;
    ui['source-preview'].textContent = '';
    ui['series-controls'].hidden = true;
    ui['frame-position'].textContent = '';
    ui['frame-slider'].min = '1';
    ui['frame-slider'].max = '1';
    ui['frame-slider'].value = '1';
    ui['transfer-info'].textContent = '';
    ui['download-qr-label'].textContent = 'Pobierz obraz PNG';
    ui['zip-details'].hidden = true;
    ui['zip-count'].textContent = '';
    ui['zip-entries'].replaceChildren();
    ui['zip-entries'].hidden = true;
    ui['download-source-zip'].disabled = true;
    ui['animation-toggle'].disabled = true;
    ui['scan-feedback'].disabled = true;
    ui['feedback-message'].textContent = '';
    ui['feedback-image-input'].value = '';
    ui['large-sender-controls'].hidden = true;
    ui['large-segment'].replaceChildren();
    ui['large-segment-status'].textContent = '';
    updateTransferEstimate();
  }
  function clearDecoded() {
    if (decodedBytes) decodedBytes.fill(0);
    decodedBytes = null;
    decodedFile = null;
    ui['image-input'].value = '';
    ui['decoded-empty'].hidden = false;
    ui['decoded-result'].hidden = true;
    ui['decoded-size'].textContent = '';
    ui['decoded-kind'].textContent = '';
    ui['download-file'].disabled = true;
    ui['output-name'].value = 'wireguard.conf';
    ui['preview-decoded'].open = false;
    ui['decoded-preview'].textContent = '';
  }
  function cancelImageRead() {
    if (pendingImageCancel) pendingImageCancel();
    pendingImageCancel = null;
  }
  function stopCamera(showMessage = false) {
    pendingCalibrationPaint = null;
    cameraEpoch += 1;
    if (cancelCameraScan) cancelCameraScan();
    cancelCameraScan = null;
    if (cameraScanner) cameraScanner.dispose();
    cameraScanner = null;
    if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
    cameraRequestedGrid = null;
    resetAlignment();
    cameraPreviewObserver?.disconnect();
    cameraPreviewObserver = null;
    ui['camera-video'].pause();
    ui['camera-video'].srcObject = null;
    ui['camera-stage'].style.width = ui['camera-stage'].style.height = '';
    setText(ui['scan-help'], 'Umieść cały kod w kadrze i przytrzymaj telefon.');
    ui['camera-box'].hidden = true;
    ui['stop-camera'].hidden = true;
    ui['start-camera'].hidden = false;
    decodeBusy(false);
    scanCanvas.width = scanCanvas.height = 1;
    if (telemetry) {
      telemetry.stopCamera();
      renderTelemetry(true);
    }
    if (showMessage) {
      message('decode-message', 'Kamera została wyłączona. Możesz też wczytać obraz QR.');
      status('Kamera wyłączona');
    }
  }
  function resetAll() {
    expandAfterCalibration = false;
    sourceEpoch += 1;
    decodeEpoch += 1;
    cancelImageRead();
    stopCamera();
    clearSource();
    clearDecoded();
    resetCollector();
    hideFeedback();
    resetMetrics();
    encodeBusy(false);
    decodeBusy(false);
    pendingUrls.forEach((url) => URL.revokeObjectURL(url));
    pendingUrls.clear();
    message('encode-message');
    message('decode-message');
    document.querySelectorAll('.is-dragover').forEach((el) => el.classList.remove('is-dragover'));
    renderLargeStorage();
    status(largeStore?.state?.descriptor ? 'Wyczyszczono widok. Zapisane części pozostają do wznowienia.' : 'Wyczyszczono plik, kod QR i podglądy');
  }
  function selectMode(nextMode, focus = false) {
    if (mode !== nextMode) {
      if (largeLoading) { largeSegmentEpoch++; largeLoading = false; }
      stopCalibration(false);
      sourceEpoch += 1;
      decodeEpoch += 1;
      cancelImageRead();
      stopCamera();
      stopFeedbackCamera();
      hideFeedback();
      closeExpanded(false);
      pauseAnimation();
      encodeBusy(false);
      closePreviews();
      mode = nextMode;
    }
    ['encode', 'decode'].forEach((value) => {
      const active = value === mode;
      ui[`${value}-tab`].setAttribute('aria-selected', String(active));
      ui[`${value}-tab`].tabIndex = active ? 0 : -1;
      ui[`${value}-panel`].hidden = !active;
    });
    status(mode === 'encode' ? 'Gotowe do utworzenia QR' : 'Gotowe do odczytania QR');
    if (mode === 'encode' && largeSender && !series && !largeLoading) void loadLargeSegment(largeSegmentIndex);
    if (focus) ui[`${mode}-tab`].focus();
  }
  function gridValue(value, max) { const number = Number(value); return Number.isInteger(number) && number >= 1 && number <= max ? number : 1; }
  function selectedGrid(receiving = false) {
    const prefix = receiving ? 'scan' : 'qr';
    const columns = gridValue(ui[prefix + '-columns'].value, MAX_QR_COLUMNS), rows = gridValue(ui[prefix + '-rows'].value, MAX_QR_ROWS);
    return { columns, rows, lanes: columns * rows };
  }
  function setGridControls(grid, receiving = false) {
    const prefix = receiving ? 'scan' : 'qr';
    ui[prefix + '-columns'].value = String(grid.columns);
    ui[prefix + '-rows'].value = String(grid.rows);
    ui[prefix + '-layout'].value = grid.columns * grid.rows > 1 ? 'dual' : 'single';
  }
  function selectedLanes() { return series ? selectedGrid().lanes : 1; }
  function qrCanvas(index) { return ui[index === 0 ? 'qr-canvas' : index === 1 ? 'qr-canvas-second' : `qr-canvas-${index + 1}`]; }
  function qrPaper(index) { return ui[index === 1 ? 'qr-paper-second' : `qr-paper-${index + 1}`]; }
  function displayGrid() { return calibrationDisplayGrid || (series ? selectedGrid() : { columns: 1, rows: 1, lanes: 1 }); }
  function selectedEcc() { return ui['series-ecc'].value === 'L' ? 'L' : 'M'; }
  function syncLayout() {
    const grid = displayGrid(), count = grid.columns * grid.rows;
    const layout = count === 1 ? 'single' : grid.columns === 2 && grid.rows === 1 ? 'dual' : 'grid';
    ui['qr-pair'].dataset.layout = layout;
    ui['qr-pair'].dataset.columns = String(grid.columns);
    ui['qr-pair'].dataset.rows = String(grid.rows);
    ui['qr-pair'].style.gridTemplateColumns = `repeat(${grid.columns}, minmax(0, 1fr))`;
    ui['qr-pair'].style.setProperty('--qr-columns', String(grid.columns));
    ui['qr-pair'].style.setProperty('--qr-rows', String(grid.rows));
    for (let index = 1; index < MAX_QR_CODES; index++) qrPaper(index).hidden = index >= count || index >= lastDisplayFrames.length;
    ui['dual-layout-hint'].hidden = count === 1;
    setText(ui['qr-grid-count'], `${selectedGrid().columns} × ${selectedGrid().rows} — ${selectedGrid().lanes} QR jednocześnie`);
    setText(ui['scan-grid-count'], `${selectedGrid(true).columns} × ${selectedGrid(true).rows} — ${selectedGrid(true).lanes} QR jednocześnie`);
    setText(ui['frame-rate-label'], count > 1 ? 'Zmiany całego układu na sekundę' : 'Kody na sekundę');
    for (const [label, rate] of RATE_LABELS) {
      setText(ui[`estimate-${label}-label`], count === 2 ? `${rate} ${rate === 1 ? 'para' : rate === 2 ? 'pary' : 'par'}/s · ${rate * count} QR/s`
        : count > 1 ? `${rate} zmian/s · ${rate * count} QR/s` : `${rate} QR/s`);
    }
    ui['scan-guides'].dataset.layout = ui['scan-layout'].value === 'dual' ? 'dual' : 'single';
    updateCalibrationDuration();
  }
  function clearPrepared(restore = true) {
    if (preparationTimer !== null) window.clearTimeout(preparationTimer);
    preparationTimer = null;
    preparationEpoch++;
    preparationPending = false;
    matrixEncoder?.reset();
    preparedDisplays = [];
    if (restore && playback && presentedCheckpoint) playback.restore(presentedCheckpoint);
  }
  function pauseAnimation() {
    if (animationTimer !== null) window.clearTimeout(animationTimer);
    if (animationRaf !== null && typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(animationRaf);
    animationTimer = animationRaf = null;
    animationPlaying = false;
    clearPrepared();
    ui['animation-toggle'].textContent = transmissionPhase === 'confirmed' ? 'Odbiór potwierdzony' : 'Odtwórz serię';
    ui['animation-toggle'].setAttribute('aria-pressed', 'false');
    lockLargeWaiting();
    if (series && mode === 'encode' && transmissionPhase !== 'confirmed' && !calibrationActive) {
      message('encode-message', 'Seria jest wstrzymana. Możesz ją wznowić lub wybrać fragment ręcznie.', 'success');
      status('Seria QR — odtwarzanie wstrzymane');
    }
  }
  function cacheMatrix(key, matrix) {
    matrixCache.set(key, matrix);
    if (matrixCache.size > MATRIX_CACHE_LIMIT) {
      // The current screen and every prefetched screen still own their matrices.
      // Cache eviction must never turn a queued QR or a later redraw into white.
      const inUse = new Set([matrix]);
      const protect = frames => frames?.forEach(frame => inUse.add(frame.matrix));
      protect(lastDisplayFrames);
      preparedDisplays.forEach(display => protect(display.frames));
      protect(calibrationSavedView?.frames);
      for (const [oldKey, oldMatrix] of matrixCache) {
        if (inUse.has(oldMatrix)) continue;
        oldMatrix.data.fill(0);
        matrixCache.delete(oldKey);
        if (matrixCache.size <= MATRIX_CACHE_LIMIT) break;
      }
      // Keep the cache bounded even if all older entries have an owner. The
      // caller retains this matrix; dropping a cache reference must not erase it.
      if (matrixCache.size > MATRIX_CACHE_LIMIT) matrixCache.delete(key);
    }
    return matrix;
  }
  function cachedMatrix(key) {
    if (!matrixCache.has(key)) return null;
    const matrix = matrixCache.get(key);
    matrixCache.delete(key);
    matrixCache.set(key, matrix);
    return matrix;
  }
  function frameMatrix(key, makeBytes, level = selectedEcc()) {
    key = `${level}:${key}`;
    const cached = cachedMatrix(key);
    if (cached) return cached;
    const bytes = makeBytes();
    try { return cacheMatrix(key, window.WGQR.encodeBytes(bytes, { errorCorrectionLevel: level })); }
    finally { bytes.fill(0); }
  }
  async function prepareDisplayAsync(planner, isCurrent) {
    const started = window.performance.now();
    const planned = planner.next();
    const missing = [], matrices = new Array(planned.frames.length);
    let pending;
    try {
      planned.frames.forEach((frame, index) => {
        const level = frame.kind === 'manifest' ? 'M' : selectedEcc();
        const key = `${level}:${frame.key}`;
        matrices[index] = cachedMatrix(key);
        if (!matrices[index]) missing.push({ index, key, bytes: frame.bytes, errorCorrectionLevel: level });
      });
      if (missing.length) pending = matrixEncoder.encodeBatch(missing);
    } finally { planned.frames.forEach(frame => frame.bytes.fill(0)); }
    const encoded = pending ? await pending : [];
    if (!isCurrent()) {
      encoded.forEach(matrix => matrix.data.fill(0));
      const error = new Error('Przygotowanie kodu anulowane.'); error.name = 'AbortError'; throw error;
    }
    missing.forEach((item, index) => { matrices[item.index] = cacheMatrix(item.key, encoded[index]); });
    return { frames: planned.frames.map((frame, index) => ({ ...frame, bytes: undefined, matrix: matrices[index] })),
      checkpoint: planned.checkpoint, cost: Math.max(0, window.performance.now() - started) };
  }
  function prepareDisplay() {
    const started = window.performance.now();
    const planned = playback.next();
    const frames = planned.frames.map(frame => {
      let matrix;
      try { matrix = frameMatrix(frame.key, () => frame.bytes, frame.kind === 'manifest' ? 'M' : selectedEcc()); }
      finally { frame.bytes.fill(0); }
      return { ...frame, bytes: undefined, matrix };
    });
    return { frames, checkpoint: planned.checkpoint, cost: Math.max(0, window.performance.now() - started) };
  }
  function redrawCurrent() {
    if (!lastDisplayFrames.length || ui['qr-result'].hidden) return;
    syncLayout();
    lastDisplayFrames.forEach((frame, index) => { if (index === 0 || !qrPaper(index).hidden) drawQR(frame.matrix, qrCanvas(index)); });
  }
  function presentDisplay(display) {
    if (!display.frames.length) return;
    const started = window.performance.now();
    lastDisplayFrames = display.frames;
    presentedCheckpoint = display.checkpoint;
    transmissionPhase = display.checkpoint.phase;
    const numbered = display.frames.find(frame => Number.isInteger(frame.index));
    if (numbered) frameIndex = numbered.index;
    syncLayout();
    display.frames.forEach((frame, index) => drawQR(frame.matrix, qrCanvas(index)));
    const descriptions = display.frames.map(frame => frame.kind === 'manifest' ? 'opis pliku'
      : frame.kind === 'repair' ? `blok ${frame.block + 1}` : `fragment ${frame.index + 1}`);
    ui['frame-position'].textContent = `${transmissionPhase === 'repair' ? 'Naprawa' : 'Dane'} · ${descriptions.join(' + ')}`;
    ui['frame-slider'].value = String(frameIndex + 1);
    setText(ui['qr-caption'], `${byteCount(series.size)} · ${fragmentCount(series.total)} · ${selectedGrid().columns} × ${selectedGrid().rows} QR`);
    if (largeSender) {
      setText(ui['qr-caption'], 'Część ' + (largeSegmentIndex + 1) + ' / ' + largeSender.descriptor.segmentCount
        + ' · ' + byteCount(largeSender.descriptor.size) + ' łącznie · ' + selectedLanes() + ' QR');
    }
    if (animationPlaying) {
      senderMetrics.displays++;
      senderMetrics.symbols += display.frames.length;
      const cost = display.cost + Math.max(0, window.performance.now() - started);
      senderMetrics.cost = senderMetrics.displays === 1 ? cost : senderMetrics.cost * 0.8 + cost * 0.2;
      const elapsed = Math.max(0.001, (window.performance.now() - senderMetrics.started) / 1000);
      ui['sender-metrics'].hidden = false;
      ui['sender-rate'].textContent = `${(senderMetrics.displays / elapsed).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} zmian/s · ${(senderMetrics.symbols / elapsed).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} QR/s`;
      ui['sender-cost'].textContent = `${Math.round(senderMetrics.cost)} ms / zmianę`;
    }
  }
  function prepareAhead() {
    if (!animationPlaying || preparedDisplays.length >= MAX_PREPARED_DISPLAYS || preparationTimer !== null || preparationPending) return;
    const token = sourceEpoch, epoch = preparationEpoch, planner = playback;
    const current = () => animationPlaying && token === sourceEpoch && epoch === preparationEpoch && planner === playback;
    preparationTimer = window.setTimeout(async () => {
      preparationTimer = null;
      if (!current() || !planner) return;
      preparationPending = true;
      try {
        const display = await prepareDisplayAsync(planner, current);
        if (current()) preparedDisplays.push(display);
      } catch (error) {
        if (current() && error.name !== 'AbortError') {
          pauseAnimation();
          message('encode-message', 'Nie udało się przygotować następnego kodu. Wznów serię lub wybierz niższe tempo.', 'error');
        }
      } finally {
        if (epoch === preparationEpoch) { preparationPending = false; if (current()) prepareAhead(); }
      }
    }, 0);
  }
  function showFrame(index, initialManifest = false) {
    if (!series) return;
    clearPrepared(false);
    frameIndex = Math.max(0, Math.min(series.total - 1, Math.round(index)));
    playback = window.WGPlayback.create(series, { lanes: selectedLanes(), startIndex: frameIndex, initialManifest });
    presentedCheckpoint = null;
    transmissionPhase = 'source';
    ui['animation-toggle'].disabled = false;
    ui['animation-toggle'].textContent = 'Odtwórz serię';
    presentDisplay(prepareDisplay());
    lockLargeWaiting();
  }
  function showRepairFrame() {
    if (!series || !playback) return;
    clearPrepared(false);
    presentDisplay(prepareDisplay());
  }
  function selectedFrameRate() {
    const value = Number(ui['frame-rate'].querySelector('input:checked')?.value);
    return FRAME_RATES.includes(value) ? value : 2;
  }
  function formatPassTime(frames, rate) {
    if (frames === 0) return '0 s';
    const nominalSeconds = frames / rate;
    if (nominalSeconds < 1) return '< 1 s';
    const totalSeconds = Math.ceil(nominalSeconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds % 3600 / 60);
    const seconds = totalSeconds % 60;
    return [hours ? `${hours} h` : '', minutes ? `${minutes} min` : '', seconds ? `${seconds} s` : ''].filter(Boolean).join(' ');
  }
  function updateTransferEstimate() {
    syncLayout();
    ui['transfer-estimate'].hidden = !series;
    const rate = series ? selectedFrameRate() : null;
    let displays = series ? window.WGPlayback.firstPassDisplays(series.total, selectedLanes(), series.version >= 3 ? series.manifestInterval : 0) : 0;
    if (largeSender && series) {
      const descriptor = largeSender.descriptor;
      const indices = largeMissingSegments ?? Array.from({ length: descriptor.segmentCount }, (_, index) => index);
      displays = indices.reduce((sum, index) => {
        const size = Math.min(descriptor.segmentBytes, descriptor.size - index * descriptor.segmentBytes);
        const sources = Math.ceil(size / series.chunkBytes);
        return sum + window.WGPlayback.firstPassDisplays(sources + Math.ceil(sources * largeRepairRatio()), selectedLanes(), 16);
      }, 0);
    }
    setText(ui['estimate-title'], largeSender ? 'Szacowany obieg wszystkich potrzebnych części z zapasem naprawy' : 'Czas pierwszej serii danych');
    for (const [label, value] of RATE_LABELS) {
      ui[`estimate-${label}`].textContent = series ? formatPassTime(displays, value) : '';
      ui[`estimate-${label}-cell`].classList.toggle('is-selected', rate === value);
    }
    lockLargeWaiting();
  }
  function startAnimation() {
    if (!series || transmissionPhase === 'confirmed' || largeHasNoMissing() || mode !== 'encode' || document.hidden) return;
    stopCalibration(false);
    pauseAnimation();
    if (lastDisplayFrames.some(frame => frame.kind === 'calibration')) showFrame(0, true);
    animationPlaying = true;
    ui['animation-toggle'].textContent = 'Wstrzymaj serię';
    ui['animation-toggle'].setAttribute('aria-pressed', 'true');
    senderMetrics = { started: window.performance.now(), displays: 0, symbols: 0, cost: 0 };
    const token = sourceEpoch;
    let deadline = window.performance.now();
    const active = () => animationPlaying && token === sourceEpoch && series && mode === 'encode' && !document.hidden;
    const schedule = () => {
      if (!active()) return;
      const period = 1000 / selectedFrameRate();
      const jitter = [1, 1.10, 0.90, 1.05, 0.95][animationTick % 5];
      deadline += period * jitter;
      const now = window.performance.now();
      // Hold the symbol if preparation missed its deadline; never burst through old slots.
      if (deadline - now < period * 0.75) deadline = now + period;
      animationTimer = window.setTimeout(tick, Math.max(1, Math.round(deadline - now)));
    };
    function present() {
      animationRaf = null;
      if (!active()) return;
      try {
        // The boundary QR gets its full display interval before loading another part.
        if (largeSender && ui['large-auto'].checked && presentedCheckpoint?.phase === 'repair'
          && presentedCheckpoint.serial >= Math.ceil(series.total * largeRepairRatio())) {
          const next = nextLargeSegment();
          if (next !== null && next !== largeSegmentIndex) { void loadLargeSegment(next, { resume: true }); return; }
        }
        // Never advance the planner synchronously past an in-flight Worker batch.
        // Hold the current symbol until the next prepared display is ready.
        if (!preparedDisplays.length) {
          prepareAhead();
          animationTimer = window.setTimeout(tick, Math.min(30, Math.max(8, Math.round(250 / selectedFrameRate()))));
          return;
        }
        animationTick++;
        presentDisplay(preparedDisplays.shift());
        prepareAhead();
        schedule();
      } catch {
        pauseAnimation();
        message('encode-message', 'Nie udało się przygotować kodu. Zmniejsz tempo i spróbuj ponownie.', 'error');
      }
    }
    function tick() {
      animationTimer = null;
      if (!active()) return;
      if (typeof window.requestAnimationFrame === 'function') animationRaf = window.requestAnimationFrame(present);
      else present();
    }
    message('encode-message', 'Nadaję dane i opisy pliku, a potem pakiety naprawcze. Każdy poprawny odczyt jest przyjmowany niezależnie.', 'success');
    status(`Nadawanie: ${selectedFrameRate()} ${selectedLanes() === 1 ? 'kodów' : selectedLanes() === 2 ? 'par' : 'układów'}/s`);
    prepareAhead();
    schedule();
  }
  function manualFrame(index) {
    pauseAnimation();
    showFrame(index);
    status('Seria wstrzymana — wybrano fragment ręcznie');
  }
  function largeSenderStatus() {
    if (!largeSender) return;
    const descriptor = largeSender.descriptor;
    ui['large-segment'].value = String(largeSegmentIndex);
    ui['large-segment-status'].textContent = 'Część ' + (largeSegmentIndex + 1) + ' z ' + descriptor.segmentCount
      + ' · ' + byteCount(descriptor.size) + (largeMissingSegments ? ' · pozostało ' + largeMissingSegments.length + ' części' : '');
  }
  function largeRepairRatio() {
    const value = Number(ui['large-repair'].value);
    return [0.25, 0.5, 1].includes(value) ? value : 1;
  }
  function largeHasNoMissing() { return Boolean(largeSender && largeMissingSegments && largeMissingSegments.length === 0); }
  function lockLargeWaiting() {
    if (!largeHasNoMissing()) return;
    transmissionPhase = largeConfirmed ? 'confirmed' : 'waiting';
    ui['animation-toggle'].disabled = true;
    ui['animation-toggle'].textContent = largeConfirmed ? 'Odbiór potwierdzony' : 'Oczekiwanie na sprawdzenie';
    for (const id of ['large-segment', 'large-previous', 'large-next']) ui[id].disabled = true;
  }
  function nextLargeSegment(direction = 1) {
    if (!largeSender || largeHasNoMissing()) return null;
    const indices = largeMissingSegments !== null ? largeMissingSegments
      : Array.from({ length: largeSender.descriptor.segmentCount }, (_, index) => index);
    const current = indices.indexOf(largeSegmentIndex);
    return indices[(Math.max(0, current) + direction + indices.length) % indices.length];
  }
  async function loadLargeSegment(index, { resume = false } = {}) {
    if (!largeSender || largeHasNoMissing() || largeLoading || !Number.isInteger(index) || index < 0 || index >= largeSender.descriptor.segmentCount) return;
    const sender = largeSender, token = sourceEpoch, generation = ++largeSegmentEpoch;
    stopCalibration(false);
    pauseAnimation();
    largeLoading = true;
    largeSegmentIndex = index;
    encodeBusy(true);
    for (const id of ['large-segment', 'large-previous', 'large-next', 'animation-toggle']) ui[id].disabled = true;
    message('encode-message', 'Przygotowuję część ' + (index + 1) + ' z ' + sender.descriptor.segmentCount + '…');
    try {
      if (series) series.dispose();
      series = null;
      playback = null;
      presentedCheckpoint = null;
      lastDisplayFrames.forEach(frame => frame.matrix.data.fill(0));
      lastDisplayFrames = [];
      matrixCache.forEach(matrix => matrix.data.fill(0));
      matrixCache.clear();
      const transfer = await sender.loadSegment(index);
      if (token !== sourceEpoch || generation !== largeSegmentEpoch || sender !== largeSender || mode !== 'encode') {
        transfer.dispose(); return;
      }
      series = transfer;
      largeSegmentIndex = index;
      frameIndex = 0;
      ui['series-controls'].hidden = false;
      ui['frame-slider'].max = String(series.total);
      ui['frame-slider'].value = '1';
      ui['scan-feedback'].disabled = false;
      showFrame(0, true);
      updateTransferEstimate();
      largeSenderStatus();
      ui['qr-empty'].hidden = true;
      ui['qr-result'].hidden = false;
      ui['download-qr'].disabled = false;
      ui['download-qr-label'].textContent = 'Pobierz tę klatkę';
      redrawCurrent();
      message('encode-message', 'Część jest gotowa. Odbiornik zapisuje ukończone części; po przerwie pokaż nadajnikowi kod braków.', 'success');
      status('Duży plik — część ' + (index + 1) + ' / ' + sender.descriptor.segmentCount);
      restoreCalibratedDisplay();
    } catch (error) {
      if (token === sourceEpoch && generation === largeSegmentEpoch) {
        message('encode-message', error.code === 'FILE_CHANGED'
          ? 'Plik zmienił się od przygotowania. Wybierz ponownie niezmieniony plik.'
          : 'Nie udało się przygotować części. Wybierz plik ponownie i przekaż kod braków z odbiornika.', 'error');
        status('Nadawanie dużego pliku zatrzymane');
      }
    } finally {
      if (generation === largeSegmentEpoch && sender === largeSender) {
        largeLoading = false;
        encodeBusy(false);
        for (const id of ['large-segment', 'large-previous', 'large-next']) ui[id].disabled = false;
        ui['animation-toggle'].disabled = !series;
        if (resume && series && token === sourceEpoch && mode === 'encode' && !document.hidden) startAnimation();
      }
    }
  }
  async function encodeLargeFile(file) {
    const token = ++sourceEpoch;
    clearSource();
    encodeBusy(false);
    if (!file || !file.size || file.size > window.WGLarge.MAX_FILE_BYTES) {
      message('encode-message', 'Duży transfer przyjmuje jeden niepusty plik lub gotowy ZIP do 200 MiB.', 'error');
      return;
    }
    let sender;
    let attached = false;
    const current = () => attached ? sender === largeSender : token === sourceEpoch && mode === 'encode';
    encodeBusy(true);
    ui['transfer-mode'].value = 'large';
    message('encode-message', 'Sprawdzam plik małymi częściami. Przygotowanie nie wysyła danych przez sieć.');
    status('Przygotowanie dużego pliku…');
    try {
      sender = await window.WGLarge.createSender(file, {
        chunkBytes: ui['qr-density'].value === '600' ? 600 : 384,
        isCurrent: current,
        onProgress: (progress) => {
          if (!current()) return;
          const done = progress?.completedSegments ?? (Number.isInteger(progress?.segmentIndex) ? progress.segmentIndex + 1 : undefined);
          message('encode-message', Number.isInteger(done)
            ? 'Sprawdzanie części pliku: ' + done + ' / ' + Math.ceil(file.size / window.WGLarge.SEGMENT_BYTES)
            : 'Sprawdzam kolejne części pliku…');
        }
      });
      if (!current()) { sender.dispose(); return; }
      largeSender = sender;
      attached = true;
      largeSourceFile = file;
      sourceOriginalFile = file;
      sourceName = sender.descriptor.name;
      ui['source-name'].textContent = sourceName;
      ui['source-size'].textContent = byteCount(file.size);
      ui['source-format'].textContent = 'Duży plik · ' + sender.descriptor.segmentCount + ' części';
      ui['source-details'].hidden = false;
      ui['large-sender-controls'].hidden = false;
      ui['large-segment'].replaceChildren();
      for (let index = 0; index < sender.descriptor.segmentCount; index++) {
        const option = document.createElement('option');
        option.value = String(index); option.textContent = 'Część ' + (index + 1) + ' / ' + sender.descriptor.segmentCount;
        ui['large-segment'].appendChild(option);
      }
      ui['transfer-info'].textContent = 'Na odbiorniku wybierz „Włącz zapis i wznawianie”. Dane i potwierdzenia przechodzą wyłącznie przez QR.';
      ui['capacity-note'].textContent = 'Każda część ma do 2 MiB. Po danych wysyłany jest dodatkowy przebieg naprawczy. Całość może wymagać wielogodzinnego skanowania.';
      await loadLargeSegment(0);
    } catch (error) {
      if (sender && sender !== largeSender) sender.dispose();
      if (current()) {
        clearSource();
        message('encode-message', error.code === 'FILE_CHANGED'
          ? 'Plik zmienił się podczas odczytu. Wybierz go ponownie.'
          : 'Nie udało się przygotować dużego pliku. Sprawdź dostęp do pliku i otwórz stronę przez HTTPS.', 'error');
      }
    } finally { if (current()) encodeBusy(false); }
  }
  function renderLargeStorage() {
    const state = largeStore?.state;
    ui['large-storage-details'].hidden = !largeStore;
    ui['large-resume'].disabled = largeStorageBusy || !state?.descriptor || Boolean(state?.corrupt);
    ui['large-delete'].disabled = largeStorageBusy || !largeStore;
    ui['enable-large-receiver'].disabled = largeStorageBusy || Boolean(largeStore);
    if (!largeStore) return;
    const done = state?.completed?.filter(Boolean).length || 0;
    ui['large-storage-status'].textContent = state?.corrupt
      ? 'Zapis lokalny jest uszkodzony. Usuń zapisany transfer, aby przygotować nowy odbiór.'
      : state?.descriptor ? 'Zapisano ' + done + ' / ' + state.descriptor.segmentCount + ' części · '
        + byteCount(state.savedBytes || 0) + ' · ' + state.descriptor.name
        + (state.complete && largeReceiver?.state?.complete && largeReceiver.state.id === state.descriptor.id
          ? '. Całość jest sprawdzona i gotowa do pobrania.' : '. Wznów zapisany transfer, aby sprawdzić postęp i kontynuować.')
        : 'Zapis lokalny jest gotowy. Możesz uruchomić kamerę lub wczytać migawki QR.';
  }
  function largeStorageError(error) {
    const code = error?.code || '';
    if (/UNSUPPORTED|UNAVAILABLE/.test(code)) return 'Ta przeglądarka nie obsługuje wymaganego zapisu dużych plików. Otwórz stronę w aktualnej przeglądarce z obsługą zapisu lokalnego; małe serie nadal działają.';
    if (/BUSY|LOCK/.test(code)) return 'Zapis jest używany w innej karcie. Zamknij drugi odbiornik tej strony i spróbuj ponownie.';
    if (/QUOTA|SPACE/.test(code) || error?.name === 'QuotaExceededError') return 'Brakuje miejsca na zapis i złożenie pliku. Zwolnij miejsce na urządzeniu; zapisane części pozostają do wznowienia.';
    if (/SESSION|CONFLICT/.test(code)) return 'Jest już zapisany inny transfer. Wznów go albo jawnie usuń zapisany transfer przed odbiorem nowego pliku.';
    if (/CORRUPT|HASH|DIGEST|INTEGRITY|ROOT/.test(code)) return 'Sprawdzenie zapisanych danych nie powiodło się. Plik nie jest gotowy do pobrania. Wznów sprawdzanie zapisu lub ponów brakujące części.';
    return 'Nie udało się zapisać lub sprawdzić części. Zatrzymano odbiór; użyj „Wznów zapisany transfer”, aby sprawdzić zachowane dane.';
  }
  async function resumeLargeReceiver() {
    if (!largeStore || largeStorageBusy || largeStore.state?.corrupt) return;
    decodeEpoch++;
    cancelImageRead();
    stopCamera();
    resetCollector();
    clearDecoded();
    const epoch = receiverEpoch, storage = largeStore;
    largeStorageBusy = true;
    decodeBusy(true);
    renderLargeStorage();
    try {
      if (largeReceiver) largeReceiver.dispose();
      await receiverChain;
      if (epoch !== receiverEpoch || storage !== largeStore) return;
      if (storage.state?.descriptor) await storage.begin(storage.state.descriptor);
      if (epoch !== receiverEpoch || storage !== largeStore) return;
      largeReceiver = window.WGLarge.createCollector({ store: storage });
      const active = largeReceiver;
      const result = typeof active.resume === 'function' ? await active.resume() : active.state;
      if (epoch !== receiverEpoch || storage !== largeStore || active !== largeReceiver) return;
      largeResumeBytes = storage.state?.savedBytes || 0;
      receiverSnapshot = result?.descriptor ? result : active.state;
      if (receiverSnapshot?.descriptor) {
        showReceiving(receiverSnapshot, true);
        if (receiverSnapshot.complete) {
          const file = result?.file || await storage.file();
          if (epoch === receiverEpoch && active === largeReceiver && file) acceptLargeDecoded(file, receiverSnapshot);
        } else message('decode-message', 'Przywrócono zapisane części. Pokaż nadajnikowi „Uzupełnij brakujące”, a potem wróć do skanowania.', 'success');
      }
    } catch (error) {
      if (epoch === receiverEpoch) message('decode-message', largeStorageError(error), 'error');
    } finally {
      if (storage === largeStore) { largeStorageBusy = false; decodeBusy(false); renderLargeStorage(); }
    }
  }
  async function enableLargeReceiver() {
    if (largeStore || largeStorageBusy) return;
    if (receiverSnapshot && receiverSnapshot.version !== 4 && !receiverSnapshot.complete && receiverSnapshot.received > 0) {
      message('decode-message', 'Najpierw dokończ obecną serię lub użyj „Reset odbioru”.', 'warning'); return;
    }
    decodeEpoch++; cancelImageRead(); stopCamera();
    largeStorageBusy = true;
    decodeBusy(true);
    const epoch = ++largeStorageEpoch;
    const receiverToken = receiverEpoch;
    renderLargeStorage();
    message('large-storage-status', 'Sprawdzam możliwość zapisu i zachowane części…');
    let storage;
    try {
      storage = await window.WGLargeStore.open();
      if (epoch !== largeStorageEpoch || receiverToken !== receiverEpoch) { await storage.dispose(); return; }
      largeStore = storage;
      largeStorageBusy = false;
      if (!storage.state?.corrupt) await resumeLargeReceiver();
      renderLargeStorage();
    } catch (error) {
      if (epoch === largeStorageEpoch) message('large-storage-status', largeStorageError(error), 'error');
      if (storage && storage !== largeStore) storage.dispose();
    } finally {
      if (epoch === largeStorageEpoch) { largeStorageBusy = false; decodeBusy(false); renderLargeStorage(); }
    }
  }
  async function deleteLargeStorage() {
    if (!largeStore || largeStorageBusy) return;
    const storage = largeStore;
    decodeEpoch++; cancelImageRead(); stopCamera(); resetCollector(); clearDecoded();
    if (largeReceiver) largeReceiver.dispose();
    largeReceiver = null;
    largeStorageBusy = true;
    decodeBusy(true);
    ui['large-delete-question'].hidden = true;
    renderLargeStorage();
    try {
      await storage.clear();
      if (storage !== largeStore) return;
      largeResumeBytes = 0;
      largeReceiver = window.WGLarge.createCollector({ store: storage });
      message('decode-message', 'Usunięto lokalnie zapisany transfer. Możesz odebrać nowy duży plik.', 'success');
    } catch (error) { message('decode-message', largeStorageError(error), 'error'); }
    finally { if (storage === largeStore) { largeStorageBusy = false; decodeBusy(false); renderLargeStorage(); } }
  }
  function acceptLargeDecoded(file, state) {
    if (!file || file.size !== state.size) return false;
    clearDecoded();
    decodedFile = file;
    ui['decoded-empty'].hidden = true;
    ui['decoded-result'].hidden = false;
    ui['decoded-size'].textContent = byteCount(state.size);
    ui['decoded-kind'].textContent = 'Duży plik · sprawdzone części';
    ui['output-name'].value = cleanName(state.name, 'plik.bin');
    ui['download-file'].disabled = false;
    if (receiverView === 'file') {
      message('decode-message', 'Odebrano i zapisano wszystkie części. Sprawdzono ich skróty i kolejność. Cały plik jest gotowy do pobrania.', 'success');
      status('Duży plik odtworzony i sprawdzony');
    }
    renderLargeStorage();
    return true;
  }
  async function receiveLargeBytes(payload, epoch, source, scanTelemetry) {
    if (window.WGLarge.isFeedback(payload)) {
      telemetry.recordRejected('feedback', { source });
      message('decode-message', 'To potwierdzenie dużego transferu. Pokaż je nadajnikowi po wybraniu „Zeskanuj potwierdzenie”.', 'warning');
      return { done: false, blocked: true };
    }
    selectReceiverActivity('file');
    if (!largeStore || !largeReceiver || largeStorageBusy || largeStore.state?.corrupt) {
      message('decode-message', 'To duży transfer. Najpierw wybierz „Włącz zapis i wznawianie” albo sprawdź zapisany transfer.', 'warning');
      return { done: false, blocked: true };
    }
    if (receiverSnapshot && receiverSnapshot.version !== 4 && !receiverSnapshot.complete && receiverSnapshot.received > 0) {
      message('decode-message', 'Trwa odbiór innego pliku. Dokończ go albo użyj „Reset odbioru”.', 'warning');
      return { done: false, blocked: true };
    }
    // The serial receive queue has settled earlier writes, including a part
    // committed just after Reset. Never count those durable bytes as new speed.
    if (!telemetry.snapshot().transfer) largeResumeBytes = largeStore.state?.savedBytes || 0;
    const active = largeReceiver;
    const before = active.state;
    const savedBefore = largeStore.state?.completed?.filter(Boolean).length || 0;
    try {
      const result = await active.accept(payload);
      if (epoch !== receiverEpoch || active !== largeReceiver) return { done: false, stale: true };
      if (receiverView === 'calibration' && ['pending', 'foreign'].includes(result.kind)) return ignoredFileDuringCalibration();
      if (result.kind === 'pending') {
        message('decode-message', 'Widzę duży transfer. Czekam na powtarzany opis jego części.', 'success');
        return { done: false, pending: true };
      }
      if (result.kind === 'foreign') {
        telemetry.recordRejected('foreign', { source });
        message('decode-message', 'To inny duży plik. Zapisany transfer pozostaje zachowany; możesz go wznowić albo jawnie usunąć.', 'warning');
        return { done: false, foreign: true };
      }
      const state = active.state || result;
      prepareAcceptedFile(scanTelemetry);
      const sameSegment = before?.currentSegment === state.currentSegment;
      const delta = Math.max(0, (state.received || 0) - (sameSegment ? before?.received || 0 : 0));
      receiverSnapshot = { ...state, kind: result.kind, file: undefined };
      const savedDelta = Math.max(0, state.completedSegments - savedBefore);
      recordPacketTelemetry({
        version: 4, size: state.size, total: state.segmentCount, chunkBytes: state.segmentBytes,
        blockCount: state.segmentCount, received: state.completedSegments, blocksComplete: state.completedSegments,
        complete: Boolean(state.complete), packetType: result.packetType || (result.kind === 'manifest' ? 'manifest' : 'unknown')
      }, savedDelta, source);
      showReceiving(receiverSnapshot, Boolean(result.segmentComplete || state.complete));
      if (state.complete && result.file) {
        const showFile = receiverView === 'file';
        if (showFile) stopCamera();
        const accepted = acceptLargeDecoded(result.file, state);
        return { done: showFile && accepted, delta };
      }
      return { done: false, progress: true, delta };
    } catch (error) {
      if (epoch !== receiverEpoch || active !== largeReceiver || /RESET|CANCELLED|DISPOSED/.test(error.code || '')) return { done: false, stale: true };
      if (receiverView === 'calibration') return ignoredFileDuringCalibration();
      receiverSnapshot = active.state;
      showReceiving(receiverSnapshot, true);
      telemetry.recordRejected('invalid', { source });
      const storageFailure = /^STORE_|ROOT_|HASH_|DIGEST_/.test(error.code || '') || error.name === 'QuotaExceededError';
      if (storageFailure) stopCamera();
      message('decode-message', storageFailure ? largeStorageError(error)
        : 'Ten kod dużego transferu jest nieprawidłowy. Poprawnie zapisane części pozostają zachowane.', 'error');
      return { done: false, error: true };
    }
  }
  function clearQR(canvas) {
    if (window.WGRender?.clear) window.WGRender.clear(canvas);
    else canvas.width = canvas.height = 1;
  }
  function drawQR(qr, canvas = ui['qr-canvas']) {
    if (window.WGRender) return window.WGRender.drawQR(qr, canvas);
    const margin = 4;
    const scale = Math.max(6, Math.floor(960 / (qr.size + margin * 2)));
    const size = (qr.size + margin * 2) * scale;
    if (canvas.width !== size || canvas.height !== size) canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#000000';
    for (let y = 0; y < qr.size; y += 1) {
      for (let x = 0; x < qr.size; x += 1) {
        if (qr.data[y * qr.size + x]) context.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale);
      }
    }
  }
  function showZipDetails(metadata) {
    ui['zip-details'].hidden = false;
    const saving = metadata?.inputBytes > sourceBytes?.length ? Math.round((1 - sourceBytes.length / metadata.inputBytes) * 100) : 0;
    ui['zip-count'].textContent = metadata
      ? `${fileCount(metadata.count)} w archiwum${saving > 0 ? ` · ${saving}% mniej bajtów (${byteCount(metadata.inputBytes)} → ${byteCount(sourceBytes.length)})` : ''}`
      : 'Gotowe archiwum ZIP';
    ui['zip-entries'].replaceChildren();
    ui['zip-entries'].hidden = !metadata;
    if (metadata) {
      metadata.entries.forEach((entry) => {
        const item = document.createElement('li');
        item.textContent = `${entry.name} · ${byteCount(entry.size)}`;
        ui['zip-entries'].appendChild(item);
      });
    }
    ui['download-source-zip'].disabled = false;
  }
  async function selectFiles(fileList) {
    const files = Array.from(fileList);
    const single = files.length === 1;
    if (single && ui['transfer-mode'].value === 'large') return encodeLargeFile(files[0]);
    if (single && ui['transfer-mode'].value !== 'single' && files[0].size > window.WGTransfer.MAX_FILE_BYTES
      && (!ui['compress-single'].checked || files[0].size > window.WGZip.MAX_INPUT_BYTES)) return encodeLargeFile(files[0]);
    const compressSingle = single && ui['compress-single'].checked && ui['transfer-mode'].value !== 'single'
      && (ui['transfer-mode'].value === 'series' || files[0].size > MAX_BYTES);
    if (single && !compressSingle) return encodeFile(files[0], { originalFile: files[0] });
    const token = ++sourceEpoch;
    clearSource();
    encodeBusy(false);
    message('encode-message');
    if (!files.length) return;
    if (files.length > window.WGZip.MAX_FILES) {
      message('encode-message', `Wybierz najwyżej ${window.WGZip.MAX_FILES} plików do jednego ZIP-a.`, 'error');
      status('Za dużo plików do archiwum');
      return;
    }
    const inputBytes = files.reduce((total, file) => total + file.size, 0);
    if (inputBytes > window.WGZip.MAX_INPUT_BYTES) {
      message('encode-message', 'Wybrane pliki mają łącznie więcej niż 32 MiB. Wybierz mniejszy zestaw.', 'error');
      status('Przekroczono limit plików przed spakowaniem');
      return;
    }
    encodeBusy(true);
    message('encode-message', `Pakowanie: ${fileCount(files.length)}. Pliki pozostają w tej przeglądarce.`);
    status('Tworzenie archiwum ZIP…');
    const isCurrent = () => token === sourceEpoch && mode === 'encode';
    let archive;
    try {
      if (single) {
        const prefix = new Uint8Array(await files[0].slice(0, 4).arrayBuffer());
        if (!isCurrent()) return;
        const alreadyZip = window.WGZip.isZip(prefix);
        prefix.fill(0);
        if (alreadyZip) return await encodeFile(files[0], { originalFile: files[0] });
      }
      archive = await window.WGZip.createArchive(files, { isCurrent });
      if (!isCurrent()) return;
      if (single && (archive.inputBytes - archive.bytes.length < 128 || archive.bytes.length > archive.inputBytes * 0.95)) {
        await encodeFile(files[0], { originalFile: files[0] });
        if (sourceOriginalFile === files[0] && sourceBytes) message('encode-message', 'ZIP nie zmniejszyłby wyraźnie transferu. Przygotowano oryginalny plik bez dodatkowego archiwum.', 'success');
        return;
      }
      if (archive.bytes.length > window.WGTransfer.MAX_FILE_BYTES) {
        message('encode-message', `Gotowy ZIP ma ${byteCount(archive.bytes.length)} i przekracza limit serii 10 MiB. Wybierz mniej lub mniejsze pliki. Archiwum nie zostało przesłane ani skrócone.`, 'error');
        status('Archiwum ZIP jest za duże na serię QR');
        return;
      }
      const metadata = {
        count: archive.count,
        inputBytes: archive.inputBytes,
        entries: archive.entries.map((entry) => ({ name: entry.name, size: entry.size }))
      };
      const archiveName = single ? cleanName(files[0].name.replace(/\.[^.]*$/, ''), 'plik') + '.zip' : archive.name;
      const file = new File([archive.bytes], archiveName, { type: 'application/zip' });
      ui['transfer-mode'].value = 'series';
      await encodeFile(file, { zipMetadata: metadata, originalFile: single ? files[0] : null });
    } catch (error) {
      if (!isCurrent() || error.code === 'CANCELLED') return;
      clearSource();
      const text = error.code === 'TOO_MANY_FILES' ? 'Do archiwum można dodać najwyżej 100 plików.'
        : error.code === 'INPUT_TOO_LARGE' ? 'Wybrane pliki przekraczają łącznie 32 MiB.'
          : error.code === 'READ_FAILED' || error.code === 'FILE_SIZE_CHANGED'
            ? 'Nie udało się w całości odczytać jednego z plików. Wybierz je ponownie.'
            : 'Nie udało się utworzyć archiwum ZIP. Wybierz pliki ponownie.';
      message('encode-message', text, 'error');
      status('Nie udało się utworzyć ZIP-a');
    } finally {
      if (archive && archive.bytes) archive.bytes.fill(0);
      if (token === sourceEpoch) encodeBusy(false);
    }
  }
  async function encodeFile(file, options = {}) {
    if (file && ui['transfer-mode'].value !== 'single'
      && (file.size > window.WGTransfer.MAX_FILE_BYTES || ui['transfer-mode'].value === 'large')) return encodeLargeFile(file);
    const token = ++sourceEpoch;
    clearSource();
    encodeBusy(false);
    message('encode-message');
    if (!file) return;
    if (!file.size) {
      message('encode-message', 'Ten plik jest pusty. Wybierz niepusty plik.', 'error');
      status('Wybrany plik jest pusty');
      return;
    }
    const requestedMode = ui['transfer-mode'].value;
    let useSeries = requestedMode === 'series' || (requestedMode === 'auto' && file.size > MAX_BYTES);
    if (file.size > window.WGTransfer.MAX_FILE_BYTES) {
      message('encode-message', `Plik ma ${byteCount(file.size)}. Maksymalny rozmiar serii to 10 MiB. Wybierz mniejszy plik.`, 'error');
      status('Plik przekracza limit serii QR');
      return;
    }
    encodeBusy(true);
    status(useSeries ? 'Przygotowywanie serii QR…' : 'Tworzenie kodu QR…');
    let bytes;
    let transfer;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
      if (token !== sourceEpoch || mode !== 'encode') { bytes.fill(0); return; }
      const inputIsZip = window.WGZip.isZip(bytes);
      if (inputIsZip) {
        useSeries = true;
        ui['transfer-mode'].value = 'series';
      } else if (requestedMode === 'single' && bytes.length > MAX_BYTES) {
        bytes.fill(0);
        message('encode-message', 'Jeden QR mieści do 2953 B. Wybierz tryb „Automatycznie” lub „Seria QR”, a następnie ponownie wskaż plik.', 'error');
        status('Plik jest za duży na pojedynczy QR');
        return;
      }
      const reservedPrefixes = [
        [87, 71, 81, 82, 45, 88, 70, 82], // WGQR-XFR transfer marker
        [87, 71, 81, 82, 45, 65, 67, 75], // WGQR-ACK feedback marker
        [87, 71, 81, 82, 45, 67, 65, 76], // WGQR-CAL synthetic calibration
        [87, 71, 81, 82, 45, 83, 69, 84], // WGQR-SET calibration result
        [87, 71, 81, 82, 45, 76, 82, 71], // WGQR-LRG large transfer
        [87, 71, 81, 82, 45, 76, 65, 75] // WGQR-LAK large feedback
      ];
      const protocolLike = bytes.length >= 8 && reservedPrefixes.some((prefix) => prefix.every((value, index) => bytes[index] === value));
      if (protocolLike && requestedMode === 'single') {
        bytes.fill(0);
        message('encode-message', 'Plik zaczyna się od znacznika protokołu serii. Wybierz „Seria QR” lub „Automatycznie” i ponownie wskaż plik, aby odtworzyć go bez zmian.', 'error');
        status('Ten plik wymaga trybu serii');
        return;
      }
      if (protocolLike) useSeries = true;
      const filename = cleanName(file.name, 'plik');
      let qr;
      if (useSeries) {
        const chunkBytes = ui['qr-density'].value === '600' ? 600 : 384;
        transfer = await window.WGResilient.createTransfer(bytes, filename, { chunkBytes, compact: true });
        if (token !== sourceEpoch || mode !== 'encode') {
          transfer.dispose();
          bytes.fill(0);
          return;
        }
        series = transfer;
        ui['scan-feedback'].disabled = false;
        ui['series-controls'].hidden = false;
        ui['frame-slider'].max = String(series.total);
        ui['frame-slider'].value = '1';
        showFrame(0, true);
        updateTransferEstimate();
        ui['download-qr-label'].textContent = 'Pobierz tę klatkę';
        ui['transfer-info'].textContent = inputIsZip
          ? 'Na drugim urządzeniu wybierz „Odczytaj QR”. Po odebraniu całości pobierzesz ZIP do rozpakowania.'
          : 'Serię odczytasz na tej stronie na drugim urządzeniu. Aplikacja WireGuard nie importuje jej bezpośrednio.';
        ui['capacity-note'].textContent = `${fragmentCount(series.total)} danych po maksymalnie ${series.chunkBytes} B. Po pierwszym przebiegu nadawane są nowe pakiety naprawcze.`;
      } else {
        qr = window.WGQR.encodeBytes(bytes);
        lastDisplayFrames = [{ kind: 'plain', matrix: qr }];
        syncLayout();
        drawQR(qr);
        ui['qr-caption'].textContent = `${byteCount(bytes.length)} · pojedynczy kod QR`;
        ui['transfer-info'].textContent = 'Ten QR zawiera sam plik. Konfigurację .conf możesz zeskanować bezpośrednio w aplikacji WireGuard.';
        ui['capacity-note'].textContent = qr.level === 'L'
          ? 'Większy plik: QR używa niższej korekcji błędów. Pokaż cały kod ostro i bez odbić.'
          : DEFAULT_CAPACITY;
      }
      sourceBytes = bytes;
      sourceName = filename;
      sourceZipMetadata = inputIsZip ? options.zipMetadata || null : null;
      sourceOriginalFile = options.originalFile || (!inputIsZip ? file : null);
      ui['source-name'].textContent = sourceName;
      ui['source-size'].textContent = byteCount(bytes.length);
      ui['source-format'].textContent = inputIsZip && sourceZipMetadata ? `Archiwum ZIP · ${fileCount(sourceZipMetadata.count)}` : fileKind(bytes);
      if (inputIsZip) showZipDetails(sourceZipMetadata);
      ui['source-details'].hidden = false;
      ui['qr-empty'].hidden = true;
      ui['qr-result'].hidden = false;
      redrawCurrent();
      ui['download-qr'].disabled = false;
      const readyMessage = inputIsZip && sourceZipMetadata
        ? `Spakowano ${fileCount(sourceZipMetadata.count)} do ${sourceName}. Seria jest gotowa i wstrzymana; włącz kamerę na drugim urządzeniu, potem odtwórz serię.`
        : useSeries ? 'Seria jest gotowa i wstrzymana. Włącz kamerę na drugim urządzeniu, a potem odtwórz serię.' : 'Gotowe. Zeskanuj kod na drugim urządzeniu lub pobierz PNG.';
      message('encode-message', readyMessage, 'success');
      status(useSeries ? 'Seria QR gotowa — odtwarzanie wstrzymane' : 'Kod QR utworzony lokalnie');
      restoreCalibratedDisplay();
    } catch {
      if (bytes && bytes !== sourceBytes) bytes.fill(0);
      if (transfer && transfer !== series) transfer.dispose();
      if (token === sourceEpoch) {
        clearSource();
        message('encode-message', 'Nie udało się odczytać pliku lub utworzyć QR. Spróbuj ponownie. Seria wymaga przeglądarki z obsługą bezpiecznej kryptografii i strony HTTPS.', 'error');
        status('Nie udało się utworzyć QR');
      }
    } finally {
      if (token === sourceEpoch) encodeBusy(false);
    }
  }
  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    pendingUrls.add(url);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => { URL.revokeObjectURL(url); pendingUrls.delete(url); }, 30000);
  }
  function acceptDecoded(result, filename = '', verified = false) {
    if (!result || !result.bytes || !result.bytes.length) return false;
    if (decodedBytes) decodedBytes.fill(0);
    decodedBytes = Uint8Array.from(result.bytes);
    ui['decoded-size'].textContent = byteCount(decodedBytes.length);
    ui['decoded-kind'].textContent = fileKind(decodedBytes);
    ui['decoded-empty'].hidden = true;
    ui['decoded-result'].hidden = false;
    ui['download-file'].disabled = false;
    const kind = fileKind(decodedBytes);
    ui['output-name'].value = filename ? cleanName(filename) : kind === 'Archiwum ZIP' ? 'pliki.zip' : kind === 'Konfiguracja WireGuard' ? 'wireguard.conf' : kind === 'Plik binarny' ? 'odczytany-plik.bin' : 'odczytany-plik.txt';
    if (receiverView === 'file') {
      message('decode-message', verified ? 'Odebrano wszystkie fragmenty i sprawdzono sumę SHA-256. Plik jest gotowy do pobrania.' : 'Kod odczytany. Nazwij plik i pobierz jego zawartość.', 'success');
      if (mode === 'decode') status(verified ? 'Plik odtworzony i sprawdzony' : 'QR odczytany lokalnie');
    }
    return true;
  }
  function renderReceiving(state) {
    if (!state) {
      ui['receiving-progress'].hidden = true;
      ui['decoded-empty'].hidden = Boolean(decodedBytes || decodedFile);
      ui['receiving-name'].textContent = '';
      ui['receiving-count'].textContent = '';
      ui['receiving-progressbar'].max = 1;
      ui['receiving-progressbar'].value = 0;
      ui['receiving-missing'].textContent = '';
      ui['receiving-help'].textContent = '';
      ui['receiving-label'].textContent = 'ODBIERANIE SERII';
      ui['show-feedback'].textContent = 'Uzupełnij brakujące';
      ui['show-feedback'].hidden = true;
      return;
    }
    if (state.version === 4) {
      ui['receiving-label'].textContent = state.complete ? 'DUŻY PLIK ZAPISANY' : 'ODBIERANIE DUŻEGO PLIKU';
      ui['receiving-progress'].hidden = false;
      ui['decoded-empty'].hidden = true;
      ui['receiving-name'].textContent = state.name;
      ui['receiving-count'].textContent = 'Zapisano ' + state.completedSegments + ' / ' + state.segmentCount
        + ' części · ' + byteCount(state.savedBytes) + ' / ' + byteCount(state.size);
      ui['receiving-progressbar'].max = state.size;
      ui['receiving-progressbar'].value = state.savedBytes;
      ui['receiving-missing'].textContent = state.complete ? 'Wszystkie części są sprawdzone i zapisane.'
        : Number.isInteger(state.currentSegment) ? 'Bieżąca część ' + (state.currentSegment + 1) + ': '
          + (state.received || 0) + ' / ' + (state.total || 0) + ' porcji. Ten postęp zostanie zapisany po ukończeniu części.'
          : 'Czekam na opis kolejnej potrzebnej części.';
      ui['receiving-help'].textContent = 'Zapisane części pozostają na tym urządzeniu. Po przerwie wybierz „Wznów zapisany transfer”. Kod zwrotny wskazuje brakujące części.';
      ui['show-feedback'].hidden = false;
      ui['show-feedback'].textContent = state.complete ? 'Pokaż potwierdzenie' : 'Uzupełnij brakujące';
      if (!state.complete && mode === 'decode' && receiverView === 'file') status('Duży plik: zapisano ' + state.completedSegments + ' / ' + state.segmentCount + ' części');
      renderLargeStorage();
      return;
    }
    const received = state.complete || state.kind === 'complete' ? state.total : state.received;
    const complete = received === state.total && Boolean(state.complete || state.kind === 'complete');
    ui['receiving-label'].textContent = complete ? 'ODBIÓR ZAKOŃCZONY' : 'ODBIERANIE SERII';
    ui['show-feedback'].textContent = complete ? 'Pokaż potwierdzenie' : 'Uzupełnij brakujące';
    ui['receiving-progress'].hidden = false;
    ui['decoded-empty'].hidden = true;
    ui['receiving-name'].textContent = state.name;
    const resilient = state.version >= 2;
    ui['receiving-count'].textContent = `${received} z ${state.total} fragmentów danych · ${byteCount(state.size)}${resilient ? ` · bloki ${state.blocksComplete}/${state.blockCount}` : ''}`;
    ui['receiving-progressbar'].max = state.total;
    ui['receiving-progressbar'].value = received;
    const missing = state.missing || [];
    const missingCount = state.missingCount ?? missing.length;
    ui['receiving-missing'].textContent = missing.length
      ? `Niepełne bloki: ${missing.slice(0, 18).join(', ')}${missingCount > 18 ? ` i jeszcze ${missingCount - 18}` : ''}.`
      : complete ? 'Odebrano całą serię.' : 'Sprawdzanie integralności pliku…';
    ui['receiving-help'].textContent = complete
      ? 'Zachowano nazwę oraz bajty pliku. Aby odebrać inny plik, rozpocznij nowy odczyt.'
      : resilient ? 'Nowe pakiety naprawcze uzupełniają brakujące dane. Kod zwrotny pozwoli nadajnikowi skupić się na niepełnych blokach.'
        : 'To starsza seria v1. Powtórzenia są pomijane; potrzebne są wszystkie oryginalne fragmenty.';
    ui['show-feedback'].hidden = !resilient;
    if (!complete && receiverView === 'file') {
      message('decode-message', `Odebrano ${received} z ${state.total} fragmentów danych.`, 'success');
      if (mode === 'decode') status(`Odbieranie serii: ${received} / ${state.total}`);
    }
  }
  function showReceiving(state = receiverSnapshot, force = false) {
    const now = window.performance.now();
    if (!state || force || state.complete || !lastProgressPaint || now - lastProgressPaint >= 250) {
      if (progressTimer !== null) window.clearTimeout(progressTimer);
      progressTimer = null;
      pendingProgress = null;
      lastProgressPaint = now;
      renderReceiving(state);
      return;
    }
    pendingProgress = state;
    if (progressTimer === null) {
      const epoch = receiverEpoch;
      progressTimer = window.setTimeout(() => {
        progressTimer = null;
        if (epoch !== receiverEpoch || !pendingProgress) return;
        const pending = pendingProgress;
        pendingProgress = null;
        showReceiving(pending, true);
      }, Math.max(0, 250 - (now - lastProgressPaint)));
    }
  }
  function resetMetrics() {
    metrics = { started: window.performance.now(), lastPaint: 0, latency: 0, attempts: 0, successes: 0, events: [], rate: 0, recommended: 2 };
    ui['scan-metrics'].hidden = true;
    ui['scan-rate'].textContent = '';
    ui['scan-latency'].textContent = '';
    ui['scan-advice'].textContent = '';
  }
  function recordScan(sample, delta = 0, force = false) {
    const now = window.performance.now();
    metrics.attempts += 1;
    if (sample.result) metrics.successes += 1;
    metrics.latency = metrics.attempts === 1 ? sample.decodeMs : metrics.latency * 0.8 + sample.decodeMs * 0.2;
    if (delta > 0) metrics.events.push({ time: now, delta });
    metrics.events = metrics.events.filter((event) => now - event.time <= 5000);
    const elapsed = Math.max(1, Math.min(5, (now - metrics.started) / 1000));
    metrics.rate = metrics.events.reduce((sum, event) => sum + event.delta, 0) / elapsed;
    if (metrics.attempts >= 8 && now - metrics.started >= 1500) {
      // The latest-frame loop removes the old extra camera-frame wait. Keep a
      // margin below both measured decoder capacity and actual scan cadence.
      const observedRate = metrics.attempts * 1000 / Math.max(1000, now - metrics.started);
      let safeRate = Math.min(0.75 * 1000 / (metrics.latency + 5), observedRate * 0.85);
      // One camera sample may decode up to fifteen symbols; the suggested rate is display changes/s.
      const successRatio = metrics.successes / metrics.attempts;
      if (successRatio < 0.5) safeRate = Math.min(safeRate, 2);
      if (successRatio < 0.2) safeRate = 1;
      metrics.recommended = (receiverSnapshot?.version >= 3 ? [20, 15, 10, 5, 2, 1] : [10, 5, 2, 1]).find((rate) => rate <= safeRate) || 1;
    }
    if (!force && metrics.lastPaint && now - metrics.lastPaint < 250) return;
    metrics.lastPaint = now;
    ui['scan-metrics'].hidden = false;
    ui['scan-rate'].textContent = `${metrics.rate.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} /s`;
    ui['scan-latency'].textContent = `${Math.round(metrics.latency)} ms`;
    ui['scan-advice'].textContent = metrics.attempts < 8 || now - metrics.started < 1500
      ? 'Zbieram pomiary. Licznik pokazuje nowe, użyteczne fragmenty — powtórzenia nie zwiększają wyniku.'
      : `Propozycja: ${metrics.recommended} zmian/s. Przekaż ją nadajnikowi kodem zwrotnym; tempo nie zmienia się automatycznie na drugim urządzeniu.`;
  }
  function resetTelemetry() {
    if (telemetry) telemetry.reset();
    lastTelemetryPaint = 0;
    copyingDiagnostics = false;
    ui['transfer-telemetry'].hidden = true;
    ui['telemetry-title'].textContent = 'Statystyki odbioru';
    ui['telemetry-status'].textContent = '';
    for (const field of ['duration', 'speed', 'useful', 'read']) ui[`telemetry-${field}`].textContent = '—';
    ui['telemetry-detail'].textContent = '';
    ui['copy-diagnostics'].disabled = true;
    ui['diagnostics-text'].value = '';
    ui['diagnostics-text'].hidden = true;
    message('diagnostics-message');
  }
  function startCameraTelemetry(stream) {
    let settings = {};
    try { settings = stream.getVideoTracks()[0]?.getSettings?.() || {}; } catch { /* Optional metadata must not stop reception. */ }
    telemetry.startCamera({ width: settings.width, height: settings.height, frameRate: settings.frameRate });
    renderTelemetry(true);
  }
  function renderTelemetry(force = false) {
    if (!telemetry) return;
    const now = window.performance.now();
    if (!force && lastTelemetryPaint && now - lastTelemetryPaint < 250) return;
    lastTelemetryPaint = now;
    const data = telemetry.snapshot();
    const transfer = data.transfer;
    ui['transfer-telemetry'].hidden = !transfer;
    ui['copy-diagnostics'].disabled = !transfer || copyingDiagnostics;
    if (!transfer) return;
    const count = (value) => Number(value || 0).toLocaleString('pl-PL');
    const decimal = (value) => Number(value || 0).toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const milliseconds = (value) => Number.isFinite(value) ? `${decimal(value)} ms` : 'brak pomiaru';
    const protocol = transfer.version === 0 ? 'Pojedynczy QR' : `WGQR v${transfer.version}`;
    ui['telemetry-title'].textContent = 'Statystyki odbioru';
    ui['telemetry-status'].textContent = data.complete
      ? transfer.version === 0 ? 'Odczytany' : 'Zakończony'
      : cameraStream ? 'W trakcie' : 'Wstrzymany';
    ui['telemetry-duration'].textContent = `${decimal(data.elapsedMs / 1000)} s`;
    ui['telemetry-speed'].textContent = transfer.version === 0 ? 'nie dotyczy'
      : !data.complete ? 'po ukończeniu'
      : !Number.isFinite(data.averageBytesPerSecond) ? 'brak pomiaru czasu'
      : data.averageBytesPerSecond >= 1024 ? `${decimal(data.averageBytesPerSecond / 1024)} KiB/s`
        : `${decimal(data.averageBytesPerSecond)} B/s`;
    ui['telemetry-useful'].textContent = `${count(data.usefulUnits)} / ${count(transfer.total)}`;
    ui['telemetry-read'].textContent = count(data.qrReads);
    const video = data.video;
    const resolution = video && video.width && video.height ? `${count(video.width)} × ${count(video.height)}` : 'brak danych';
    const reportedFps = video && Number.isFinite(video.frameRate) ? `${decimal(video.frameRate)} kl./s` : 'brak danych';
    const pixels = data.lastScanPixels;
    ui['telemetry-detail'].textContent = [
      `Czas od pierwszej przyjętej porcji do wyniku: ${decimal(data.elapsedMs / 1000)} s (łącznie z przerwami).`,
      `Aktywny czas kamery: ${decimal(data.cameraActiveMs / 1000)} s; uruchomienia: ${count(data.cameraStarts)}.`,
      `Analizowane klatki kamery: ${count(data.cameraAttempts)}; obszary dekodowania: ${count(data.decodeAttempts)}; poprawne odczyty QR: ${count(data.opticalReads)}.`,
      `QR odczytane z obrazów: ${count(data.imageReads)}; przyjęte z obrazów: ${count(data.imagePackets)}.`,
      `Przyjęte pakiety: ${count(data.acceptedPackets)} (kamera: ${count(data.cameraPackets)}, obrazy: ${count(data.imagePackets)}).`,
      transfer.version === 4
        ? `Pakiety kończące zapis części: ${count(data.usefulPackets)}; pozostałe przyjęte pakiety: ${count(data.redundantPackets)}.`
        : `Pakiety wnoszące nowe dane: ${count(data.usefulPackets)}; przyjęte bez nowych danych: ${count(data.redundantPackets)}.`,
      transfer.version === 4
        ? `Części dopisane w tej sesji: ${count(data.usefulUnits)}; opisy części: ${count(data.manifestPackets)}.`
        : `Nowe porcje danych: ${count(data.usefulUnits)} / ${count(transfer.total)}; opisy pliku: ${count(data.manifestPackets)}.`,
      `Odrzucone odczyty: ${count(data.rejectedPackets)} (inny plik: ${count(data.rejections.foreign)}, nieprawidłowy: ${count(data.rejections.invalid)}, potwierdzenie: ${count(data.rejections.feedback)}).`,
      `Obróbka klatki — średnio: ${milliseconds(data.latencyAvgMs)}; p95${data.latencyP95Approximate ? ' w przybliżeniu' : ''}: ${milliseconds(data.latencyP95Ms)}.`,
      `Tryb skanowania — śledzenie: ${count(data.trackedAttempts)}, szukanie: ${count(data.searchAttempts)}.`,
      `Kamera zgłasza: ${resolution}; ${reportedFps}. To nie jest tempo odczytu kodów ani tempo nadajnika.`,
      `Ostatni obszar dekodowania: ${pixels ? `${count(pixels.width)} × ${count(pixels.height)}` : 'brak pomiaru'}.`,
      `Wersja aplikacji: ${data.appVersion}. Protokół: ${protocol}.`,
      transfer.version === 4
        ? `Rozmiar pliku: ${byteCount(transfer.size)}. Część: ${byteCount(transfer.chunkBytes)}. Zapisane części: ${count(transfer.blocksComplete)} / ${count(transfer.blockCount)}.`
        : `Rozmiar pliku: ${byteCount(transfer.size)}. Porcja: ${byteCount(transfer.chunkBytes)}. Bloki: ${count(transfer.blocksComplete)} / ${count(transfer.blockCount)}.`,
      transfer.version === 4
        ? 'Wiele pakietów składa się na jedną część. Pakiety przed jej ukończeniem nadal mogą wnosić nowe dane, ale nie zwiększają jeszcze licznika trwale zapisanych części.'
        : 'Próba bez odczytu nie oznacza zgubionego QR. Pakiet bez nowych danych może być powtórzeniem lub zależnym równaniem naprawczym.'
    ].join('\n');
    if (transfer.version === 4) {
      const newlySaved = Math.max(0, (receiverSnapshot?.savedBytes || 0) - largeResumeBytes);
      ui['telemetry-useful'].textContent = count(transfer.blocksComplete) + ' / ' + count(transfer.blockCount) + ' zapisanych części';
      ui['telemetry-speed'].textContent = data.elapsedMs > 0 && newlySaved > 0
        ? decimal(newlySaved * 1000 / data.elapsedMs / 1024) + ' KiB/s' : 'po zapisaniu części';
      ui['telemetry-detail'].textContent += '\nDuży transfer: prędkość dotyczy bajtów zapisanych w tej sesji, bez części przywróconych wcześniej. Postęp bieżącej części nie jest jeszcze trwały. Przywrócono: ' + byteCount(largeResumeBytes) + '.';
    }
  }
  function recordPacketTelemetry(result, delta, source) {
    // Only numerical protocol metadata enters diagnostics. No filename, content, ID or digest.
    const firstPacket = ui['transfer-telemetry'].hidden;
    telemetry.recordPacket({
      version: result.version, size: result.size, total: result.total, chunkBytes: result.chunkBytes,
      blockCount: result.blockCount, received: result.received, blocksComplete: result.blocksComplete,
      complete: Boolean(result.complete || result.kind === 'complete')
    }, { delta, source, packetType: result.packetType || (result.version === 0 ? 'plain' : result.version === 1 ? 'legacy' : 'unknown') });
    renderTelemetry(firstPacket || Boolean(result.complete || result.kind === 'complete'));
  }
  async function copyDiagnostics() {
    if (!telemetry || !telemetry.snapshot().transfer || copyingDiagnostics) return;
    const epoch = receiverEpoch;
    const data = JSON.parse(telemetry.report());
    if (receiverSnapshot?.version === 4) {
      const newlySaved = Math.max(0, receiverSnapshot.savedBytes - largeResumeBytes);
      data.averageBytesPerSecond = data.complete && data.elapsedMs > 0
        ? Math.round(newlySaved * 1000 / data.elapsedMs * 1000) / 1000 : null;
      data.large = { savedBytes: receiverSnapshot.savedBytes, restoredBytes: largeResumeBytes,
        pendingBytes: receiverSnapshot.pendingBytes || 0, segmentCount: receiverSnapshot.segmentCount,
        completedSegments: receiverSnapshot.completedSegments, measurement: 'newly-saved-bytes-in-this-session' };
    }
    const report = JSON.stringify(data, null, 2);
    copyingDiagnostics = true;
    ui['copy-diagnostics'].disabled = true;
    message('diagnostics-message');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard-unavailable');
      await navigator.clipboard.writeText(report);
      if (epoch !== receiverEpoch) return;
      ui['diagnostics-text'].value = '';
      ui['diagnostics-text'].hidden = true;
      message('diagnostics-message', 'Skopiowano lokalny raport diagnostyczny w formacie JSON.', 'success');
    } catch {
      if (epoch !== receiverEpoch) return;
      const field = ui['diagnostics-text'];
      field.value = report;
      field.hidden = false;
      field.readOnly = true;
      field.focus();
      field.select();
      try { field.setSelectionRange(0, report.length); } catch { /* Native selection is enough on older browsers. */ }
      message('diagnostics-message', 'Przeglądarka nie pozwoliła skopiować automatycznie. Zaznaczony raport JSON skopiuj ręcznie.', 'warning');
    } finally {
      if (epoch === receiverEpoch) {
        copyingDiagnostics = false;
        renderTelemetry(true);
      }
    }
  }
  function resetCollector() {
    if (largeStorageBusy && !largeStore) {
      largeStorageEpoch++;
      largeStorageBusy = false;
      decodeBusy(false);
      message('large-storage-status');
      renderLargeStorage();
    }
    receiverEpoch += 1;
    receiverActivity = null;
    if (collector) collector.reset();
    if (largeReceiver) largeReceiver.reset();
    resetTelemetry();
    resetCalibrationReadout();
    calibrationCaptureGrid = null;
    receiverSnapshot = null;
    showReceiving(null, true);
    hideFeedback();
    resetMetrics();
  }
  function prepareReceiver() {
    // Restarting the calibration camera must not discard its measurements
    // because an earlier file is still available in the other receiver view.
    if (receiverView === 'calibration') return;
    if ((receiverSnapshot && receiverSnapshot.complete) || decodedBytes || decodedFile || telemetry?.snapshot().complete) resetCollector();
    clearDecoded();
    showReceiving(receiverSnapshot, true);
  }
  function receiverError(error) {
    if (error.code === 'TRANSFER_RESET') return;
    const nextState = collector.state;
    if (receiverSnapshot && !nextState) {
      // A failed final digest invalidates the collector. The next file must not
      // inherit counters, time or a pending clipboard result from that session.
      resetCollector();
      if (cameraStream) startCameraTelemetry(cameraStream);
    } else {
      receiverSnapshot = nextState;
      showReceiving(receiverSnapshot, true);
    }
    const text = error.code === 'FEEDBACK_FRAME'
      ? 'To kod zwrotny odbiornika. Na urządzeniu nadającym wybierz „Zeskanuj potwierdzenie”. Ten kod nie jest plikiem.'
      : error.code === 'UNSUPPORTED_VERSION'
        ? 'Nieobsługiwana wersja kodu. Odśwież tę stronę na obu urządzeniach i rozpocznij odbiór ponownie.'
      : error.code === 'CRYPTO_UNAVAILABLE'
      ? 'Sprawdzenie serii wymaga HTTPS i obsługi Web Crypto. Otwórz stronę w aktualnym Safari lub Chrome.'
      : /HASH|DIGEST/i.test(error.code || '')
        ? 'Suma pliku nie zgadza się. Odrzucono tę serię; zeskanuj ją ponownie od początku.'
        : 'Ten fragment jest uszkodzony albo ma nieprawidłowy format. Spróbuj ponownie; poprawne odebrane fragmenty pozostają zachowane.';
    message('decode-message', text, 'error');
    if (mode === 'decode') status('Nie przyjęto nieprawidłowego fragmentu');
  }
  function ignoredFileDuringCalibration() {
    if (!calibrationObserver.state) message('decode-message', 'Tryb kalibracji: czekam na próbne kody nadajnika. Aby odebrać plik, wybierz „Odbiór pliku”.');
    return { done: false, blocked: true, calibration: true };
  }
  function prepareAcceptedFile(scanTelemetry) {
    // A decoded candidate must never erase a trial. Only an accepted file in
    // the explicitly selected file view may replace calibration measurements.
    if (receiverView !== 'file' || !calibrationObserver.state) return;
    resetCalibrationReadout();
    resetMetrics(); resetTelemetry();
    if (cameraStream) startCameraTelemetry(cameraStream);
    // Keep the first file scan when its validated packet replaces a trial.
    // Record it before a single/last packet can freeze completed statistics.
    if (scanTelemetry) telemetry.recordScan(scanTelemetry);
  }
  function receiveBytes(bytes, isCurrent, source = 'camera', deferCalibrationPaint = false, scanTelemetry = null) {
    const epoch = receiverEpoch;
    const payload = Uint8Array.from(bytes);
    const operation = receiverChain.then(async () => {
      if (epoch !== receiverEpoch || !isCurrent()) return { done: false, stale: true };
      try {
        if (!payload.length) return { done: false, blocked: true };
        if (window.WGCalibration.isFrame(payload)) {
          if (receiverViewChosen && receiverView === 'file') return { done: false, blocked: true, calibration: true };
          return receiveCalibration(payload, source, deferCalibrationPaint);
        }
        if (receiverView === 'calibration') return ignoredFileDuringCalibration();
        if (receiverSnapshot && receiverSnapshot.complete) {
          stopCamera();
          return { done: true, delta: 0 };
        }
        if (window.WGCalibration.isFeedback(payload)) {
          message('decode-message', 'To wynik próby. Pokaż go kamerze nadajnika po wybraniu „Zeskanuj potwierdzenie”.', 'warning');
          return { done: false, blocked: true };
        }
        if (window.WGLarge.isReserved(payload)) return await receiveLargeBytes(payload, epoch, source, scanTelemetry);
        if (receiverSnapshot?.version === 4 && !receiverSnapshot.complete) {
          message('decode-message', 'Trwa odbiór dużego pliku. Aby odebrać zwykły QR lub inną serię, najpierw użyj „Reset odbioru”.', 'warning');
          return { done: false, blocked: true };
        }
        const previous = receiverSnapshot;
        const result = await collector.accept(payload);
        // Switching tabs or stopping the camera retains an already accepted transfer.
        // Clearing/resetting the receiver, however, invalidates even a pending digest.
        if (epoch !== receiverEpoch) return { done: false, stale: true };
        if (receiverView === 'calibration' && ['plain', 'pending', 'foreign'].includes(result.kind)) return ignoredFileDuringCalibration();
        if (result.kind === 'pending') {
          prepareAcceptedFile(scanTelemetry);
          selectReceiverActivity('file');
          message('decode-message', 'Widzę dane. Czekam na powtarzany opis pliku; pozostaw kamerę skierowaną na kody.', 'success');
          return { done: false, pending: true };
        }
        if (result.kind === 'plain') {
          if (previous && !previous.complete && previous.received > 0) {
            telemetry.recordRejected('foreign', { source });
            renderTelemetry();
            showReceiving(receiverSnapshot, true);
            message('decode-message', 'Trwa odbiór serii. Aby otworzyć pojedynczy QR, najpierw wybierz „Reset odbioru”.', 'warning');
            return { done: false, blocked: true };
          }
          prepareAcceptedFile(scanTelemetry);
          selectReceiverActivity('file');
          recordPacketTelemetry({
            version: 0, size: result.bytes.length, total: 1, chunkBytes: result.bytes.length,
            blockCount: 1, received: 1, blocksComplete: 1, complete: true
          }, 1, source);
          stopCamera();
          return { done: acceptDecoded(result) };
        }
        if (result.kind === 'foreign') {
          telemetry.recordRejected('foreign', { source });
          renderTelemetry();
          showReceiving(result, true);
          message('decode-message', 'To fragment innego pliku. Dokończ bieżącą serię albo wybierz „Reset odbioru”.', 'warning');
          return { done: false, foreign: true };
        }
        if (result.kind === 'complete') {
          prepareAcceptedFile(scanTelemetry);
          selectReceiverActivity('file');
          receiverSnapshot = { ...result, bytes: undefined, complete: true };
          const delta = Math.max(0, result.total - (previous?.received || 0));
          recordPacketTelemetry(receiverSnapshot, delta, source);
          const showFile = receiverView === 'file';
          if (showFile) stopCamera();
          showReceiving(receiverSnapshot, true);
          const accepted = acceptDecoded(result, result.name, true);
          return { done: showFile && accepted, delta };
        }
        prepareAcceptedFile(scanTelemetry);
        selectReceiverActivity('file');
        const delta = Math.max(0, result.received - (previous?.received || 0));
        receiverSnapshot = result;
        recordPacketTelemetry(result, delta, source);
        if (delta > 0 || !previous) showReceiving(result);
        return { done: false, progress: true, delta };
      } catch (error) {
        if (receiverView === 'calibration' && !window.WGCalibration.isFrame(payload)) return ignoredFileDuringCalibration();
        if (epoch === receiverEpoch && error.code !== 'TRANSFER_RESET') {
          telemetry.recordRejected(error.code === 'FEEDBACK_FRAME' ? 'feedback' : 'invalid', { source });
          renderTelemetry();
          receiverError(error);
        }
        return { done: false, error: true };
      }
    }).finally(() => payload.fill(0));
    // Keep operations serial without allowing a rejected old operation to block a new one.
    receiverChain = operation.catch(() => undefined);
    return operation;
  }
  function hideFeedback() {
    ui['feedback-panel'].hidden = true;
    clearQR(ui['feedback-canvas']);
    ui['feedback-caption'].textContent = '';
  }
  function showFeedback() {
    if (!receiverSnapshot || receiverSnapshot.version < 2) return;
    stopCamera();
    let bytes;
    try {
      bytes = (receiverSnapshot.version === 4 ? largeReceiver : collector).createFeedback({ suggestedRate: metrics.recommended });
      ui['feedback-panel'].hidden = false;
      drawQR(window.WGQR.encodeBytes(bytes), ui['feedback-canvas']);
      ui['resume-receiving'].hidden = Boolean(receiverSnapshot.complete);
      ui['feedback-caption'].textContent = receiverSnapshot.complete
        ? 'Odbiór pliku został sprawdzony. Na nadajniku wybierz „Zeskanuj potwierdzenie”, aby potwierdzić zakończenie.'
        : `Na nadajniku wybierz „Zeskanuj potwierdzenie”. Kod wskaże niepełne bloki i zaproponuje ${metrics.recommended} zmian/s. Potem wznowisz odbiór.`;
      if (receiverSnapshot.version === 4 && !receiverSnapshot.complete) ui['feedback-caption'].textContent = 'Kod wskazuje całe brakujące części. Po zeskanowaniu nadajnik rozpocznie pierwszą z nich. Zapisane części pozostają na odbiorniku; nieukończona część może zacząć się od początku.';
      ui['close-feedback'].focus();
    } catch {
      message('decode-message', 'Kod zwrotny jest dostępny po odebraniu fragmentu nowej serii. Odśwież obie strony, jeśli używasz starszej wersji.', 'error');
    } finally {
      if (bytes) bytes.fill(0);
    }
  }
  function calibrationGridAllowed() {
    if (ui['calibration-layout-scope'].value !== 'current') return true;
    const grid = selectedGrid();
    return grid.lanes === 1 || grid.columns > grid.rows;
  }
  function updateCalibrationDuration() {
    const all = ui['calibration-layout-scope'].value === 'all';
    const compare = ui['calibration-layout-scope'].value === 'compare';
    const extended = ui['calibration-range'].value === 'fast';
    const grid = selectedGrid();
    const layouts = all ? window.WGCalibration.landscapeGrids.length : compare ? window.WGCalibration.landscapeComparedGrids.length : 1;
    const profiles = (extended ? 10 : 6) * layouts;
    const plan = all ? `Jeden QR i ${layouts - 1} układów poziomych, w tym 3 × 2, 4 × 2 i 5 × 3. Pomiar od najmniejszego do największego`
      : compare ? 'Układy: 1 × 1 → 2 × 1 → 3 × 1 → 3 × 2' : `Tylko układ ${grid.columns} × ${grid.rows} QR`;
    const rates = extended ? '2, 5, 10, 15, 20' : '2, 5, 10';
    const allowed = calibrationGridAllowed();
    ui['start-calibration'].disabled = encodingBusy || calibrationActive || !allowed;
    setText(ui['calibration-duration'], allowed
      ? `${plan}. Gęstości: 384/600 B na QR. Tempo: ${rates} Hz. Liczba profili: ${profiles} · około ${profiles * 5} s pomiaru z przerwami na zmianę ustawień. ${all ? 'Najpierw zmieść w kadrze 15 rzadkich kodów ustawienia.' : compare ? 'Najpierw ustaw kadr na sześciu nieruchomych kodach w układzie 3 × 2.' : 'Najpierw spokojnie ustaw telefon.'} Ten etap nie ma limitu czasu.`
      : `Wybrano ${grid.columns} × ${grid.rows}. Kalibracja wielu kodów wymaga układu poziomego: ustaw więcej kolumn niż wierszy w polu „Układ serii”, np. 3 × 2. Możesz też wybrać porównanie układów poziomych.`);
  }
  function discardCalibrationFrames() {
    for (const frame of lastDisplayFrames) if (frame.kind === 'calibration') frame.matrix.data.fill(0);
  }
  function presentCalibration(matrices, grid) {
    discardCalibrationFrames();
    calibrationDisplayGrid = grid;
    lastDisplayFrames = matrices.map(matrix => ({ kind: 'calibration', matrix }));
    redrawCurrent();
  }
  function restoreCalibrationView() {
    discardCalibrationFrames();
    calibrationDisplayGrid = null;
    if (calibrationSavedView) {
      const saved = calibrationSavedView;
      lastDisplayFrames = saved.frames;
      ui['frame-position'].textContent = saved.position;
      ui['qr-caption'].textContent = saved.caption;
      ui['qr-empty'].hidden = saved.emptyHidden;
      ui['qr-result'].hidden = saved.resultHidden;
      ui['series-controls'].hidden = saved.controlsHidden;
      ui['download-qr'].disabled = saved.downloadDisabled;
      calibrationSavedView = null;
      if (!lastDisplayFrames.length) for (let index = 0; index < MAX_QR_CODES; index++) clearQR(qrCanvas(index));
      if (saved.resultHidden && document.body.classList.contains('qr-expanded')) closeExpanded();
      redrawCurrent();
    }
  }
  function canReceiveFeedback() { return Boolean(calibration || (series && series.version >= 2)); }
  function lockCalibration(locked) {
    document.body.classList.toggle('qr-calibrating', locked);
    for (const id of ['calibration-range', 'calibration-layout-scope', 'qr-density', 'qr-layout', 'qr-columns', 'qr-rows', 'series-ecc',
      'previous-frame', 'next-frame', 'frame-slider', 'frame-rate', 'large-segment', 'large-previous', 'large-next']) ui[id].disabled = locked;
    ui['start-calibration'].disabled = locked || encodingBusy || !calibrationGridAllowed();
    ui['start-calibration'].hidden = locked;
    ui['animation-toggle'].disabled = locked || !series || transmissionPhase === 'confirmed';
    ui['stop-calibration'].hidden = !locked;
    ui['scan-feedback'].disabled = encodingBusy || !canReceiveFeedback();
    lockLargeWaiting();
  }
  function stopCalibration(showEnd = false) {
    const wasActive = calibrationActive;
    if (calibrationTimer !== null) window.clearTimeout(calibrationTimer);
    calibrationTimer = null;
    calibrationActive = false;
    calibrationCleanup?.();
    calibrationCleanup = null;
    calibrationPhase = showEnd ? 'finished' : 'idle';
    if (wasActive) matrixEncoder?.reset();
    ui['begin-calibration'].hidden = true;
    lockCalibration(false);
    if (showEnd && calibration) {
      const bytes = calibration.endFrame();
      let matrix;
      try { matrix = window.WGQR.encodeBytes(bytes); } finally { bytes.fill(0); }
      const profile = calibration.profiles.at(-1);
      presentCalibration(Array.from({ length: profile.lanes || calibration.lanes }, () => matrix), profile.grid || selectedGrid());
      ui['frame-position'].textContent = 'Kalibracja zakończona';
      ui['qr-caption'].textContent = 'Kod zakończenia próby. Zostaw go widoczny, aż odbiornik pokaże wyniki.';
      ui['calibration-step'].textContent = '3. Przekaż wynik QR';
      ui['calibration-status'].textContent = 'Na odbiorniku sprawdź luki i wybierz „Pokaż wynik nadajnikowi”. Tutaj wybierz „Zeskanuj potwierdzenie”. Jeśli żaden profil nie jest kompletny, popraw kadr i powtórz próbę.';
    } else {
      restoreCalibrationView();
      if (wasActive) {
        ui['calibration-step'].textContent = sourceBytes || largeSourceFile
          ? 'Kalibracja przerwana — plik pozostaje w pauzie' : 'Kalibracja przerwana — możesz zacząć ponownie';
        ui['calibration-status'].textContent = 'Próba zatrzymana. Przed kolejną próbą wybierz „Zresetuj próbę” na odbiorniku.';
      }
    }
  }
  async function startCalibration() {
    if (encodingBusy || largeLoading || mode !== 'encode' || document.hidden || !calibrationGridAllowed()) return;
    stopCalibration(false);
    expandAfterCalibration = false;
    calibrationWasExpanded = false;
    pauseAnimation();
    stopFeedbackCamera();
    if (calibration) calibration.dispose();
    calibration = window.WGCalibration.create({ grid: selectedGrid(), compareLayouts: ui['calibration-layout-scope'].value === 'compare',
      allLayouts: ui['calibration-layout-scope'].value === 'all', landscapeOnly: true,
      // A standalone trial includes the larger packet overhead because the future file size is unknown.
      ecc: selectedEcc(), extended: ui['calibration-range'].value === 'fast', large: Boolean(largeSender) || (!sourceBytes && !largeSourceFile) });
    calibrationSavedView = { frames: lastDisplayFrames, position: ui['frame-position'].textContent, caption: ui['qr-caption'].textContent,
      emptyHidden: ui['qr-empty'].hidden, resultHidden: ui['qr-result'].hidden, controlsHidden: ui['series-controls'].hidden,
      downloadDisabled: ui['download-qr'].disabled };
    lastDisplayFrames = [];
    for (let index = 0; index < MAX_QR_CODES; index++) clearQR(qrCanvas(index));
    ui['qr-empty'].hidden = true;
    ui['qr-result'].hidden = false;
    ui['download-qr'].disabled = true;
    calibrationPhase = 'alignment';
    calibrationActive = true;
    openExpanded();
    lockCalibration(true);
    ui['begin-calibration'].hidden = true;
    ui['calibration-step'].textContent = '1. Ustaw telefon';
    ui['calibration-status'].textContent = 'Przygotowuję nieruchome, sztuczne kody do ustawienia kadru…';
    const token = sourceEpoch, trial = calibration;
    const current = () => calibrationActive && calibrationPhase === 'alignment' && calibration === trial && token === sourceEpoch && !document.hidden;
    const packets = Array.from({ length: trial.alignmentLanes }, (_, lane) => ({ bytes: trial.alignmentFrame(lane, trial.alignmentIndex, true), errorCorrectionLevel: trial.ecc }));
    try {
      let pending;
      try { pending = matrixEncoder.encodeBatch(packets); } finally { packets.forEach(packet => packet.bytes.fill(0)); }
      const matrices = await pending;
      if (!current()) { matrices.forEach(matrix => matrix.data.fill(0)); return; }
      const grid = trial.profiles[trial.alignmentIndex].grid;
      presentCalibration(matrices, grid);
      ui['frame-position'].textContent = `Ustawienie kadru · ${grid.columns} × ${grid.rows} QR`;
      ui['qr-caption'].textContent = trial.version >= 4
        ? 'Kody ustawienia kadru. Zmieść cały układ z białymi marginesami; właściwa próba sprawdzi gęstsze kody.'
        : 'Sztuczne dane. Uruchom kamerę odbiornika i zmieść wszystkie kody z białymi marginesami.';
      ui['calibration-status'].textContent = 'Odbiornik pokaże, ile kodów widzi. Gdy odczyt jest stabilny, wybierz „Rozpocznij pomiar”. Utrzymaj tę samą odległość i rozmiar widoku przez całą próbę.';
      ui['begin-calibration'].hidden = false;
      ui['begin-calibration'].disabled = false;
      status('Kalibracja — ustaw telefon przed pomiarem');
    } catch (error) {
      if (!current() || error.name === 'AbortError') return;
      stopCalibration(false);
      ui['calibration-status'].textContent = 'Nie udało się przygotować kalibracji. Możesz powtórzyć próbę lub wybrać ustawienia ręcznie.';
    }
  }
  function beginCalibration() {
    if (!calibrationActive || calibrationPhase !== 'alignment' || !calibration || document.hidden || ui['begin-calibration'].hidden) return;
    calibrationPhase = 'measuring';
    calibrationWasExpanded = document.body.classList.contains('qr-expanded');
    ui['begin-calibration'].hidden = true;
    ui['calibration-step'].textContent = '2. Zmierz odbiór';
    const token = sourceEpoch, trial = calibration;
    const started = window.performance.now(), settleMs = 1000, cycle = trial.duration + settleMs;
    let ready = null, inFlight = null, cancelled = false, lastPresented = '';
    const erase = matrices => matrices.forEach(matrix => matrix.data.fill(0));
    const current = () => !cancelled && calibrationActive && calibrationPhase === 'measuring'
      && calibration === trial && token === sourceEpoch && !document.hidden;
    const cleanup = () => {
      cancelled = true;
      if (ready) erase(ready.matrices);
      ready = null; inFlight = null;
    };
    calibrationCleanup = cleanup;
    function slot(index, step) {
      if (index >= trial.profiles.length) return null;
      const profile = trial.profiles[index], base = started + index * cycle;
      const start = step < 0 ? base : base + settleMs + step * 1000 / profile.fps;
      const end = step < 0 ? base + settleMs : base + settleMs + (step + 1) * 1000 / profile.fps;
      return { index, step, profile, start, end, key: `${index}:${step}` };
    }
    function slotAt(now) {
      const elapsed = Math.max(0, now - started), index = Math.floor(elapsed / cycle);
      if (index >= trial.profiles.length) return null;
      const local = elapsed - index * cycle, profile = trial.profiles[index];
      return slot(index, local < settleMs ? -1 : Math.min(profile.fps * trial.duration / 1000 - 1,
        Math.floor((local - settleMs) * profile.fps / 1000)));
    }
    function nextSlot(value) {
      return value.step + 1 < value.profile.fps * trial.duration / 1000
        ? slot(value.index, value.step + 1) : slot(value.index + 1, -1);
    }
    async function prepare(value) {
      if (!value || !current() || ready || inFlight) return;
      const job = { slot: value }; inFlight = job;
      try {
        const { index, step, profile } = value, lanes = profile.lanes || trial.lanes;
        const packets = Array.from({ length: lanes }, (_, lane) => ({
          bytes: step < 0 ? trial.alignmentFrame(lane, index) : trial.frame(index, step * lanes + lane),
          errorCorrectionLevel: trial.ecc
        }));
        let pending;
        try { pending = matrixEncoder.encodeBatch(packets); } finally { packets.forEach(packet => packet.bytes.fill(0)); }
        const matrices = await pending, now = window.performance.now();
        // Measured packets must be ready before their display boundary. A late
        // encoder result is a missing slot, never a shorter flash or catch-up.
        if (!current() || inFlight !== job || now >= value.end || (value.step >= 0 && now > value.start)) erase(matrices);
        else ready = { slot: value, matrices };
      } catch (error) {
        if (current() && error.name !== 'AbortError') {
          stopCalibration(false);
          ui['calibration-status'].textContent = 'Przygotowanie kodów nie powiodło się. Powtórz próbę lub wybierz ustawienia ręcznie.';
        }
      } finally {
        if (inFlight === job) inFlight = null;
        if (current()) tickCalibration();
      }
    }
    function tickCalibration() {
      if (!current()) { cleanup(); return; }
      if (calibrationTimer !== null) window.clearTimeout(calibrationTimer);
      calibrationTimer = null;
      const now = window.performance.now(), activeSlot = slotAt(now);
      if (!activeSlot) { stopCalibration(true); return; }
      if (ready && now >= ready.slot.start) {
        const value = ready.slot, matrices = ready.matrices;
        // Permit bounded timer jitter, without moving any following deadline.
        // Unmeasured settling codes may appear later within their one-second slot.
        const tolerance = Math.min(10, (value.end - value.start) * 0.2);
        ready = null;
        if (value.key !== activeSlot.key || now >= value.end || (value.step >= 0 && now - value.start > tolerance)) erase(matrices);
        else {
          const { index, step, profile } = value;
          lastPresented = value.key;
          void prepare(nextSlot(value));
          if (!current()) { erase(matrices); return; }
          presentCalibration(matrices, profile.grid);
          ui['frame-position'].textContent = `${step < 0 ? 'Zmiana ustawień' : 'Pomiar'} ${index + 1}/${trial.profiles.length} · ${profile.grid.columns} × ${profile.grid.rows} · ${profile.chunkBytes} B · ${profile.fps} zmian/s`;
          setText(ui['qr-caption'], `Sztuczne dane · profil ${index + 1}/${trial.profiles.length} · ${profile.grid.columns} × ${profile.grid.rows} QR · ${profile.chunkBytes} B · ${profile.fps} zmian/s${step < 0 ? ' · przygotowanie' : ''}`);
          setText(ui['calibration-status'], `Kalibracja: około ${trial.profiles.length * cycle / 1000} s. Profil ${index + 1}/${trial.profiles.length}. Trzymaj urządzenia nieruchomo; luki i wahania oceni odbiornik.`);
        }
      }
      // One prepared view is enough. Its successor is encoded while that view
      // is visible, so encoding time does not shorten the planned exposure.
      if (!ready && !inFlight) void prepare(activeSlot.step < 0 && lastPresented !== activeSlot.key ? activeSlot : nextSlot(activeSlot));
      if (!current()) return;
      const next = ready ? ready.slot.start : activeSlot.end;
      calibrationTimer = window.setTimeout(tickCalibration, Math.max(1, Math.ceil(next - window.performance.now())));
    }
    tickCalibration();
  }
  function resetAlignment() {
    if (alignmentTimer !== null) window.clearTimeout(alignmentTimer);
    alignmentTimer = null;
    alignmentState = null;
    ui['calibration-alignment'].hidden = true;
  }
  function paintAlignment() {
    if (!alignmentState || !cameraStream) return;
    const now = window.performance.now(), slots = alignmentState.slots;
    const recent = slots.filter(slot => now - slot.last <= 900);
    const stable = recent.length === slots.length && recent.every(slot => slot.hits >= 3 && slot.last - slot.first >= 400);
    ui['calibration-alignment'].hidden = false;
    ui['calibration-alignment'].dataset.quality = stable ? 'good' : recent.length ? 'warning' : 'searching';
    setText(ui['alignment-status'], stable ? `Stabilny odczyt ${slots.length}/${slots.length} kodów` : `Widzę ${recent.length}/${slots.length} kodów`);
    const grid = alignmentState.grid;
    setText(ui['alignment-detail'], stable
      ? alignmentState.setup
        ? 'Kadr jest gotowy do próby. Na nadajniku rozpocznij pomiar. Zielony wskaźnik potwierdza odczyt nieruchomych kodów; szybkość sprawdzi dopiero pomiar.'
        : 'Układ jest czytelny. Pomiar tego profilu rozpocznie się automatycznie; utrzymaj urządzenia nieruchomo.'
      : `Układ ${grid.columns} × ${grid.rows}. Zmieść wszystkie kody z białymi marginesami, ustaw ostrość i przytrzymaj telefon. Jeśli kodów nie widać, wybierz taki sam układ odbiornika.`);
    if (alignmentTimer !== null) window.clearTimeout(alignmentTimer);
    alignmentTimer = window.setTimeout(paintAlignment, 300);
  }
  function recordAlignment(parsed) {
    if (!cameraStream) return;
    const grid = parsed.grid || { columns: parsed.lanes, rows: 1 };
    const now = window.performance.now(), key = `${parsed.id}:${parsed.index}`;
    if (!alignmentState || alignmentState.key !== key) alignmentState = { key, grid, slots: Array.from({ length: parsed.lanes }, () => ({ first: -Infinity, last: -Infinity, hits: 0 })) };
    alignmentState.setup = Boolean(parsed.setup);
    const slot = alignmentState.slots[parsed.sequence % parsed.lanes];
    if (now - slot.last > 900) { slot.first = now; slot.hits = 0; }
    slot.last = now; slot.hits++;
    paintAlignment();
  }
  function selectReceiverView(nextView, chosen = false) {
    const requested = nextView === 'calibration' ? 'calibration' : 'file';
    if (chosen) receiverViewChosen = true;
    if (receiverViewPainted && receiverView === requested) return;
    receiverView = requested;
    receiverViewPainted = true;
    const calibrationVisible = receiverView === 'calibration';
    ui['decode-panel'].dataset.receiverView = receiverView;
    ui['receiver-view-file'].setAttribute('aria-pressed', String(!calibrationVisible));
    ui['receiver-view-calibration'].setAttribute('aria-pressed', String(calibrationVisible));
    ui['receiver-file-input'].hidden = calibrationVisible;
    ui['receiver-file-output'].hidden = calibrationVisible;
    ui['receiver-calibration-dashboard'].hidden = !calibrationVisible;
  }
  function selectReceiverActivity(activity, newSession = false) {
    // Automatic discovery is available until the user chooses a mode. A QR
    // cannot undo that choice, including a different session or file type.
    if (!receiverViewChosen && (newSession || receiverActivity !== activity)) selectReceiverView(activity);
    receiverActivity = activity;
  }
  function resetCalibrationReadout() {
    pendingCalibrationPaint = null;
    calibrationObserver?.reset();
    calibrationView?.reset();
    calibrationFromImages = false;
    calibrationRenderedKey = '';
    resetAlignment();
    ui['calibration-panel'].hidden = true;
    ui['show-calibration-feedback'].hidden = true;
    ui['calibration-results'].replaceChildren();
    ui['calibration-progress'].value = 0;
    renderCalibrationDashboard(null, false);
  }
  function calibrationCellLabel(cell, fromImages) {
    if (cell.state === 'passed') return fromImages ? '✓ Komplet' : '✓ Przeszło';
    if (cell.state === 'failed') return '× Nie przeszło';
    if (cell.state === 'running') return '● Pomiar';
    return cell.active ? '… Ustawienie' : '— Czeka';
  }
  function renderCalibrationDashboard(state, fromImages) {
    const model = calibrationView?.compute(state, { fromImages });
    if (!model) {
      calibrationMapKey = '';
      calibrationMapCells.clear();
      ui['calibration-map'].replaceChildren();
      setText(ui['calibration-view-status'], 'Czekam na kody kalibracyjne nadajnika.');
      for (const name of ['grid', 'rate', 'density']) setText(ui['calibration-current-' + name], '—');
      for (const name of ['passed', 'failed', 'pending', 'running']) setText(ui['calibration-count-' + name], '0');
      setText(ui['calibration-current-detail'], 'Na nadajniku wybierz „Kalibracja”. Tutaj uruchom kamerę i pokaż jej próbne kody. Plik nie jest potrzebny.');
      setText(ui['calibration-map-help'], 'Mapa pojawi się po odczytaniu planu próby. Szare pola będą czekać na pomiar; przed odebraniem kodów nie ma jeszcze wyników.');
      return null;
    }
    if (calibrationMapKey !== model.key) {
      calibrationMapKey = model.key;
      calibrationMapCells.clear();
      ui['calibration-map'].replaceChildren();
      for (const group of model.groups) {
        const region = document.createElement('div');
        region.className = 'calibration-map-scroll';
        region.tabIndex = 0;
        region.setAttribute('role', 'region');
        region.setAttribute('aria-label', `Wyniki dla gęstości ${group.modules} × ${group.modules} modułów, ${group.chunkBytes} B danych`);
        const table = document.createElement('table'); table.className = 'calibration-map-table';
        const caption = document.createElement('caption');
        caption.textContent = `${group.modules} × ${group.modules} modułów · ${group.chunkBytes} B danych na QR`;
        table.appendChild(caption);
        const head = document.createElement('thead');
        const headings = document.createElement('tr');
        const axis = document.createElement('th'); axis.setAttribute('scope', 'col'); axis.textContent = 'QR: X × Y';
        headings.appendChild(axis);
        for (const fps of group.frequencies) {
          const heading = document.createElement('th'); heading.setAttribute('scope', 'col'); heading.textContent = `${fps} Hz`;
          headings.appendChild(heading);
        }
        head.appendChild(headings); table.appendChild(head);
        const body = document.createElement('tbody');
        for (const layout of group.layouts) {
          const row = document.createElement('tr');
          const heading = document.createElement('th'); heading.setAttribute('scope', 'row');
          heading.textContent = `${layout.grid.columns} × ${layout.grid.rows}`;
          row.appendChild(heading);
          for (const cell of layout.cells) {
            const element = document.createElement('td');
            element.dataset.profileIndex = String(cell.index);
            element.dataset.columns = String(cell.grid.columns);
            element.dataset.rows = String(cell.grid.rows);
            element.dataset.fps = String(cell.fps);
            element.dataset.chunkBytes = String(cell.chunkBytes);
            element.dataset.modules = String(cell.modules);
            const content = document.createElement('span'); content.className = 'calibration-map-cell';
            const value = document.createElement('strong'); value.className = 'calibration-map-value';
            const detail = document.createElement('span'); detail.className = 'calibration-map-label';
            content.appendChild(value); content.appendChild(detail); element.appendChild(content); row.appendChild(element);
            calibrationMapCells.set(cell.index, { element, value, detail });
          }
          body.appendChild(row);
        }
        table.appendChild(body); region.appendChild(table); ui['calibration-map'].appendChild(region);
      }
    }
    for (const group of model.groups) for (const layout of group.layouts) for (const cell of layout.cells) {
      const entry = calibrationMapCells.get(cell.index);
      if (!entry) continue;
      const label = calibrationCellLabel(cell, fromImages);
      const detail = cell.state === 'pending' ? cell.active ? 'Przed pomiarem' : 'Nieprzetestowane'
        : `${cell.received}/${cell.expected}${cell.state === 'failed' ? ` · braki: ${cell.missing}` : ' paczek'}`;
      if (entry.element.dataset.state !== cell.state) entry.element.dataset.state = cell.state;
      const active = String(cell.active), best = String(!fromImages && state.best?.index === cell.index);
      if (entry.element.dataset.active !== active) entry.element.dataset.active = active;
      if (entry.element.dataset.best !== best) entry.element.dataset.best = best;
      setText(entry.value, label); setText(entry.detail, detail);
      const description = `${cell.grid.columns} × ${cell.grid.rows} QR, ${cell.fps} Hz, ${cell.modules} × ${cell.modules} modułów: ${label}. ${detail}.`;
      if (entry.element.getAttribute('aria-label') !== description) entry.element.setAttribute('aria-label', description);
    }
    for (const name of ['passed', 'failed', 'pending', 'running']) {
      setText(ui['calibration-count-' + name], String(model.counts[name]));
    }
    const current = model.current;
    setText(ui['calibration-current-grid'], current ? `${current.grid.columns} × ${current.grid.rows} QR` : '—');
    setText(ui['calibration-current-rate'], current ? `${current.fps} Hz` : '—');
    setText(ui['calibration-current-density'], current ? `${current.modules} × ${current.modules} modułów` : '—');
    const phaseText = model.ended ? 'Kalibracja zakończona — sprawdź mapę wyników.'
      : model.phase === 'setup' ? 'Ustaw telefon. Pomiar rozpoczynasz na nadajniku.'
      : model.phase === 'settling' ? 'Zmiana ustawień — za chwilę pomiar kolejnej kombinacji.'
      : `Pomiar kombinacji ${current.index + 1}/${model.totalProfiles}.`;
    setText(ui['calibration-view-status'], fromImages ? `Odczyt z obrazów — bez pomiaru szybkości kamery. ${phaseText}` : phaseText);
    const counts = current && model.phase !== 'setup' && model.phase !== 'settling'
      ? `${current.received}/${current.expected} paczek · ${current.coverage.toLocaleString('pl-PL', { maximumFractionDigits: 1 })}% · ${model.ended ? 'braki' : 'jeszcze do odebrania'}: ${current.missing}. ` : '';
    setText(ui['calibration-current-detail'], current?.headerOnly
      ? `Rzadkie kody ustawienia kadru zawierają ${current.payloadBytes} B opisu próby. Pomiar tego profilu użyje ${current.plannedModules} × ${current.plannedModules} modułów i ${current.plannedChunkBytes} B danych na kod. Pomiar jeszcze się nie rozpoczął.`
      : current ? `${counts}${current.chunkBytes} B danych w kodzie. ${model.phase === 'setup' || model.phase === 'settling' ? 'Nieruchome kody służą do ustawienia kadru i nie liczą się do wyniku.'
        : model.ended ? 'Powyżej widać ostatnią mierzoną kombinację.' : 'Zielony wynik wymaga kompletu paczek z całych 4 sekund próby.'}` : '');
    setText(ui['calibration-map-help'], fromImages
      ? 'Odczyt z obrazów sprawdza tylko kompletność paczek. Zielony „Komplet” nie potwierdza odbioru z podaną częstotliwością. Wykonaj nową próbę kamerą, aby dobrać szybkość.'
      : `X to liczba kodów poziomo, Y — pionowo. Hz oznacza zmianę całego układu na sekundę. Moduł to mały kwadrat wewnątrz QR; jego rozmiar w pikselach zależy od ekranu. ${state.landscapeOnly
        ? state.allLayouts ? 'Próba obejmuje jeden QR oraz 9 układów poziomych do 5 × 3. Dla wielu kodów liczba kolumn jest większa od liczby wierszy.'
          : state.compareLayouts ? 'Szybkie porównanie obejmuje 1 × 1, 2 × 1, 3 × 1 i 3 × 2.' : 'Próba obejmuje wybrany układ poziomy albo jeden QR.'
        : state.allLayouts ? 'To poprzedni plan obejmujący wszystkie 15 siatek. Nowa kalibracja nadajnika sprawdza wyłącznie jeden QR i układy poziome.'
          : state.compareLayouts ? 'To poprzedni plan porównujący 1 × 1, 2 × 1, 1 × 2 i 2 × 2. Nowa kalibracja nadajnika sprawdza układy poziome.'
            : 'Próba obejmuje tylko układ wybrany na nadajniku.'}`);
    return model;
  }
  function renderCalibrationResults(state, fromImages) {
    const model = renderCalibrationDashboard(state, fromImages);
    const closed = model.groups.flatMap(group => group.layouts.flatMap(layout => layout.cells)).filter(cell => cell.closed);
    const key = `${model.key}:${model.phase}:${state.ended}:${fromImages}:${closed.map(cell => `${cell.index}:${cell.received}`).join(',')}`;
    if (calibrationRenderedKey === key) return;
    calibrationRenderedKey = key;
    const legacy = state.version < 3;
    ui['calibration-results'].replaceChildren();
    const completed = new Map(closed.map(cell => [cell.index, cell]));
    const show = state.results.filter(result => completed.has(result.index));
    for (const result of show) {
      const row = document.createElement('li');
      row.dataset.quality = completed.get(result.index).state === 'passed' ? 'good' : 'failed';
      row.dataset.best = String(!fromImages && state.best?.index === result.index);
      const grid = result.grid || { columns: state.lanes, rows: 1 };
      const title = document.createElement('strong');
      title.className = 'calibration-result-profile';
      title.textContent = `${grid.columns} × ${grid.rows} QR · ${result.fps} zmian/s · ${result.chunkBytes} B`;
      const detail = document.createElement('span'); detail.className = 'calibration-result-value';
      detail.textContent = legacy ? `${result.samples} odczytów${fromImages ? '' : ` · ${Math.round(result.bytesPerSecond)} B/s`}`
        : `${result.received}/${result.expected} paczek · ${result.coverage.toLocaleString('pl-PL', { maximumFractionDigits: 1 })}% · braki: ${result.missing}${fromImages ? '' : ` · ${Math.round(result.bytesPerSecond).toLocaleString('pl-PL')} B/s`}`;
      row.appendChild(title); row.appendChild(detail);
      if (!legacy) {
        const windows = document.createElement('ul'); windows.className = 'calibration-result-windows';
        for (const sample of result.perSecond) {
          const item = document.createElement('li');
          item.textContent = `${sample.index + 1}. s: ${sample.received}/${sample.expected}${fromImages ? '' : ` · ${Math.round(sample.bytesPerSecond)} B/s`}`;
          windows.appendChild(item);
        }
        row.appendChild(windows);
      }
      ui['calibration-results'].appendChild(row);
    }
    ui['calibration-coverage'].textContent = fromImages
      ? 'Kody wczytano z obrazów. To sprawdza kompletność paczek; do dobrania szybkości wykonaj nową próbę kamerą.'
      : legacy ? 'To starszy format próby. Odśwież oba urządzenia, aby mierzyć luki i porównywać siatki.'
      : `Profile z odczytem: ${state.measuredProfiles}/${state.totalProfiles}. Okna 1–4 odpowiadają sekundom nadawania. Braki obejmują całą drogę: przygotowanie, wyświetlenie i odczyt. Duplikaty nie zwiększają wyniku.`;
  }
  let calibrationFromImages = false;
  function receiveCalibration(bytes, source = 'camera', deferPaint = false) {
    if (receiverSnapshot && !receiverSnapshot.complete && (receiverSnapshot.received > 0 || receiverSnapshot.version === 4)) {
      message('decode-message', 'Trwa odbiór pliku. Aby wykonać próbę, najpierw wybierz „Reset odbioru”.', 'warning');
      return { done: false, blocked: true };
    }
    const parsed = window.WGCalibration.parse(bytes);
    const previous = calibrationObserver.state;
    const newSession = !previous || (previous.ended && previous.id !== parsed.id);
    if (newSession) {
      if (previous) { calibrationObserver.reset(); resetAlignment(); }
      calibrationFromImages = false;
      calibrationRenderedKey = '';
      if (source === 'camera' && cameraRequestedGrid) calibrationCaptureGrid = { ...cameraRequestedGrid };
    }
    if (receiverSnapshot) {
      collector.reset(); receiverSnapshot = null; showReceiving(null, true); resetTelemetry();
      if (cameraStream) startCameraTelemetry(cameraStream);
    }
    const state = calibrationObserver.accept(bytes, window.performance.now());
    if (state.foreign) {
      message('decode-message', 'Widzę inną próbę. Wybierz „Zresetuj próbę”, aby rozpocząć ją od nowa.', 'warning');
      return { done: false, blocked: true };
    }
    selectReceiverActivity('calibration', newSession);
    if (source === 'image') calibrationFromImages = true;
    const grid = state.grid || { columns: state.lanes, rows: 1 };
    const selected = selectedGrid(true);
    if (selected.columns !== grid.columns || selected.rows !== grid.rows) {
      setGridControls(grid, true);
      cameraScanner?.setGrid?.(grid.columns, grid.rows);
      syncLayout();
    }
    if (parsed.alignment && Boolean(parsed.setup) === Boolean(state.setup)
      && parsed.index === state.currentIndex && state.phase === 'alignment') recordAlignment(parsed);
    else if (state.phase !== 'alignment') resetAlignment();
    if (deferPaint) pendingCalibrationPaint = state;
    else paintCalibrationReadout(state);
    return { done: false, calibration: true };
  }
  function paintCalibrationReadout(state) {
    const grid = state.grid || { columns: state.lanes, rows: 1 };
    ui['calibration-panel'].hidden = false;
    ui['calibration-progress'].value = state.progress;
    const activeProfile = state.results[state.currentIndex];
    setText(ui['calibration-status-receiver'], state.ended ? 'Kalibracja zakończona.' : state.phase === 'alignment'
      ? 'Ustawienie kadru lub zmiana profilu. Te kody nie liczą się do wyniku.' : `Pomiar profilu ${state.currentIndex + 1}/${state.totalProfiles || state.results.length}: ${grid.columns} × ${grid.rows}, ${activeProfile.fps} zmian/s, ${activeProfile.chunkBytes} B.`);
    const best = state.best, bestGrid = best?.grid || grid;
    ui['calibration-result'].textContent = best
      ? calibrationFromImages ? `W obrazach jest komplet paczek profilu ${bestGrid.columns} × ${bestGrid.rows}, ${best.chunkBytes} B, ${best.fps} zmian/s. Szybkość odczytu wymaga nowej próby kamerą.`
      : `Najlepszy ${state.version >= 3 ? 'profil bez luk' : 'wynik próby'}: ${bestGrid.columns} × ${bestGrid.rows} QR, ${best.chunkBytes} B, ${best.fps} zmian/s — ${Math.round(best.bytesPerSecond).toLocaleString('pl-PL')} B/s.`
      : state.ended ? 'Żaden profil nie przeszedł próby bez luk. Popraw kadr, zmniejsz siatkę lub wybierz czytelniejsze kody i powtórz kalibrację.' : 'Zbieram numerowane paczki. Po zakończeniu pokażę kompletność i luki dla każdego profilu.';
    ui['show-calibration-feedback'].hidden = !state.ended || !best || calibrationFromImages;
    renderCalibrationResults(state, calibrationFromImages);
    message('decode-message', state.ended ? best && !calibrationFromImages ? 'Możesz przekazać wynik nadajnikowi kodem QR.' : 'Sprawdź wyniki i powtórz próbę po poprawieniu ustawienia urządzeń.'
      : 'Kalibracja używa sztucznych danych; plik nie jest jeszcze przesyłany.', state.ended && !best ? 'warning' : 'success');
  }
  function showCalibrationFeedback() {
    if (!calibrationObserver.state?.best || !calibrationObserver.state.ended || calibrationFromImages) return;
    const best = calibrationObserver.state.best;
    setGridControls(best.grid || { columns: calibrationObserver.state.lanes, rows: 1 }, true);
    syncLayout();
    stopCamera();
    let bytes;
    try {
      bytes = calibrationObserver.createFeedback();
      ui['feedback-panel'].hidden = false;
      drawQR(window.WGQR.encodeBytes(bytes), ui['feedback-canvas']);
      ui['resume-receiving'].hidden = false;
      ui['feedback-caption'].textContent = 'Na nadajniku wybierz „Zeskanuj potwierdzenie”. Po zastosowaniu ustawień wybierz tutaj „Odbiór pliku”, wróć do skanowania i odtwórz serię.';
      ui['close-feedback'].focus();
    } catch (error) { message('decode-message', error.message, 'warning'); }
    finally { if (bytes) bytes.fill(0); }
  }
  async function applyCalibrationFeedback(bytes, isCurrent) {
    if (!calibration || !isCurrent()) return false;
    const result = calibration.acceptFeedback(bytes);
    if (!isCurrent()) return false;
    stopCalibration(false);
    pauseAnimation();
    stopFeedbackCamera();
    const file = largeSourceFile || (sourceBytes ? new File([sourceBytes], sourceName, { type: 'application/octet-stream' }) : null);
    const zipMetadata = sourceZipMetadata;
    const originalFile = sourceOriginalFile;
    const restoreExpanded = calibrationWasExpanded;
    ui['qr-density'].value = String(result.chunkBytes);
    setGridControls(result.grid || { columns: result.lanes, rows: 1 });
    ui['series-ecc'].value = result.ecc;
    applyRecommendedRate(result.fps);
    if (!file) {
      expandAfterCalibration = restoreExpanded;
      calibration.dispose();
      calibration = null;
      lockCalibration(false);
      ui['calibration-step'].textContent = 'Kalibracja gotowa — wybierz plik';
      ui['calibration-status'].textContent = 'Zastosowano profil bez luk w próbie: '
        + selectedGrid().columns + ' × ' + selectedGrid().rows + ' QR, ' + result.chunkBytes + ' B, ' + result.fps
        + ' zmian/s. Wybierz plik; te ustawienia zostaną użyte do serii.';
      message('feedback-message', 'Ustawienia dobrane. Teraz wybierz plik do wysłania. Na odbiorniku wybierz „Odbiór pliku” i wróć do skanowania.', 'success');
      status('Kalibracja gotowa — można wybrać plik');
      ui['choose-file'].focus();
      return true;
    }
    const expectedEpoch = sourceEpoch + 1;
    await encodeFile(file, { zipMetadata, originalFile });
    if (sourceEpoch === expectedEpoch && series) {
      if (restoreExpanded) openExpanded();
      ui['calibration-status'].textContent = `Zastosowano profil bez luk w próbie: ${selectedGrid().columns} × ${selectedGrid().rows} QR, ${result.chunkBytes} B, ${result.fps} zmian/s. Seria czeka na uruchomienie.`;
      message('feedback-message', 'Ustawienia dobrane. Na odbiorniku wybierz „Odbiór pliku” i wróć do skanowania, a tutaj odtwórz serię. Jeśli wcześniej odbierano już plik, zresetuj jego odbiór.', 'success');
      if (largeSender) message('feedback-message', 'Ustawienia dobrane dla dużych kodów. Zapisane części pozostają zgodne. Przekaż kod braków z odbiornika, aby kontynuować od potrzebnej części.', 'success');
    }
    return true;
  }
  function stopFeedbackCamera(keepPanel = false) {
    feedbackEpoch += 1;
    if (cancelFeedbackScan) cancelFeedbackScan();
    cancelFeedbackScan = null;
    if (feedbackScanner) feedbackScanner.dispose();
    feedbackScanner = null;
    if (feedbackStream) feedbackStream.getTracks().forEach((track) => track.stop());
    feedbackStream = null;
    feedbackPreviewObserver?.disconnect();
    feedbackPreviewObserver = null;
    if (feedbackImageBusy) cancelImageRead();
    feedbackImageBusy = false;
    ui['feedback-video'].pause();
    ui['feedback-video'].srcObject = null;
    ui['feedback-camera-stage'].style.width = ui['feedback-camera-stage'].style.height = '';
    ui['feedback-scan-panel'].hidden = !keepPanel;
    ui['choose-feedback-image'].disabled = false;
  }
  function applyRecommendedRate(rate) {
    if (!FRAME_RATES.includes(rate)) return;
    ui['frame-rate'].querySelectorAll('input[type="radio"]').forEach((input) => { input.checked = Number(input.value) === rate; });
    updateTransferEstimate();
  }
  async function receiveFeedback(bytes, isCurrent) {
    const transfer = series;
    const trial = calibration;
    const epoch = sourceEpoch;
    if (!isCurrent()) return false;
    try {
      if (window.WGCalibration.isFeedback(bytes)) return await applyCalibrationFeedback(bytes, isCurrent);
      if (!transfer) return false;
      if (largeSender) {
        const sender = largeSender;
        const result = sender.acceptFeedback(bytes);
        if (!isCurrent() || epoch !== sourceEpoch || sender !== largeSender) return false;
        pauseAnimation(); stopFeedbackCamera(); applyRecommendedRate(result.suggestedRate);
        largeMissingSegments = result.missingSegments.slice();
        largeConfirmed = result.complete;
        largeSenderStatus();
        updateTransferEstimate();
        if (result.complete) {
          transmissionPhase = 'confirmed';
          ui['animation-toggle'].disabled = true;
          ui['animation-toggle'].textContent = 'Odbiór potwierdzony';
          message('feedback-message', 'Odbiornik potwierdził zapis i sprawdzenie całego dużego pliku.', 'success');
          status('Duży transfer zakończony');
        } else if (largeMissingSegments.length) {
          await loadLargeSegment(largeMissingSegments[0]);
          if (epoch === sourceEpoch && sender === largeSender) message('feedback-message', 'Pozostało ' + largeMissingSegments.length
            + ' części. Wznów odbiór i odtwarzanie; zapisane części będą pomijane.', 'success');
        } else {
          message('feedback-message', 'Wszystkie części są zapisane, ale odbiornik jeszcze nie potwierdził sprawdzenia i złożenia całości. Pokaż nowy kod zwrotny po zakończeniu.', 'warning');
          lockLargeWaiting();
        }
        return true;
      }
      const result = await transfer.acceptFeedback(bytes);
      if (!isCurrent() || series !== transfer || calibration !== trial || epoch !== sourceEpoch) return false;
      pauseAnimation();
      stopFeedbackCamera();
      applyRecommendedRate(result.suggestedRate);
      if (result.complete) {
        transmissionPhase = 'confirmed';
        ui['animation-toggle'].disabled = true;
        ui['animation-toggle'].textContent = 'Odbiór potwierdzony';
        message('feedback-message', 'Odbiornik potwierdził kompletny plik po sprawdzeniu sumy SHA-256. Nadawanie zatrzymane.', 'success');
        status('Odbiornik potwierdził zakończenie transferu');
      } else if (result.missingBlocks.length) {
        repairBlocks = Array.from(result.missingBlocks);
        if (!playback) playback = window.WGPlayback.create(series, { lanes: selectedLanes() });
        clearPrepared();
        playback.applyFeedback(result);
        presentedCheckpoint = playback.checkpoint();
        transmissionPhase = 'repair';
        ui['animation-toggle'].disabled = false;
        showRepairFrame();
        message('feedback-message', `Pozostałe bloki: ${repairBlocks.length}. Ustawiono ${selectedFrameRate()} ${selectedLanes() === 1 ? 'kodów' : selectedLanes() === 2 ? 'par' : 'układów'}/s. Wznów odbiór na drugim urządzeniu, a tutaj wybierz „Odtwórz serię”.`, 'success');
        status('Naprawa przygotowana — nadawanie wstrzymane');
      } else {
        message('feedback-message', 'Wszystkie bloki dotarły, ale odbiornik jeszcze nie potwierdził sumy pliku. Pokaż nowy kod zwrotny po zakończeniu sprawdzania.', 'warning');
        status('Oczekiwanie na potwierdzenie sprawdzonego pliku');
      }
      ui['scan-feedback'].focus();
      return true;
    } catch (error) {
      if (!isCurrent() || series !== transfer || calibration !== trial || epoch !== sourceEpoch) return false;
      const text = error.code === 'FEEDBACK_SESSION_MISMATCH'
        ? 'Ten kod zwrotny dotyczy innego lub wcześniejszego transferu. Bieżący plik pozostaje bez zmian.'
        : 'Nieprawidłowy kod zwrotny. Pokaż cały kod wygenerowany przez odbiornik tej próby lub serii.';
      message('feedback-message', text, 'error');
      return false;
    }
  }
  async function readFeedbackImage(file) {
    if (!file || !canReceiveFeedback()) return;
    stopCalibration(false);
    pauseAnimation();
    stopCamera();
    stopFeedbackCamera(true);
    cancelImageRead();
    const token = feedbackEpoch;
    const sourceToken = sourceEpoch;
    const transfer = series, trial = calibration;
    const isCurrent = () => token === feedbackEpoch && sourceToken === sourceEpoch && mode === 'encode'
      && series === transfer && calibration === trial && canReceiveFeedback();
    feedbackImageBusy = true;
    ui['choose-feedback-image'].disabled = true;
    message('feedback-message', 'Odczytuję kod zwrotny z obrazu…');
    try {
      const result = await scanImage(file, isCurrent);
      if (!isCurrent()) return;
      if (!result) { message('feedback-message', 'Nie znaleziono kodu zwrotnego. Wybierz wyraźny obraz z całym QR.', 'error'); return; }
      await receiveFeedback(result.bytes, isCurrent);
    } catch {
      if (isCurrent()) message('feedback-message', 'Nie udało się odczytać obrazu. Wybierz PNG, JPG lub WebP do 20 MB.', 'error');
    } finally {
      if (token === feedbackEpoch) {
        feedbackImageBusy = false;
        ui['choose-feedback-image'].disabled = false;
        ui['feedback-image-input'].value = '';
      }
    }
  }
  function readImage(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      let finished = false;
      const finish = (error) => {
        if (finished) return;
        finished = true;
        image.onload = image.onerror = null;
        URL.revokeObjectURL(url);
        pendingImageCancel = null;
        if (error) { image.src = ''; reject(error); }
        else resolve(image);
      };
      pendingImageCancel = () => finish(new Error('cancelled'));
      image.onload = () => finish();
      image.onerror = () => finish(new Error('invalid-image'));
      image.src = url;
    });
  }
  function decodeRegion(image, sx, sy, sw, sh, longestSide) {
    const ratio = Math.min(1, longestSide / Math.max(sw, sh));
    scanCanvas.width = Math.max(1, Math.round(sw * ratio));
    scanCanvas.height = Math.max(1, Math.round(sh * ratio));
    scanContext.fillStyle = '#ffffff';
    scanContext.fillRect(0, 0, scanCanvas.width, scanCanvas.height);
    scanContext.drawImage(image, sx, sy, sw, sh, 0, 0, scanCanvas.width, scanCanvas.height);
    const pixels = scanContext.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
    return window.WGQR.decodePixels(pixels.data, pixels.width, pixels.height);
  }
  const breathe = () => new Promise((resolve) => window.setTimeout(resolve, 0));
  async function scanImage(file, current, multiple = false) {
    const isCurrent = typeof current === 'function' ? current : () => current === decodeEpoch && mode === 'decode';
    if (!file.size || file.size > MAX_IMAGE_BYTES) {
      throw new Error('image-size');
    }
    if (file.type === 'image/svg+xml' || (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|gif|bmp|avif|heic|heif)$/i.test(file.name))) {
      throw new Error('invalid-image');
    }
    let image;
    try {
      image = await readImage(file);
      if (!isCurrent()) return;
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      if (!width || !height || width * height > 50000000 || Math.max(width, height) > 20000) throw new Error('image-too-large');
      const plans = [[0, 0, width, height, 1600]];
      if (multiple) {
        const grid = selectedGrid(true);
        if (grid.lanes > 1) {
          const layouts = [[grid.columns, grid.rows]];
          if (grid.columns !== grid.rows) layouts.push([grid.rows, grid.columns]);
          for (const [columns, rows] of layouts) {
            for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
              plans.push([width * column / columns, height * row / rows, width / columns, height / rows, 1600]);
            }
          }
        }
        // Clean seams avoid a neighbouring QR's partial finder patterns.
        if (width >= height) plans.push([0, 0, width / 2, height, 1800], [width / 2, 0, width / 2, height, 1800]);
        else plans.push([0, 0, width, height / 2, 1800], [0, height / 2, width, height / 2, 1800]);
      }
      if (Math.max(width, height) > 1600) plans.push([0, 0, width, height, 2400]);
      // Overlapping crops also handle a small QR embedded in a tall phone screenshot.
      if (height > width * 1.3) {
        const slice = Math.min(height, width * 1.35);
        for (const y of [0, (height - slice) / 2, height - slice]) plans.push([0, y, width, slice, 1800]);
      } else if (width > height * 1.3) {
        const slice = Math.min(width, height * 1.35);
        for (const x of [0, (width - slice) / 2, width - slice]) plans.push([x, 0, slice, height, 1800]);
      }
      const results = [];
      for (const plan of plans) {
        await breathe();
        if (!isCurrent()) return;
        const result = decodeRegion(image, ...plan);
        if (result && result.bytes && result.bytes.length) {
          if (!multiple) return result;
          if (!results.some(known => known.bytes.length === result.bytes.length && known.bytes.every((value, index) => value === result.bytes[index]))) results.push(result);
          if (results.length >= Math.max(2, selectedGrid(true).lanes)) break;
        }
      }
      return results.length ? { ...results[0], results } : null;
    } finally {
      if (image) image.src = '';
      if (isCurrent()) scanCanvas.width = scanCanvas.height = 1;
    }
  }
  async function decodeImages(selectedFiles) {
    const files = Array.from(selectedFiles);
    const token = ++decodeEpoch;
    cancelImageRead();
    stopCamera();
    prepareReceiver();
    message('decode-message');
    if (!files.length) return;
    decodeBusy(true);
    status('Odczytywanie obrazów QR…');
    let unreadable = 0;
    let found = 0;
    let rejected = 0;
    let lastImageError = '';
    try {
      for (let index = 0; index < files.length; index += 1) {
        if (token !== decodeEpoch || mode !== 'decode') return;
        if (decodedBytes || (receiverSnapshot && receiverSnapshot.complete)) return;
        message('decode-message', `Odczytywanie obrazu ${index + 1} z ${files.length}…`);
        let result;
        try { result = await scanImage(files[index], token, true); }
        catch (error) { lastImageError = error.message; unreadable += 1; continue; }
        if (token !== decodeEpoch || mode !== 'decode') return;
        if (!result) { unreadable += 1; continue; }
        found += 1;
        const current = () => token === decodeEpoch && mode === 'decode';
        const pending = [];
        for (const decoded of result.results || [result]) {
          if (!current()) return;
          const outcome = await receiveBytes(decoded.bytes, current, 'image');
          if (outcome.done) return;
          if (outcome.pending) pending.push(decoded);
          if (outcome.error || outcome.foreign || outcome.blocked) rejected += 1;
        }
        // A pair can be encountered data-first; retry only after its manifest arrived.
        if (receiverSnapshot) for (const decoded of pending) {
          if (!current()) return;
          const outcome = await receiveBytes(decoded.bytes, current, 'image');
          if (outcome.done) return;
          if (outcome.error || outcome.foreign || outcome.blocked) rejected += 1;
        }
      }
      if (token !== decodeEpoch || mode !== 'decode') return;
      showReceiving();
      if (!found) {
        const text = lastImageError === 'image-size'
          ? 'Wybierz niepuste obrazy PNG, JPG lub WebP, każdy do 20 MB.'
          : lastImageError === 'image-too-large'
            ? 'Obraz ma zbyt duże wymiary. Przytnij go bliżej kodu QR.'
            : 'Nie znaleziono czytelnego QR. Wybierz PNG, JPG lub WebP z całym kodem i białą ramką.';
        message('decode-message', text, 'error');
        status('Nie znaleziono QR w obrazach');
      } else if (!rejected && receiverSnapshot) {
        message('decode-message', `Odczytano obrazy. ${unreadable ? `Nie udało się odczytać ${unreadable}. ` : ''}Dodaj brakujące fragmenty lub włącz kamerę.`, unreadable ? 'warning' : 'success');
      }
    } finally {
      if (token === decodeEpoch) {
        decodeBusy(false);
        scanCanvas.width = scanCanvas.height = 1;
      }
    }
  }
  function cameraError(error) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return 'Brak zgody na kamerę. Zezwól na dostęp w ustawieniach przeglądarki lub wczytaj obraz QR.';
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'Nie znaleziono kamery. Wczytaj zdjęcie lub zrzut ekranu z QR.';
    }
    if (error.name === 'NotReadableError') return 'Kamera jest zajęta lub niedostępna. Zamknij inną aplikację używającą kamery albo wczytaj obraz.';
    return 'Nie udało się uruchomić kamery. Spróbuj w Safari lub Chrome albo wczytaj obraz QR.';
  }
  function startVideoLoop(video, isCurrent, processFrame, onError) {
    let videoRequest = null, animationRequest = null, retryTimer = null;
    let cancelled = false, scanning = false, pendingFrame = null, lastFrame = null, lastPoll = 0;
    const active = () => !cancelled && isCurrent() && !document.hidden;
    const cancel = () => {
      cancelled = true;
      pendingFrame = null;
      if (videoRequest !== null && typeof video.cancelVideoFrameCallback === 'function') video.cancelVideoFrameCallback(videoRequest);
      if (animationRequest !== null && typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(animationRequest);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      videoRequest = animationRequest = retryTimer = null;
    };
    const frameKey = (metadata) => {
      if (metadata && Number.isFinite(metadata.presentedFrames)) return `frame:${metadata.presentedFrames}`;
      if (metadata && Number.isFinite(metadata.mediaTime)) return `time:${metadata.mediaTime}`;
      if (typeof video.getVideoPlaybackQuality === 'function') {
        const count = video.getVideoPlaybackQuality().totalVideoFrames;
        if (Number.isFinite(count) && count > 0) return `frame:${count}`;
      }
      return Number.isFinite(video.currentTime) ? `time:${video.currentTime}` : null;
    };
    async function drain() {
      if (!active() || scanning || !pendingFrame) return;
      const frame = pendingFrame;
      pendingFrame = null;
      scanning = true;
      try {
        if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
          if (frame.key !== null && frame.key === lastFrame) return;
          lastFrame = frame.key;
          if (await processFrame()) cancel();
        }
      } catch (error) {
        if (active()) onError(error);
        cancel();
      } finally {
        scanning = false;
        // Keep only the newest observed frame. A completed decode can start
        // immediately, without waiting for one more camera-frame interval.
        if (active() && pendingFrame) void drain();
      }
    }
    function offer(metadata) {
      if (!active()) return;
      lastPoll = window.performance.now();
      const key = frameKey(metadata);
      if (key !== null && (key === lastFrame || key === pendingFrame?.key)) return;
      pendingFrame = { key };
      return drain();
    }
    function schedule() {
      if (!active() || videoRequest !== null || animationRequest !== null || retryTimer !== null) return;
      if (typeof video.requestVideoFrameCallback === 'function') {
        videoRequest = video.requestVideoFrameCallback((_now, metadata) => {
          videoRequest = null;
          schedule();
          return offer(metadata);
        });
      } else {
        retryTimer = window.setTimeout(() => {
          retryTimer = null;
          if (!active()) return;
          if (typeof window.requestAnimationFrame === 'function') {
            animationRequest = window.requestAnimationFrame(() => {
              animationRequest = null;
              lastPoll = window.performance.now();
              schedule();
              return offer();
            });
          } else {
            lastPoll = window.performance.now();
            schedule();
            return offer();
          }
        }, Math.max(1, 34 - (window.performance.now() - lastPoll)));
      }
    }
    schedule();
    return cancel;
  }
  function sizeVideoPreview(video, stage, container, stream) {
    if (!stream || video.srcObject !== stream || container.hidden) return null;
    const width = Number(video.videoWidth), height = Number(video.videoHeight);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
    // The displayed frame can rotate independently of the requested constraints
    // and of track.getSettings(). Keep video and its guide in one exact viewport.
    const parentWidth = Number(container.clientWidth);
    const viewportHeight = Number(window.visualViewport?.height || window.innerHeight || 800);
    if (Number.isFinite(parentWidth) && parentWidth > 0 && Number.isFinite(viewportHeight) && viewportHeight > 0) {
      const maxHeight = Math.min(640, Math.max(160, viewportHeight * 0.72));
      const previewWidth = Math.min(parentWidth, maxHeight * width / height);
      stage.style.width = previewWidth + 'px';
      stage.style.height = previewWidth * height / width + 'px';
    }
    return { width, height };
  }
  function syncCameraPreview() {
    const size = sizeVideoPreview(ui['camera-video'], ui['camera-stage'], ui['camera-box'], cameraStream);
    if (!size) return;
    let capture = {};
    try { capture = cameraStream.getVideoTracks()[0]?.getSettings?.() || {}; } catch { /* Optional camera metadata. */ }
    const fps = Number.isFinite(capture.frameRate) && capture.frameRate > 0
      ? ' Kamera zgłasza ' + Math.round(capture.frameRate) + ' kl./s.' : '';
    setText(ui['scan-help'], 'Pokaż cały układ kodów z białymi marginesami. Obrót telefonu nie zmienia układu wybranego na nadajniku.'
      + ' Obraz kamery: ' + size.width + ' × ' + size.height + '.' + fps);
  }
  function syncFeedbackPreview() {
    sizeVideoPreview(ui['feedback-video'], ui['feedback-camera-stage'], ui['feedback-scan-panel'], feedbackStream);
  }
  function observePreview(container, refresh) {
    if (typeof window.ResizeObserver !== 'function') return null;
    const observer = new window.ResizeObserver(refresh);
    observer.observe(container);
    return observer;
  }
  async function requestCamera(lanes = 1) {
    const profile = ui['camera-profile'].value;
    const grid = typeof lanes === 'number' ? { columns: lanes, rows: 1 } : lanes;
    const wide = profile === 'wide' || (profile !== 'classic' && grid.columns > grid.rows);
    const video = { facingMode: { ideal: 'environment' },
      width: { ideal: wide ? 1920 : 1280 }, height: { ideal: wide ? 1080 : 960 },
      aspectRatio: { ideal: wide ? 16 / 9 : 4 / 3 }, frameRate: { ideal: 30 } };
    try { return await navigator.mediaDevices.getUserMedia({ video, audio: false }); }
    catch (error) {
      if (error.name !== 'OverconstrainedError') throw error;
      return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    }
  }
  function scannerOptions(lanes = 1, grid = null) {
    return { decode: window.WGQR.decodePixels, lanes, ...(grid ? { columns: grid.columns, rows: grid.rows } : {}), workerUrl: './assets/qr-decoder-worker.js?v=4' };
  }
  async function scanCamera(scanner, video) {
    return typeof scanner.scanAsync === 'function' ? scanner.scanAsync(video) : scanner.scan(video);
  }
  async function startFeedbackCamera() {
    if (!canReceiveFeedback()) return;
    stopCalibration(false);
    pauseAnimation();
    closeExpanded(false);
    stopCamera();
    stopFeedbackCamera(true);
    cancelImageRead();
    const token = feedbackEpoch;
    const sourceToken = sourceEpoch;
    const target = series;
    const trial = calibration;
    const valid = () => token === feedbackEpoch && sourceToken === sourceEpoch && series === target
      && calibration === trial && canReceiveFeedback() && mode === 'encode';
    message('feedback-message', 'Zezwól na kamerę i pokaż kod zwrotny z urządzenia odbierającego. Możesz też wczytać jego obraz.');
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      message('feedback-message', 'Kamera wymaga HTTPS i obsługiwanej przeglądarki. Wczytaj obraz kodu zwrotnego.', 'error');
      return;
    }
    let stream;
    try {
      stream = await requestCamera(1);
      if (!valid() || document.hidden) { stream.getTracks().forEach((track) => track.stop()); return; }
      feedbackStream = stream;
      const video = ui['feedback-video'];
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      if (!valid()) return;
      feedbackPreviewObserver = observePreview(ui['feedback-scan-panel'], syncFeedbackPreview);
      syncFeedbackPreview();
      const scanner = window.WGCamera.createScanner(scannerOptions(1));
      feedbackScanner = scanner;
      stream.getVideoTracks().forEach((track) => track.addEventListener('ended', () => { if (valid()) stopFeedbackCamera(true); }, { once: true }));
      message('feedback-message', 'Skanuję kod zwrotny. Nadajnik pozostaje w pauzie.');
      cancelFeedbackScan = startVideoLoop(video, () => valid() && feedbackStream === stream, async () => {
        const sample = await scanCamera(scanner, video);
        if (!valid() || sample.busy || sample.attempts === 0) return false;
        return sample.result ? receiveFeedback(sample.result.bytes, valid) : false;
      }, () => {
        stopFeedbackCamera(true);
        message('feedback-message', 'Nie udało się odczytać kamery. Możesz wczytać obraz kodu zwrotnego.', 'error');
      });
    } catch (error) {
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (!valid()) return;
      stopFeedbackCamera(true);
      message('feedback-message', cameraError(error), 'error');
    }
  }
  async function startCamera() {
    decodeEpoch += 1;
    cancelImageRead();
    stopFeedbackCamera();
    hideFeedback();
    stopCamera();
    prepareReceiver();
    resetMetrics();
    message('decode-message');
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      message('decode-message', 'Kamera wymaga strony HTTPS i obsługiwanej przeglądarki. Możesz nadal wczytać obraz QR.', 'error');
      return;
    }
    const token = ++cameraEpoch;
    decodeBusy(true);
    ui['start-camera'].hidden = true;
    ui['stop-camera'].hidden = false;
    message('decode-message', 'Zezwól przeglądarce na użycie kamery.');
    status('Oczekiwanie na kamerę…');
    let stream;
    try {
      const requestGrid = calibrationCaptureGrid || selectedGrid(true);
      stream = await requestCamera(requestGrid);
      if (token !== cameraEpoch || mode !== 'decode' || document.hidden) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      cameraStream = stream;
      cameraRequestedGrid = { columns: requestGrid.columns, rows: requestGrid.rows };
      ui['camera-box'].hidden = false;
      ui['camera-video'].muted = true;
      ui['camera-video'].playsInline = true;
      ui['camera-video'].srcObject = stream;
      await ui['camera-video'].play();
      if (token !== cameraEpoch) return;
      ui['choose-image'].disabled = false;
      cameraPreviewObserver = observePreview(ui['camera-box'], syncCameraPreview);
      syncCameraPreview();
      message('decode-message', 'Skanowanie… skieruj kamerę na kod QR.');
      status('Kamera włączona — skanowanie lokalne');
      stream.getVideoTracks().forEach((track) => track.addEventListener('ended', () => {
        if (token === cameraEpoch) stopCamera(true);
      }, { once: true }));
      const video = ui['camera-video'];
      startCameraTelemetry(stream);
      const scanner = window.WGCamera.createScanner(scannerOptions(selectedGrid(true).lanes, selectedGrid(true)));
      cameraScanner = scanner;
      const active = () => token === cameraEpoch && cameraStream === stream && mode === 'decode';
      cancelCameraScan = startVideoLoop(video, active, async () => {
        const epoch = receiverEpoch;
        const sample = await scanCamera(scanner, video);
        if (!active() || epoch !== receiverEpoch || sample.busy || sample.attempts === 0) return false;
        const decoded = sample.results || (sample.result ? [sample.result] : []);
        // Discover a trial before considering other symbols from the same
        // camera image. An unrelated QR must not end automatic calibration.
        const calibrationResults = decoded.filter(result => window.WGCalibration.isFrame(result.bytes));
        const results = [...calibrationResults, ...decoded.filter(result => !window.WGCalibration.isFrame(result.bytes))];
        const calibrationOnly = receiverView === 'calibration' || (!receiverViewChosen && calibrationResults.length > 0);
        const dataResults = calibrationOnly ? [] : results.filter(result => result.bytes.length && !window.WGCalibration.isReserved(result.bytes));
        const hasCalibration = calibrationOnly || results.some(result => window.WGCalibration.isReserved(result.bytes));
        const scanTelemetry = !hasCalibration || dataResults.length ? {
          decodeMs: sample.decodeMs, region: sample.region, pixels: sample.pixels,
          result: dataResults.length > 0, symbols: dataResults.length, attempts: sample.attempts
        } : null;
        if (scanTelemetry) telemetry.recordScan(scanTelemetry);
        let delta = 0, done = false;
        const pending = [];
        for (const result of results) {
          if (!active() || epoch !== receiverEpoch) break;
          const outcome = await receiveBytes(result.bytes, active, 'camera', true, scanTelemetry);
          delta += outcome.delta || 0;
          if (outcome.pending) pending.push(result);
          if (outcome.done) { done = true; break; }
        }
        if (!done && receiverSnapshot) for (const result of pending) {
          if (!active() || epoch !== receiverEpoch) break;
          const outcome = await receiveBytes(result.bytes, active, 'camera', false, scanTelemetry);
          delta += outcome.delta || 0;
          if (outcome.done) { done = true; break; }
        }
        if (epoch === receiverEpoch && (active() || (done && mode === 'decode'))) {
          // A camera frame can contain fifteen CAL packets. Count every one,
          // then paint the dashboard once for that frame.
          const calibrationState = pendingCalibrationPaint;
          pendingCalibrationPaint = null;
          if (calibrationState) paintCalibrationReadout(calibrationState);
          if (!hasCalibration && receiverView === 'file') recordScan(sample, delta, done);
          renderTelemetry(done);
        }
        return done;
      }, () => {
        stopCamera();
        message('decode-message', 'Nie udało się odczytać obrazu z kamery. Spróbuj ponownie lub wczytaj zdjęcie QR.', 'error');
      });
    } catch (error) {
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (token !== cameraEpoch) return;
      stopCamera();
      message('decode-message', cameraError(error), 'error');
      status('Kamera niedostępna');
    }
  }
  function bindDrop(zone, handler, errorTarget, multiple = false) {
    let depth = 0;
    zone.addEventListener('dragenter', (event) => {
      event.preventDefault();
      depth += 1;
      zone.classList.add('is-dragover');
    });
    zone.addEventListener('dragover', (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; });
    zone.addEventListener('dragleave', () => {
      depth = Math.max(0, depth - 1);
      if (!depth) zone.classList.remove('is-dragover');
    });
    zone.addEventListener('drop', (event) => {
      event.preventDefault();
      depth = 0;
      zone.classList.remove('is-dragover');
      const files = event.dataTransfer.files;
      if (files.length === 0 || (!multiple && files.length !== 1)) {
        if (errorTarget === 'encode-message') { sourceEpoch += 1; clearSource(); encodeBusy(false); }
        else { decodeEpoch += 1; cancelImageRead(); stopCamera(); clearDecoded(); }
        message(errorTarget, 'Przeciągnij jeden plik naraz.', 'error');
        return;
      }
      handler(multiple ? Array.from(files) : files[0]);
    });
  }

  if (!window.WGQR || !window.WGTransfer || !window.WGResilient || !window.WGCamera || !window.WGTelemetry || !window.WGZip || !window.WGPlayback || !window.WGCalibration || !window.WGCalibrationView || !window.WGRender || !window.WGEncoder || !window.WGLarge || !window.WGLargeStore || !scanContext) {
    message('encode-message', 'Nie udało się wczytać narzędzia. Odśwież stronę.', 'error');
    ui['choose-file'].disabled = ui['choose-image'].disabled = ui['sample-file'].disabled = ui['series-sample'].disabled = ui['speed-sample'].disabled = ui['large-sample'].disabled = ui['zip-sample'].disabled = ui['start-camera'].disabled = true;
    return;
  }
  matrixEncoder = window.WGEncoder.create({ encode: window.WGQR.encodeBytes, workerUrl: './assets/qr-encoder-worker.js?v=3' });
  collector = window.WGResilient.createCollector();
  calibrationObserver = window.WGCalibration.createObserver();
  calibrationView = window.WGCalibrationView.create({ encodeBytes: window.WGQR.encodeBytes });
  telemetry = window.WGTelemetry.create({ now: () => window.performance.now(), appVersion: document.documentElement?.dataset.appVersion || 'nieznana' });
  ui['encode-tab'].addEventListener('click', () => selectMode('encode'));
  ui['decode-tab'].addEventListener('click', () => selectMode('decode'));
  ui['receiver-view-file'].addEventListener('click', () => selectReceiverView('file', true));
  ui['receiver-view-calibration'].addEventListener('click', () => selectReceiverView('calibration', true));
  for (const id of ['encode-tab', 'decode-tab']) {
    ui[id].addEventListener('keydown', (event) => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        selectMode(event.key === 'Home' ? 'encode' : event.key === 'End' ? 'decode' : mode === 'encode' ? 'decode' : 'encode', true);
      }
    });
  }
  ui['clear-all'].addEventListener('click', resetAll);
  ui['copy-diagnostics'].addEventListener('click', copyDiagnostics);
  ui['enable-large-receiver'].addEventListener('click', enableLargeReceiver);
  ui['large-resume'].addEventListener('click', resumeLargeReceiver);
  ui['large-delete'].addEventListener('click', () => { ui['large-delete-question'].hidden = false; ui['large-delete-cancel'].focus(); });
  ui['large-delete-cancel'].addEventListener('click', () => { ui['large-delete-question'].hidden = true; ui['large-delete'].focus(); });
  ui['large-delete-confirm'].addEventListener('click', deleteLargeStorage);
  ui['large-segment'].addEventListener('change', () => { void loadLargeSegment(Number(ui['large-segment'].value)); });
  ui['large-previous'].addEventListener('click', () => { const next = nextLargeSegment(-1); if (next !== null) void loadLargeSegment(next); });
  ui['large-next'].addEventListener('click', () => { const next = nextLargeSegment(); if (next !== null) void loadLargeSegment(next); });
  ui['large-repair'].addEventListener('change', updateTransferEstimate);
  ui['choose-file'].addEventListener('click', () => ui['file-input'].click());
  ui['choose-image'].addEventListener('click', () => ui['image-input'].click());
  ui['file-input'].addEventListener('change', () => { if (ui['file-input'].files.length) selectFiles(Array.from(ui['file-input'].files)); });
  ui['image-input'].addEventListener('change', () => { if (ui['image-input'].files.length) decodeImages(Array.from(ui['image-input'].files)); });
  bindDrop(ui['file-drop'], selectFiles, 'encode-message', true);
  bindDrop(ui['image-drop'], decodeImages, 'decode-message', true);
  ui['compress-single'].addEventListener('change', () => {
    if (sourceOriginalFile) void selectFiles([sourceOriginalFile]);
  });
  ui['transfer-mode'].addEventListener('change', () => {
    pauseAnimation();
    if (sourceOriginalFile) void selectFiles([sourceOriginalFile]);
    else if (sourceBytes) {
      const file = new File([sourceBytes], sourceName, { type: 'application/octet-stream' });
      const zipMetadata = sourceZipMetadata;
      encodeFile(file, { zipMetadata });
    }
  });
  ui['qr-density'].addEventListener('change', async () => {
    if (largeSourceFile) {
      const file = largeSourceFile;
      await encodeLargeFile(file);
      if (largeSender) message('encode-message', 'Zmieniono gęstość dużych kodów. Zapisane części pozostają zgodne; przekaż kod braków z odbiornika.', 'success');
      return;
    }
    if (!sourceBytes || !series) return;
    pauseAnimation();
    const file = new File([sourceBytes], sourceName, { type: 'application/octet-stream' });
    const zipMetadata = sourceZipMetadata;
    const originalFile = sourceOriginalFile;
    const expectedEpoch = sourceEpoch + 1;
    await encodeFile(file, { zipMetadata, originalFile });
    if (sourceEpoch === expectedEpoch && series) {
      message('encode-message', 'Zmieniono gęstość i utworzono nowy transfer. Na odbiorniku wybierz „Reset odbioru”, zanim wznowisz skanowanie.', 'warning');
    }
  });
  function changeSenderLayout() {
    stopCalibration(false);
    pauseAnimation();
    syncLayout();
    if (series) showFrame(frameIndex, true);
    updateTransferEstimate();
    redrawCurrent();
  }
  ui['qr-layout'].addEventListener('change', () => {
    setGridControls({ columns: ui['qr-layout'].value === 'dual' ? 2 : 1, rows: 1 });
    changeSenderLayout();
  });
  for (const id of ['qr-columns', 'qr-rows']) ui[id].addEventListener('change', () => {
    setGridControls(selectedGrid());
    changeSenderLayout();
  });
  ui['series-ecc'].addEventListener('change', changeSenderLayout);
  ui['start-calibration'].addEventListener('click', startCalibration);
  ui['begin-calibration'].addEventListener('click', beginCalibration);
  for (const id of ['calibration-range', 'calibration-layout-scope']) ui[id].addEventListener('change', updateCalibrationDuration);
  ui['stop-calibration'].addEventListener('click', () => stopCalibration(false));
  ui['show-calibration-feedback'].addEventListener('click', showCalibrationFeedback);
  ui['reset-calibration'].addEventListener('click', () => {
    if (!receiverSnapshot) receiverEpoch += 1;
    resetCalibrationReadout();
    calibrationCaptureGrid = null;
    hideFeedback();
    if (!receiverSnapshot) {
      resetMetrics(); resetTelemetry();
      if (cameraStream) startCameraTelemetry(cameraStream);
    }
    message('decode-message', 'Próba wyczyszczona. Pokaż kamerze aktualną próbę nadajnika.');
  });
  function resetCalibrationForCameraChange() {
    calibrationCaptureGrid = null;
    if (!calibrationObserver.state) return;
    resetCalibrationReadout();
    hideFeedback();
    resetMetrics();
    message('decode-message', 'Zmieniono kadr kamery. Powtórz próbę, aby dobrać ustawienia dla nowego kadru.');
  }
  function changeReceiverGrid() {
    resetCalibrationForCameraChange();
    setGridControls(selectedGrid(true), true);
    syncLayout();
    if (cameraStream && ui['camera-profile'].value === 'auto') startCamera();
    else cameraScanner?.setGrid?.(selectedGrid(true).columns, selectedGrid(true).rows);
  }
  ui['scan-layout'].addEventListener('change', () => {
    setGridControls({ columns: ui['scan-layout'].value === 'dual' ? 2 : 1, rows: 1 }, true);
    changeReceiverGrid();
  });
  for (const id of ['scan-columns', 'scan-rows']) ui[id].addEventListener('change', changeReceiverGrid);
  ui['camera-profile'].addEventListener('change', () => { resetCalibrationForCameraChange(); if (cameraStream) startCamera(); });
  ui['animation-toggle'].addEventListener('click', () => animationPlaying ? pauseAnimation() : startAnimation());
  ui['previous-frame'].addEventListener('click', () => { if (series) manualFrame((frameIndex - 1 + series.total) % series.total); });
  ui['next-frame'].addEventListener('click', () => { if (series) manualFrame((frameIndex + 1) % series.total); });
  ui['frame-slider'].addEventListener('input', () => manualFrame(Number(ui['frame-slider'].value) - 1));
  ui['frame-rate'].addEventListener('change', () => {
    updateTransferEstimate();
    if (animationPlaying) startAnimation();
    else status(`Ustawiono ${selectedFrameRate()} ${selectedLanes() === 1 ? 'kodów' : selectedLanes() === 2 ? 'par' : 'układów'}/s — naciśnij „Odtwórz serię”`);
  });
  ui['reset-receiver'].addEventListener('click', () => {
    decodeEpoch += 1;
    cancelImageRead();
    stopCamera();
    resetCollector();
    clearDecoded();
    message('decode-message', largeStore?.state?.descriptor
      ? 'Wyczyszczono bieżący odczyt. Zapisane części dużego pliku pozostają; wybierz „Wznów zapisany transfer” albo usuń go osobnym przyciskiem.'
      : 'Odbiór wyczyszczony. Możesz zeskanować inny plik.');
    status('Odbiór serii wyczyszczony');
  });
  // Dropping outside either target must not navigate away and expose the file.
  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', (event) => event.preventDefault());
  ui['sample-file'].addEventListener('click', () => {
    const sample = '# PRZYKLAD DEMONSTRACYJNY — nie jest aktywnym VPN\n[Interface]\nPrivateKey = DEMO_NIEPRAWIDLOWY_KLUCZ\nAddress = 10.0.0.2/32\n\n[Peer]\nPublicKey = DEMO_NIEPRAWIDLOWY_KLUCZ\nEndpoint = vpn.example.com:51820\nAllowedIPs = 0.0.0.0/0, ::/0\n';
    ui['transfer-mode'].value = 'auto';
    encodeFile(new File([sample], 'przyklad-demo.conf', { type: 'text/plain' }));
  });
  ui['series-sample'].addEventListener('click', () => {
    const heading = '# DEMO SERII QR - dane testowe, bez kluczy i hasel.\n';
    const contents = (heading + 'Przykladowy plik do transferu przez piec kodow QR.\n'.repeat(70)).slice(0, 1920);
    ui['transfer-mode'].value = 'series';
    ui['qr-density'].value = '384';
    selectFiles([new File([contents], 'przyklad-serii-demo.txt', { type: 'text/plain' })]);
  });
  ui['speed-sample'].addEventListener('click', () => {
    const bytes = new Uint8Array(100 * 1024);
    let seed = 0x71525432;
    for (let index = 0; index < bytes.length; index++) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      bytes[index] = seed & 255;
    }
    const file = new File([bytes], 'test-transferu-100KiB.bin', { type: 'application/octet-stream' });
    bytes.fill(0);
    ui['transfer-mode'].value = 'series';
    selectFiles([file]);
  });
  ui['large-sample'].addEventListener('click', () => {
    const bytes = new Uint8Array(4 * 1024 * 1024);
    let seed = 0x4c524734;
    for (let index = 0; index < bytes.length; index++) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; bytes[index] = seed & 255;
    }
    const file = new File([bytes], 'test-duzego-transferu-4MiB.bin', { type: 'application/octet-stream' });
    bytes.fill(0);
    ui['transfer-mode'].value = 'large';
    void encodeLargeFile(file);
  });
  ui['zip-sample'].addEventListener('click', () => {
    const configuration = '# DEMO ZIP - ten plik nie tworzy aktywnego VPN.\n[Interface]\nPrivateKey = DEMO_NIEPRAWIDLOWY_KLUCZ\nAddress = 10.0.0.2/32\n\n[Peer]\nPublicKey = DEMO_NIEPRAWIDLOWY_KLUCZ\nEndpoint = vpn.example.com:51820\nAllowedIPs = 0.0.0.0/0\n';
    const note = 'To sa nieszkodliwe pliki demonstracyjne. Archiwum powstaje lokalnie w przegladarce.\nPo odebraniu kompletnej serii QR pobierz pliki.zip i rozpakuj je na swoim urzadzeniu.\nKonfiguracja demo zawiera niewazne klucze. Nie wpisuj tutaj prawdziwych hasel do celow testowych.\n';
    const settings = JSON.stringify({ demo: true, secret: false, description: 'Przykladowe dane do testu ZIP', items: Array.from({ length: 12 }, (_, index) => ({ number: index + 1, label: `element-${index + 1}`, enabled: index % 3 === 0 })) }, null, 2) + '\n';
    selectFiles([
      new File([configuration], 'demo-wireguard.conf', { type: 'text/plain' }),
      new File([note], 'czytaj-mnie.txt', { type: 'text/plain' }),
      new File([settings], 'ustawienia-demo.json', { type: 'application/json' })
    ]);
  });
  ui['download-source-zip'].addEventListener('click', () => {
    if (!sourceBytes || !window.WGZip.isZip(sourceBytes) || ui['download-source-zip'].disabled) return;
    const name = /\.zip$/i.test(sourceName) ? sourceName : `${sourceName || 'pliki'}.zip`;
    downloadBlob(new Blob([sourceBytes], { type: 'application/zip' }), cleanName(name, 'pliki.zip'));
    status('Archiwum ZIP gotowe do zapisania');
  });
  ui['download-qr'].addEventListener('click', () => {
    if ((!sourceBytes && !largeSourceFile) || !lastDisplayFrames.length) return;
    stopCalibration(false);
    pauseAnimation();
    const token = sourceEpoch;
    const frames = lastDisplayFrames.slice();
    const description = frame => frame.kind === 'manifest' ? 'opis-pliku'
      : frame.kind === 'calibration' ? 'proba'
      : frame.kind === 'repair' ? `naprawa-${frame.block + 1}-${frame.serial}`
      : `fragment-${String(frame.index + 1).padStart(3, '0')}`;
    const suffix = series ? '-' + frames.map(description).join('-i-') : '';
    const filename = cleanName(cleanName(sourceName.replace(/\.[^.]*$/, ''), 'kod-qr') + suffix).slice(0, 116) + '.png';
    // Render exports at a useful module pitch even on a narrow phone display.
    const canvases = frames.map(frame => {
      const canvas = document.createElement('canvas');
      window.WGRender.drawQR(frame.matrix, canvas, { cssWidth: 960, pixelRatio: 1 });
      return canvas;
    });
    let output = canvases[0];
    if (canvases.length > 1) {
      output = document.createElement('canvas');
      const side = Math.max(...canvases.map(canvas => canvas.width));
      const gap = 24;
      const grid = displayGrid();
      output.width = side * grid.columns + gap * (grid.columns - 1);
      output.height = side * grid.rows + gap * (grid.rows - 1);
      const context = output.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, output.width, output.height);
      context.imageSmoothingEnabled = false;
      canvases.forEach((canvas, index) => context.drawImage(canvas,
        (index % grid.columns) * (side + gap) + Math.floor((side - canvas.width) / 2),
        Math.floor(index / grid.columns) * (side + gap) + Math.floor((side - canvas.height) / 2)));
    }
    output.toBlob((blob) => {
      if (token === sourceEpoch && (sourceBytes || largeSourceFile)) {
        if (!blob) message('encode-message', 'Nie udało się zapisać obrazu QR. Spróbuj ponownie.', 'error');
        else { downloadBlob(blob, filename); status('Obraz PNG gotowy do zapisania'); }
      }
      for (const canvas of new Set([...canvases, output])) clearQR(canvas);
    }, 'image/png');
  });
  ui['download-file'].addEventListener('click', () => {
    if (!decodedBytes && !decodedFile) return;
    const name = cleanName(ui['output-name'].value);
    ui['output-name'].value = name;
    downloadBlob(decodedFile || new Blob([decodedBytes], { type: 'application/octet-stream' }), name);
    status('Plik gotowy do zapisania — zachowano odczytane bajty');
  });
  ui['preview-source'].addEventListener('toggle', () => { ui['source-preview'].textContent = ui['preview-source'].open
    ? largeSourceFile ? 'Duży plik jest odczytywany częściami. Zawartość zostanie zachowana bajt po bajcie, razem ze strukturą gotowego archiwum.' : preview(sourceBytes) : ''; });
  ui['preview-decoded'].addEventListener('toggle', () => { ui['decoded-preview'].textContent = ui['preview-decoded'].open
    ? decodedFile ? 'Duży plik został zapisany lokalnie i sprawdzony. Pobranie zachowa wszystkie jego bajty; archiwum rozpakujesz po pobraniu.' : preview(decodedBytes) : ''; });
  ui['start-camera'].addEventListener('click', startCamera);
  ui['stop-camera'].addEventListener('click', () => stopCamera(true));
  ui['expand-qr'].addEventListener('click', openExpanded);
  ui['close-expanded'].addEventListener('click', () => closeExpanded());
  ui['show-feedback'].addEventListener('click', showFeedback);
  ui['close-feedback'].addEventListener('click', () => { hideFeedback(); ui[calibrationObserver.state?.ended ? 'show-calibration-feedback' : 'show-feedback'].focus(); });
  ui['resume-receiving'].addEventListener('click', () => { hideFeedback(); if (!receiverSnapshot?.complete) startCamera(); });
  ui['scan-feedback'].addEventListener('click', startFeedbackCamera);
  ui['stop-feedback-camera'].addEventListener('click', () => {
    stopFeedbackCamera();
    message('feedback-message', 'Skanowanie kodu zwrotnego zatrzymane.');
    ui['scan-feedback'].focus();
  });
  ui['choose-feedback-image'].addEventListener('click', () => ui['feedback-image-input'].click());
  ui['feedback-image-input'].addEventListener('change', () => {
    const file = ui['feedback-image-input'].files[0];
    if (file) readFeedbackImage(file);
  });
  document.addEventListener('keydown', (event) => {
    if (!document.body.classList.contains('qr-expanded')) return;
    if (event.key === 'Escape') { event.preventDefault(); closeExpanded(); return; }
    if (event.key !== 'Tab') return;
    const controls = Array.from(ui['qr-result'].querySelectorAll('button, input, select, textarea, a[href], [tabindex]'))
      .filter((element) => !element.disabled && element.tabIndex >= 0 && !element.closest('[hidden]') && element.getClientRects().length);
    if (!controls.length) { event.preventDefault(); ui['close-expanded'].focus(); return; }
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || !ui['qr-result'].contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !ui['qr-result'].contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopCalibration(false);
      pauseAnimation();
      const wasActive = Boolean(cameraStream) || !ui['stop-camera'].hidden;
      stopCamera(wasActive);
      stopFeedbackCamera();
      closePreviews();
    }
  });
  let resizeTimer = null;
  for (const name of ['loadedmetadata', 'resize']) {
    ui['camera-video'].addEventListener(name, syncCameraPreview);
    ui['feedback-video'].addEventListener(name, syncFeedbackPreview);
  }
  window.visualViewport?.addEventListener('resize', () => { syncCameraPreview(); syncFeedbackPreview(); });
  window.addEventListener('resize', () => {
    if (resizeTimer !== null) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => { resizeTimer = null; redrawCurrent(); syncCameraPreview(); syncFeedbackPreview(); }, 100);
  });
  window.addEventListener('pagehide', () => {
    if (resizeTimer !== null) window.clearTimeout(resizeTimer);
    resizeTimer = null;
    resetAll();
    largeStorageEpoch++;
    if (largeReceiver) largeReceiver.dispose();
    if (largeStore) largeStore.dispose();
    largeReceiver = null;
    largeStore = null;
    largeStorageBusy = false;
    renderLargeStorage();
    pendingUrls.forEach((url) => URL.revokeObjectURL(url));
    pendingUrls.clear();
  });
  clearSource();
  clearDecoded();
  showReceiving(null);
  resetMetrics();
  resetTelemetry();
  resetCalibrationReadout();
  selectReceiverView('file');
  selectMode('encode');
})();
