(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const ui = {};
  [
    'encode-tab', 'decode-tab', 'encode-panel', 'decode-panel', 'clear-all',
    'file-drop', 'file-input', 'choose-file', 'sample-file', 'encode-message',
    'source-details', 'source-name', 'source-size', 'source-format', 'qr-empty',
    'qr-result', 'qr-canvas', 'qr-caption', 'download-qr', 'preview-source',
    'source-preview', 'capacity-note', 'image-drop', 'image-input', 'choose-image',
    'start-camera', 'stop-camera', 'camera-box', 'camera-video', 'scan-help',
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
    'scan-feedback', 'feedback-scan-panel', 'feedback-video', 'stop-feedback-camera',
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
    'calibration-progress', 'calibration-status-receiver', 'calibration-result', 'show-calibration-feedback', 'reset-calibration'
  ].forEach((id) => { ui[id] = $(id); });

  const MAX_BYTES = 2953;
  const FRAME_RATES = [1, 2, 5, 10, 15, 20];
  const RATE_LABELS = [['one', 1], ['two', 2], ['five', 5], ['ten', 10], ['fifteen', 15], ['twenty', 20]];
  const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
  const DEFAULT_CAPACITY = 'Jeden QR: do 2953 B. Seria QR: do 10 MiB. Odtwarzanie serii zaczyna się od pauzy.';
  let mode = 'encode';
  let sourceBytes = null;
  let decodedBytes = null;
  let sourceName = '';
  let sourceZipMetadata = null;
  let sourceOriginalFile = null;
  let sourceEpoch = 0;
  let decodeEpoch = 0;
  let cameraEpoch = 0;
  let cameraStream = null;
  let cameraScanner = null;
  let cancelCameraScan = null;
  let feedbackEpoch = 0;
  let feedbackStream = null;
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
  let calibrationObserver = null;
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
    if (!sourceBytes || ui['qr-result'].hidden) return;
    expandedReturnFocus = document.activeElement;
    document.body.classList.add('qr-expanded');
    ui['qr-result'].setAttribute('role', 'dialog');
    ui['qr-result'].setAttribute('aria-modal', 'true');
    ui['qr-result'].setAttribute('aria-label', 'Powiększony kod QR i sterowanie transferem');
    ui['close-expanded'].hidden = false;
    ui['close-expanded'].focus();
    redrawCurrent();
  }
  function closeExpanded(restoreFocus = true) {
    const wasExpanded = document.body.classList.contains('qr-expanded');
    document.body.classList.remove('qr-expanded');
    ui['qr-result'].removeAttribute('role');
    ui['qr-result'].removeAttribute('aria-modal');
    ui['qr-result'].removeAttribute('aria-label');
    ui['close-expanded'].hidden = true;
    if (wasExpanded && restoreFocus) {
      const target = expandedReturnFocus && expandedReturnFocus.isConnected ? expandedReturnFocus : ui['expand-qr'];
      target.focus();
    }
    expandedReturnFocus = null;
    redrawCurrent();
  }
  function encodeBusy(busy) {
    ui['choose-file'].disabled = busy;
    ui['sample-file'].disabled = busy;
    ui['series-sample'].disabled = busy;
    ui['speed-sample'].disabled = busy;
    ui['zip-sample'].disabled = busy;
    ui['qr-density'].disabled = busy;
    ui['qr-layout'].disabled = busy;
    ui['series-ecc'].disabled = busy;
    ui['compress-single'].disabled = busy;
    ui['calibration-range'].disabled = busy;
    ui['start-calibration'].disabled = busy || !series;
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
    stopCalibration(false);
    if (calibration) calibration.dispose();
    calibration = null;
    pauseAnimation();
    stopFeedbackCamera();
    closeExpanded(false);
    if (series) series.dispose();
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
    clearQR(ui['qr-canvas-second']);
    ui['qr-paper-second'].hidden = true;
    ui['qr-pair'].dataset.layout = 'single';
    ui['dual-layout-hint'].hidden = true;
    ui['sender-metrics'].hidden = true;
    ui['calibration-status'].textContent = '';
    ui['start-calibration'].disabled = true;
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
    ui['animation-toggle'].disabled = false;
    ui['scan-feedback'].disabled = true;
    ui['feedback-message'].textContent = '';
    ui['feedback-image-input'].value = '';
    updateTransferEstimate();
  }
  function clearDecoded() {
    if (decodedBytes) decodedBytes.fill(0);
    decodedBytes = null;
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
    cameraEpoch += 1;
    if (cancelCameraScan) cancelCameraScan();
    cancelCameraScan = null;
    if (cameraScanner) cameraScanner.dispose();
    cameraScanner = null;
    if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
    ui['camera-video'].pause();
    ui['camera-video'].srcObject = null;
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
    status('Wyczyszczono plik, kod QR i podglądy');
  }
  function selectMode(nextMode, focus = false) {
    if (mode !== nextMode) {
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
    if (focus) ui[`${mode}-tab`].focus();
  }
  function selectedLanes() { return series && ui['qr-layout'].value === 'dual' ? 2 : 1; }
  function selectedEcc() { return ui['series-ecc'].value === 'L' ? 'L' : 'M'; }
  function syncLayout() {
    const dual = Boolean(series || calibrationActive) && ui['qr-layout'].value === 'dual';
    if (ui['qr-pair'].dataset.layout !== (dual ? 'dual' : 'single')) ui['qr-pair'].dataset.layout = dual ? 'dual' : 'single';
    ui['qr-paper-second'].hidden = !dual || lastDisplayFrames.length < 2;
    ui['dual-layout-hint'].hidden = !dual;
    setText(ui['frame-rate-label'], dual ? 'Zmiany pary na sekundę' : 'Kody na sekundę');
    for (const [label, rate] of RATE_LABELS) {
      setText(ui[`estimate-${label}-label`], dual ? `${rate} ${rate === 1 ? 'para' : rate === 2 ? 'pary' : 'par'}/s · ${rate * 2} QR/s` : `${rate} QR/s`);
    }
    ui['scan-guides'].dataset.layout = ui['scan-layout'].value === 'dual' ? 'dual' : 'single';
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
    if (series && mode === 'encode' && transmissionPhase !== 'confirmed' && !calibrationActive) {
      message('encode-message', 'Seria jest wstrzymana. Możesz ją wznowić lub wybrać fragment ręcznie.', 'success');
      status('Seria QR — odtwarzanie wstrzymane');
    }
  }
  function cacheMatrix(key, matrix) {
    matrixCache.set(key, matrix);
    if (matrixCache.size > 32) {
      const oldest = matrixCache.keys().next().value;
      matrixCache.get(oldest).data.fill(0);
      matrixCache.delete(oldest);
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
    drawQR(lastDisplayFrames[0].matrix);
    if (lastDisplayFrames[1] && !ui['qr-paper-second'].hidden) drawQR(lastDisplayFrames[1].matrix, ui['qr-canvas-second']);
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
    drawQR(display.frames[0].matrix);
    if (display.frames[1]) drawQR(display.frames[1].matrix, ui['qr-canvas-second']);
    const descriptions = display.frames.map(frame => frame.kind === 'manifest' ? 'opis pliku'
      : frame.kind === 'repair' ? `blok ${frame.block + 1}` : `fragment ${frame.index + 1}`);
    ui['frame-position'].textContent = `${transmissionPhase === 'repair' ? 'Naprawa' : 'Dane'} · ${descriptions.join(' + ')}`;
    ui['frame-slider'].value = String(frameIndex + 1);
    setText(ui['qr-caption'], `${byteCount(series.size)} · ${fragmentCount(series.total)} · ${selectedLanes() === 2 ? 'dwa niezależne QR' : 'jeden QR'}`);
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
    if (!animationPlaying || preparedDisplays.length >= 3 || preparationTimer !== null || preparationPending) return;
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
    for (const [label, value] of RATE_LABELS) {
      ui[`estimate-${label}`].textContent = series ? formatPassTime(window.WGPlayback.firstPassDisplays(series.total, selectedLanes(), series.version >= 3 ? series.manifestInterval : 0), value) : '';
      ui[`estimate-${label}-cell`].classList.toggle('is-selected', rate === value);
    }
  }
  function startAnimation() {
    if (!series || transmissionPhase === 'confirmed' || mode !== 'encode' || document.hidden) return;
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
    status(`Nadawanie: ${selectedFrameRate()} ${selectedLanes() === 2 ? 'par' : 'kodów'}/s`);
    prepareAhead();
    schedule();
  }
  function manualFrame(index) {
    pauseAnimation();
    showFrame(index);
    status('Seria wstrzymana — wybrano fragment ręcznie');
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
        [87, 71, 81, 82, 45, 83, 69, 84] // WGQR-SET calibration result
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
    message('decode-message', verified ? 'Odebrano wszystkie fragmenty i sprawdzono sumę SHA-256. Plik jest gotowy do pobrania.' : 'Kod odczytany. Nazwij plik i pobierz jego zawartość.', 'success');
    if (mode === 'decode') status(verified ? 'Plik odtworzony i sprawdzony' : 'QR odczytany lokalnie');
    return true;
  }
  function renderReceiving(state) {
    if (!state) {
      ui['receiving-progress'].hidden = true;
      ui['decoded-empty'].hidden = Boolean(decodedBytes);
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
    if (!complete) {
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
      // One camera sample may decode two symbols; the suggested rate is display changes/s.
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
      `Pakiety wnoszące nowe dane: ${count(data.usefulPackets)}; przyjęte bez nowych danych: ${count(data.redundantPackets)}.`,
      `Nowe porcje danych: ${count(data.usefulUnits)} / ${count(transfer.total)}; opisy pliku: ${count(data.manifestPackets)}.`,
      `Odrzucone odczyty: ${count(data.rejectedPackets)} (inny plik: ${count(data.rejections.foreign)}, nieprawidłowy: ${count(data.rejections.invalid)}, potwierdzenie: ${count(data.rejections.feedback)}).`,
      `Obróbka klatki — średnio: ${milliseconds(data.latencyAvgMs)}; p95${data.latencyP95Approximate ? ' w przybliżeniu' : ''}: ${milliseconds(data.latencyP95Ms)}.`,
      `Tryb skanowania — śledzenie: ${count(data.trackedAttempts)}, szukanie: ${count(data.searchAttempts)}.`,
      `Kamera zgłasza: ${resolution}; ${reportedFps}. To nie jest tempo odczytu kodów ani tempo nadajnika.`,
      `Ostatni obszar dekodowania: ${pixels ? `${count(pixels.width)} × ${count(pixels.height)}` : 'brak pomiaru'}.`,
      `Wersja aplikacji: ${data.appVersion}. Protokół: ${protocol}.`,
      `Rozmiar pliku: ${byteCount(transfer.size)}. Porcja: ${byteCount(transfer.chunkBytes)}. Bloki: ${count(transfer.blocksComplete)} / ${count(transfer.blockCount)}.`,
      'Próba bez odczytu nie oznacza zgubionego QR. Pakiet bez nowych danych może być powtórzeniem lub zależnym równaniem naprawczym.'
    ].join('\n');
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
    const report = telemetry.report();
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
    receiverEpoch += 1;
    if (collector) collector.reset();
    resetTelemetry();
    if (calibrationObserver) calibrationObserver.reset();
    ui['calibration-panel'].hidden = true;
    ui['show-calibration-feedback'].hidden = true;
    receiverSnapshot = null;
    showReceiving(null, true);
    hideFeedback();
    resetMetrics();
  }
  function prepareReceiver() {
    if ((receiverSnapshot && receiverSnapshot.complete) || decodedBytes || telemetry?.snapshot().complete) resetCollector();
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
  function receiveBytes(bytes, isCurrent, source = 'camera') {
    const epoch = receiverEpoch;
    const payload = Uint8Array.from(bytes);
    const operation = receiverChain.then(async () => {
      if (epoch !== receiverEpoch || !isCurrent()) return { done: false, stale: true };
      if (receiverSnapshot && receiverSnapshot.complete) return { done: true, delta: 0 };
      try {
        if (window.WGCalibration.isFrame(payload)) return receiveCalibration(payload);
        if (window.WGCalibration.isFeedback(payload)) {
          message('decode-message', 'To wynik próby. Pokaż go kamerze nadajnika po wybraniu „Zeskanuj potwierdzenie”.', 'warning');
          return { done: false, blocked: true };
        }
        if (calibrationObserver.state) {
          calibrationObserver.reset();
          ui['calibration-panel'].hidden = true;
          ui['show-calibration-feedback'].hidden = true;
          resetMetrics(); resetTelemetry();
          if (cameraStream) startCameraTelemetry(cameraStream);
        }
        const previous = receiverSnapshot;
        const result = await collector.accept(payload);
        // Switching tabs or stopping the camera retains an already accepted transfer.
        // Clearing/resetting the receiver, however, invalidates even a pending digest.
        if (epoch !== receiverEpoch) return { done: false, stale: true };
        if (result.kind === 'pending') {
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
          receiverSnapshot = { ...result, bytes: undefined, complete: true };
          const delta = Math.max(0, result.total - (previous?.received || 0));
          recordPacketTelemetry(receiverSnapshot, delta, source);
          stopCamera();
          showReceiving(receiverSnapshot, true);
          return { done: acceptDecoded(result, result.name, true), delta };
        }
        const delta = Math.max(0, result.received - (previous?.received || 0));
        receiverSnapshot = result;
        recordPacketTelemetry(result, delta, source);
        if (delta > 0 || !previous) showReceiving(result);
        return { done: false, progress: true, delta };
      } catch (error) {
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
      bytes = collector.createFeedback({ suggestedRate: metrics.recommended });
      ui['feedback-panel'].hidden = false;
      drawQR(window.WGQR.encodeBytes(bytes), ui['feedback-canvas']);
      ui['resume-receiving'].hidden = Boolean(receiverSnapshot.complete);
      ui['feedback-caption'].textContent = receiverSnapshot.complete
        ? 'Odbiór pliku został sprawdzony. Na nadajniku wybierz „Zeskanuj potwierdzenie”, aby potwierdzić zakończenie.'
        : `Na nadajniku wybierz „Zeskanuj potwierdzenie”. Kod wskaże niepełne bloki i zaproponuje ${metrics.recommended} zmian/s. Potem wznowisz odbiór.`;
      ui['close-feedback'].focus();
    } catch {
      message('decode-message', 'Kod zwrotny jest dostępny po odebraniu fragmentu nowej serii. Odśwież obie strony, jeśli używasz starszej wersji.', 'error');
    } finally {
      if (bytes) bytes.fill(0);
    }
  }
  function stopCalibration(showEnd = false) {
    const wasActive = calibrationActive;
    if (calibrationTimer !== null) window.clearTimeout(calibrationTimer);
    calibrationTimer = null;
    calibrationActive = false;
    if (wasActive) matrixEncoder?.reset();
    ui['calibration-range'].disabled = false;
    ui['stop-calibration'].hidden = true;
    ui['start-calibration'].disabled = !series;
    for (const id of ['qr-density', 'qr-layout', 'series-ecc', 'previous-frame', 'next-frame', 'frame-slider']) ui[id].disabled = false;
    ui['animation-toggle'].disabled = transmissionPhase === 'confirmed';
    if (showEnd && calibration && series) {
      const bytes = calibration.endFrame();
      let matrix;
      try { matrix = window.WGQR.encodeBytes(bytes); } finally { bytes.fill(0); }
      lastDisplayFrames = Array.from({ length: calibration.lanes }, () => ({ kind: 'calibration', matrix }));
      redrawCurrent();
      ui['frame-position'].textContent = 'Próba zakończona';
      ui['qr-caption'].textContent = 'Odbierz wynik na drugim urządzeniu, a potem pokaż go kamerze nadajnika.';
      ui['calibration-status'].textContent = 'Próba zakończona. Na odbiorniku wybierz „Pokaż wynik nadajnikowi”, a tutaj „Zeskanuj potwierdzenie”.';
    } else if (wasActive) ui['calibration-status'].textContent = 'Próba zatrzymana. Możesz rozpocząć ją ponownie.';
  }
  function startCalibration() {
    if (!series || !sourceBytes || document.hidden) return;
    stopCalibration(false);
    pauseAnimation();
    stopFeedbackCamera();
    if (calibration) calibration.dispose();
    calibration = window.WGCalibration.create({ lanes: selectedLanes(), ecc: selectedEcc(), extended: ui['calibration-range'].value === 'fast' });
    calibrationActive = true;
    ui['calibration-range'].disabled = true;
    ui['start-calibration'].disabled = true;
    ui['stop-calibration'].hidden = false;
    for (const id of ['qr-density', 'qr-layout', 'series-ecc', 'animation-toggle', 'previous-frame', 'next-frame', 'frame-slider']) ui[id].disabled = true;
    const token = sourceEpoch;
    const trial = calibration;
    const started = window.performance.now();
    let lastSlot = '';
    async function tickCalibration() {
      calibrationTimer = null;
      if (!calibrationActive || calibration !== trial || token !== sourceEpoch || document.hidden) return;
      const elapsed = Math.max(0, window.performance.now() - started);
      const index = Math.floor(elapsed / trial.duration);
      if (index >= trial.profiles.length) { stopCalibration(true); return; }
      const profile = trial.profiles[index];
      const localTime = elapsed - index * trial.duration;
      const step = Math.min(profile.fps * trial.duration / 1000 - 1, Math.floor(localTime * profile.fps / 1000));
      const key = `${index}:${step}`;
      if (key !== lastSlot) {
        lastSlot = key;
        try {
          const packets = Array.from({ length: trial.lanes }, (_, lane) => ({
            bytes: trial.frame(index, step * trial.lanes + lane), errorCorrectionLevel: trial.ecc
          }));
          let pending;
          try { pending = matrixEncoder.encodeBatch(packets); }
          finally { packets.forEach(packet => packet.bytes.fill(0)); }
          const matrices = await pending;
          const fresh = calibrationActive && calibration === trial && token === sourceEpoch && !document.hidden;
          const currentElapsed = Math.max(0, window.performance.now() - started);
          const currentIndex = Math.floor(currentElapsed / trial.duration);
          const currentStep = Math.floor((currentElapsed % trial.duration) * profile.fps / 1000);
          if (!fresh || currentIndex !== index || currentStep !== step) {
            matrices.forEach(matrix => matrix.data.fill(0));
            if (!fresh) return;
          } else {
            lastDisplayFrames = matrices.map(matrix => ({ kind: 'calibration', matrix }));
            redrawCurrent();
            ui['frame-position'].textContent = `Próba ${index + 1}/${trial.profiles.length} · ${profile.chunkBytes} B · ${profile.fps} zmian/s`;
            setText(ui['qr-caption'], 'Dane demonstracyjne do pomiaru. Twój plik pozostaje na urządzeniu.');
            setText(ui['calibration-status'], `Próba trwa około ${trial.profiles.length * trial.duration / 1000} s. Trzymaj cały układ w kadrze. Profil ${index + 1}/${trial.profiles.length}.`);
          }
        } catch (error) {
          if (!calibrationActive || calibration !== trial || token !== sourceEpoch || error.name === 'AbortError') return;
          stopCalibration(false);
          ui['calibration-status'].textContent = 'Nie udało się przygotować próby. Wybierz ustawienia ręcznie.';
          return;
        }
      }
      const next = started + index * trial.duration + (step + 1) * 1000 / profile.fps;
      calibrationTimer = window.setTimeout(tickCalibration, Math.max(1, Math.round(next - window.performance.now())));
    }
    tickCalibration();
  }
  function receiveCalibration(bytes) {
    if (receiverSnapshot && !receiverSnapshot.complete && receiverSnapshot.received > 0) {
      message('decode-message', 'Trwa odbiór pliku. Aby wykonać próbę, najpierw wybierz „Reset odbioru”.', 'warning');
      return { done: false, blocked: true };
    }
    const parsed = window.WGCalibration.parse(bytes);
    if (calibrationObserver.state?.ended && calibrationObserver.state.id !== parsed.id) calibrationObserver.reset();
    if (receiverSnapshot) {
      collector.reset(); receiverSnapshot = null; showReceiving(null, true); resetTelemetry();
      if (cameraStream) startCameraTelemetry(cameraStream);
    }
    const state = calibrationObserver.accept(bytes, window.performance.now());
    if (state.foreign) {
      message('decode-message', 'Widzę inną próbę. Wybierz „Reset odbioru”, aby rozpocząć ją od nowa.', 'warning');
      return { done: false, blocked: true };
    }
    const layout = state.lanes === 2 ? 'dual' : 'single';
    if (ui['scan-layout'].value !== layout) {
      ui['scan-layout'].value = layout;
      if (cameraStream && ui['camera-profile'].value === 'auto') void startCamera();
      else cameraScanner?.setLanes?.(state.lanes);
      syncLayout();
    }
    ui['calibration-panel'].hidden = false;
    ui['calibration-progress'].value = state.progress;
    ui['calibration-status-receiver'].textContent = state.ended ? 'Próba zakończona.' : 'Mierzę odczyty. Utrzymuj kody w kadrze do zakończenia próby.';
    ui['calibration-result'].textContent = state.best
      ? `Najlepszy wynik próby: ${state.best.chunkBytes} B, ${state.best.fps} zmian/s, ${state.lanes} QR na zmianę — około ${Math.round(state.best.bytesPerSecond).toLocaleString('pl-PL')} B/s.`
      : state.ended ? 'Za mało czytelnych odczytów. Zbliż kody lub popraw ostrość i powtórz próbę.' : 'Zbieram próbki dla kolejnych ustawień…';
    ui['show-calibration-feedback'].hidden = !state.ended || !state.best;
    message('decode-message', state.ended ? 'Możesz przekazać wynik nadajnikowi kodem QR.' : 'Odczytuję próbę; plik nie jest jeszcze przesyłany.', 'success');
    return { done: false, calibration: true };
  }
  function showCalibrationFeedback() {
    if (!calibrationObserver.state?.best || !calibrationObserver.state.ended) return;
    stopCamera();
    let bytes;
    try {
      bytes = calibrationObserver.createFeedback();
      ui['feedback-panel'].hidden = false;
      drawQR(window.WGQR.encodeBytes(bytes), ui['feedback-canvas']);
      ui['resume-receiving'].hidden = false;
      ui['feedback-caption'].textContent = 'Na nadajniku wybierz „Zeskanuj potwierdzenie”. Po zastosowaniu ustawień wróć do skanowania i odtwórz serię.';
      ui['close-feedback'].focus();
    } catch (error) { message('decode-message', error.message, 'warning'); }
    finally { if (bytes) bytes.fill(0); }
  }
  async function applyCalibrationFeedback(bytes, isCurrent) {
    if (!calibration || !isCurrent() || !sourceBytes) return false;
    const result = calibration.acceptFeedback(bytes);
    if (!isCurrent()) return false;
    stopCalibration(false);
    pauseAnimation();
    stopFeedbackCamera();
    const file = new File([sourceBytes], sourceName, { type: 'application/octet-stream' });
    const zipMetadata = sourceZipMetadata;
    const originalFile = sourceOriginalFile;
    ui['qr-density'].value = String(result.chunkBytes);
    ui['qr-layout'].value = result.lanes === 2 ? 'dual' : 'single';
    ui['series-ecc'].value = result.ecc;
    applyRecommendedRate(result.fps);
    const expectedEpoch = sourceEpoch + 1;
    await encodeFile(file, { zipMetadata, originalFile });
    if (sourceEpoch === expectedEpoch && series) {
      ui['calibration-status'].textContent = `Zastosowano wynik: ${result.chunkBytes} B, ${result.fps} zmian/s, ${result.lanes} QR. Nowa seria jest gotowa.`;
      message('feedback-message', 'Ustawienia dobrane. Na odbiorniku wróć do skanowania, a tutaj odtwórz serię. Jeśli wcześniej odbierano już plik, zresetuj jego odbiór.', 'success');
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
    if (feedbackImageBusy) cancelImageRead();
    feedbackImageBusy = false;
    ui['feedback-video'].pause();
    ui['feedback-video'].srcObject = null;
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
    const epoch = sourceEpoch;
    if (!transfer || !isCurrent()) return false;
    try {
      if (window.WGCalibration.isFeedback(bytes)) return await applyCalibrationFeedback(bytes, isCurrent);
      const result = await transfer.acceptFeedback(bytes);
      if (!isCurrent() || series !== transfer || epoch !== sourceEpoch) return false;
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
        message('feedback-message', `Pozostałe bloki: ${repairBlocks.length}. Ustawiono ${selectedFrameRate()} ${selectedLanes() === 2 ? 'par' : 'kodów'}/s. Wznów odbiór na drugim urządzeniu, a tutaj wybierz „Odtwórz serię”.`, 'success');
        status('Naprawa przygotowana — nadawanie wstrzymane');
      } else {
        message('feedback-message', 'Wszystkie bloki dotarły, ale odbiornik jeszcze nie potwierdził sumy pliku. Pokaż nowy kod zwrotny po zakończeniu sprawdzania.', 'warning');
        status('Oczekiwanie na potwierdzenie sprawdzonego pliku');
      }
      ui['scan-feedback'].focus();
      return true;
    } catch (error) {
      if (!isCurrent() || series !== transfer || epoch !== sourceEpoch) return false;
      const text = error.code === 'FEEDBACK_SESSION_MISMATCH'
        ? 'Ten kod zwrotny dotyczy innego lub wcześniejszego transferu. Bieżący plik pozostaje bez zmian.'
        : 'Nieprawidłowy kod zwrotny. Pokaż cały kod wygenerowany przez odbiornik tej serii.';
      message('feedback-message', text, 'error');
      return false;
    }
  }
  async function readFeedbackImage(file) {
    if (!file || !series) return;
    stopCalibration(false);
    pauseAnimation();
    stopCamera();
    stopFeedbackCamera(true);
    cancelImageRead();
    const token = feedbackEpoch;
    const sourceToken = sourceEpoch;
    const isCurrent = () => token === feedbackEpoch && sourceToken === sourceEpoch && mode === 'encode' && Boolean(series);
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
          if (results.length >= 2) break;
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
  async function requestCamera(lanes = 1) {
    const profile = ui['camera-profile'].value;
    const wide = profile === 'wide' || (profile !== 'classic' && lanes === 2);
    const video = { facingMode: { ideal: 'environment' },
      width: { ideal: wide ? 1920 : 1280 }, height: { ideal: wide ? 1080 : 960 },
      aspectRatio: { ideal: wide ? 16 / 9 : 4 / 3 }, frameRate: { ideal: 30 } };
    try { return await navigator.mediaDevices.getUserMedia({ video, audio: false }); }
    catch (error) {
      if (error.name !== 'OverconstrainedError') throw error;
      return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    }
  }
  function scannerOptions(lanes = 1) {
    return { decode: window.WGQR.decodePixels, lanes, workerUrl: './assets/qr-decoder-worker.js?v=2' };
  }
  async function scanCamera(scanner, video) {
    return typeof scanner.scanAsync === 'function' ? scanner.scanAsync(video) : scanner.scan(video);
  }
  async function startFeedbackCamera() {
    if (!series || series.version < 2) return;
    stopCalibration(false);
    pauseAnimation();
    closeExpanded(false);
    stopCamera();
    stopFeedbackCamera(true);
    cancelImageRead();
    const token = feedbackEpoch;
    const sourceToken = sourceEpoch;
    const target = series;
    const valid = () => token === feedbackEpoch && sourceToken === sourceEpoch && series === target && mode === 'encode';
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
      stream = await requestCamera(ui['scan-layout'].value === 'dual' ? 2 : 1);
      if (token !== cameraEpoch || mode !== 'decode' || document.hidden) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      cameraStream = stream;
      ui['camera-box'].hidden = false;
      ui['camera-video'].muted = true;
      ui['camera-video'].playsInline = true;
      ui['camera-video'].srcObject = stream;
      await ui['camera-video'].play();
      if (token !== cameraEpoch) return;
      ui['choose-image'].disabled = false;
      let capture = {};
      try { capture = stream.getVideoTracks()[0]?.getSettings?.() || {}; } catch { /* Optional camera metadata. */ }
      const captureText = capture.width && capture.height ? ` Kamera zgłasza ${capture.width} × ${capture.height}${capture.frameRate ? `, ${Math.round(capture.frameRate)} kl./s` : ''}.` : '';
      ui['scan-help'].textContent = 'Pokaż cały układ kodów z białymi ramkami. Każdy czytelny kod jest odbierany niezależnie.' + captureText;
      message('decode-message', 'Skanowanie… skieruj kamerę na kod QR.');
      status('Kamera włączona — skanowanie lokalne');
      stream.getVideoTracks().forEach((track) => track.addEventListener('ended', () => {
        if (token === cameraEpoch) stopCamera(true);
      }, { once: true }));
      const video = ui['camera-video'];
      startCameraTelemetry(stream);
      const scanner = window.WGCamera.createScanner(scannerOptions(ui['scan-layout'].value === 'dual' ? 2 : 1));
      cameraScanner = scanner;
      const active = () => token === cameraEpoch && cameraStream === stream && mode === 'decode';
      cancelCameraScan = startVideoLoop(video, active, async () => {
        const epoch = receiverEpoch;
        const sample = await scanCamera(scanner, video);
        if (!active() || epoch !== receiverEpoch || sample.busy || sample.attempts === 0) return false;
        const results = sample.results || (sample.result ? [sample.result] : []);
        const dataResults = results.filter(result => !window.WGCalibration.isReserved(result.bytes));
        const hasCalibration = results.some(result => window.WGCalibration.isReserved(result.bytes));
        if (dataResults.length && calibrationObserver.state) {
          calibrationObserver.reset();
          ui['calibration-panel'].hidden = true;
          ui['show-calibration-feedback'].hidden = true;
          resetMetrics(); resetTelemetry(); startCameraTelemetry(stream);
        }
        if (!hasCalibration || dataResults.length) {
          telemetry.recordScan({ decodeMs: sample.decodeMs, region: sample.region, pixels: sample.pixels,
            result: dataResults.length > 0, symbols: dataResults.length, attempts: sample.attempts });
        }
        let delta = 0, done = false;
        const pending = [];
        for (const result of results) {
          if (!active() || epoch !== receiverEpoch) break;
          const outcome = await receiveBytes(result.bytes, active);
          delta += outcome.delta || 0;
          if (outcome.pending) pending.push(result);
          if (outcome.done) { done = true; break; }
        }
        if (!done && receiverSnapshot) for (const result of pending) {
          if (!active() || epoch !== receiverEpoch) break;
          const outcome = await receiveBytes(result.bytes, active);
          delta += outcome.delta || 0;
          if (outcome.done) { done = true; break; }
        }
        if (epoch === receiverEpoch && (active() || (done && mode === 'decode'))) {
          if (!hasCalibration) recordScan(sample, delta, done);
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

  if (!window.WGQR || !window.WGTransfer || !window.WGResilient || !window.WGCamera || !window.WGTelemetry || !window.WGZip || !window.WGPlayback || !window.WGCalibration || !window.WGRender || !window.WGEncoder || !scanContext) {
    message('encode-message', 'Nie udało się wczytać narzędzia. Odśwież stronę.', 'error');
    ui['choose-file'].disabled = ui['choose-image'].disabled = ui['sample-file'].disabled = ui['series-sample'].disabled = ui['speed-sample'].disabled = ui['zip-sample'].disabled = ui['start-camera'].disabled = true;
    return;
  }
  matrixEncoder = window.WGEncoder.create({ encode: window.WGQR.encodeBytes, workerUrl: './assets/qr-encoder-worker.js?v=1' });
  collector = window.WGResilient.createCollector();
  calibrationObserver = window.WGCalibration.createObserver();
  telemetry = window.WGTelemetry.create({ now: () => window.performance.now(), appVersion: document.documentElement?.dataset.appVersion || 'nieznana' });
  ui['encode-tab'].addEventListener('click', () => selectMode('encode'));
  ui['decode-tab'].addEventListener('click', () => selectMode('decode'));
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
    if (series) showFrame(frameIndex, true);
    updateTransferEstimate();
    redrawCurrent();
  }
  ui['qr-layout'].addEventListener('change', changeSenderLayout);
  ui['series-ecc'].addEventListener('change', changeSenderLayout);
  ui['start-calibration'].addEventListener('click', startCalibration);
  ui['stop-calibration'].addEventListener('click', () => stopCalibration(false));
  ui['show-calibration-feedback'].addEventListener('click', showCalibrationFeedback);
  ui['reset-calibration'].addEventListener('click', () => {
    resetCollector();
    if (cameraStream) startCameraTelemetry(cameraStream);
    message('decode-message', 'Próba wyczyszczona. Pokaż kamerze aktualną próbę nadajnika.');
  });
  function resetCalibrationForCameraChange() {
    if (!calibrationObserver.state) return;
    calibrationObserver.reset();
    ui['calibration-panel'].hidden = true;
    ui['show-calibration-feedback'].hidden = true;
    hideFeedback();
    resetMetrics();
    message('decode-message', 'Zmieniono kadr kamery. Powtórz próbę, aby dobrać ustawienia dla nowego kadru.');
  }
  ui['scan-layout'].addEventListener('change', () => {
    resetCalibrationForCameraChange();
    syncLayout();
    if (cameraStream && ui['camera-profile'].value === 'auto') startCamera();
    else cameraScanner?.setLanes?.(ui['scan-layout'].value === 'dual' ? 2 : 1);
  });
  ui['camera-profile'].addEventListener('change', () => { resetCalibrationForCameraChange(); if (cameraStream) startCamera(); });
  ui['animation-toggle'].addEventListener('click', () => animationPlaying ? pauseAnimation() : startAnimation());
  ui['previous-frame'].addEventListener('click', () => { if (series) manualFrame((frameIndex - 1 + series.total) % series.total); });
  ui['next-frame'].addEventListener('click', () => { if (series) manualFrame((frameIndex + 1) % series.total); });
  ui['frame-slider'].addEventListener('input', () => manualFrame(Number(ui['frame-slider'].value) - 1));
  ui['frame-rate'].addEventListener('change', () => {
    updateTransferEstimate();
    if (animationPlaying) startAnimation();
    else status(`Ustawiono ${selectedFrameRate()} ${selectedLanes() === 2 ? 'par' : 'kodów'}/s — naciśnij „Odtwórz serię”`);
  });
  ui['reset-receiver'].addEventListener('click', () => {
    decodeEpoch += 1;
    cancelImageRead();
    stopCamera();
    resetCollector();
    clearDecoded();
    message('decode-message', 'Odbiór wyczyszczony. Możesz zeskanować inny plik.');
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
    if (!sourceBytes || !lastDisplayFrames.length) return;
    stopCalibration(false);
    pauseAnimation();
    const token = sourceEpoch;
    const frames = lastDisplayFrames.slice();
    const description = frame => frame.kind === 'manifest' ? 'opis-pliku'
      : frame.kind === 'calibration' ? 'proba'
      : frame.kind === 'repair' ? `naprawa-${frame.block + 1}-${frame.serial}`
      : `fragment-${String(frame.index + 1).padStart(3, '0')}`;
    const suffix = series ? '-' + frames.map(description).join('-i-') : '';
    const filename = cleanName(sourceName.replace(/\.[^.]*$/, ''), 'kod-qr') + suffix + '.png';
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
      output.width = side * 2 + gap; output.height = side;
      const context = output.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, output.width, output.height);
      context.imageSmoothingEnabled = false;
      canvases.forEach((canvas, index) => context.drawImage(canvas,
        index * (side + gap) + Math.floor((side - canvas.width) / 2), Math.floor((side - canvas.height) / 2)));
    }
    output.toBlob((blob) => {
      if (token === sourceEpoch && sourceBytes) {
        if (!blob) message('encode-message', 'Nie udało się zapisać obrazu QR. Spróbuj ponownie.', 'error');
        else { downloadBlob(blob, filename); status('Obraz PNG gotowy do zapisania'); }
      }
      for (const canvas of new Set([...canvases, output])) clearQR(canvas);
    }, 'image/png');
  });
  ui['download-file'].addEventListener('click', () => {
    if (!decodedBytes) return;
    const name = cleanName(ui['output-name'].value);
    ui['output-name'].value = name;
    downloadBlob(new Blob([decodedBytes], { type: 'application/octet-stream' }), name);
    status('Plik gotowy do zapisania — zachowano odczytane bajty');
  });
  ui['preview-source'].addEventListener('toggle', () => { ui['source-preview'].textContent = ui['preview-source'].open ? preview(sourceBytes) : ''; });
  ui['preview-decoded'].addEventListener('toggle', () => { ui['decoded-preview'].textContent = ui['preview-decoded'].open ? preview(decodedBytes) : ''; });
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
    message('feedback-message', 'Skanowanie potwierdzenia zatrzymane. Bieżący plik pozostaje w pauzie.');
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
  window.addEventListener('resize', () => {
    if (resizeTimer !== null) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => { resizeTimer = null; redrawCurrent(); }, 100);
  });
  window.addEventListener('pagehide', () => {
    if (resizeTimer !== null) window.clearTimeout(resizeTimer);
    resizeTimer = null;
    resetAll();
    pendingUrls.forEach((url) => URL.revokeObjectURL(url));
    pendingUrls.clear();
  });
  clearSource();
  clearDecoded();
  showReceiving(null);
  resetMetrics();
  resetTelemetry();
  selectMode('encode');
})();
