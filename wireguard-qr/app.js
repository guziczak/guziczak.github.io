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
    'feedback-message', 'feedback-image-input', 'choose-feedback-image'
  ].forEach((id) => { ui[id] = $(id); });

  const MAX_BYTES = 2953;
  const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
  const DEFAULT_CAPACITY = 'Jeden QR: do 2953 B. Seria QR: do 10 MiB. Odtwarzanie serii zaczyna się od pauzy.';
  let mode = 'encode';
  let sourceBytes = null;
  let decodedBytes = null;
  let sourceName = '';
  let sourceZipMetadata = null;
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
  let sourcePassShown = 0;
  let nextSourceFrame = 0;
  let repairBlocks = [];
  let repairCursor = 0;
  let repairSerial = 0;
  let currentRepair = null;
  let animationTick = 0;
  let receiverEpoch = 0;
  let receiverChain = Promise.resolve();
  let collector = null;
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
  }
  function encodeBusy(busy) {
    ui['choose-file'].disabled = busy;
    ui['sample-file'].disabled = busy;
    ui['series-sample'].disabled = busy;
    ui['zip-sample'].disabled = busy;
    ui['qr-density'].disabled = busy;
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
    pauseAnimation();
    stopFeedbackCamera();
    closeExpanded(false);
    if (series) series.dispose();
    series = null;
    matrixCache.forEach((matrix) => matrix.data.fill(0));
    matrixCache.clear();
    frameIndex = 0;
    transmissionPhase = 'source';
    sourcePassShown = nextSourceFrame = repairCursor = repairSerial = animationTick = 0;
    repairBlocks = [];
    currentRepair = null;
    if (sourceBytes) sourceBytes.fill(0);
    sourceBytes = null;
    sourceName = '';
    sourceZipMetadata = null;
    ui['file-input'].value = '';
    ui['source-details'].hidden = true;
    ui['source-name'].textContent = '';
    ui['source-size'].textContent = '';
    ui['source-format'].textContent = '';
    ui['qr-empty'].hidden = false;
    ui['qr-result'].hidden = true;
    ui['qr-canvas'].width = ui['qr-canvas'].height = 1;
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
  function pauseAnimation() {
    if (animationTimer !== null) window.clearTimeout(animationTimer);
    animationTimer = null;
    animationPlaying = false;
    ui['animation-toggle'].textContent = transmissionPhase === 'confirmed' ? 'Odbiór potwierdzony' : 'Odtwórz serię';
    ui['animation-toggle'].setAttribute('aria-pressed', 'false');
    if (series && mode === 'encode' && transmissionPhase !== 'confirmed') {
      message('encode-message', 'Seria jest wstrzymana. Możesz ją wznowić lub wybrać brakujący fragment ręcznie.', 'success');
      status('Seria QR — odtwarzanie wstrzymane');
    }
  }
  function frameMatrix(key, makeBytes) {
    if (matrixCache.has(key)) {
      const cached = matrixCache.get(key);
      matrixCache.delete(key);
      matrixCache.set(key, cached);
      return cached;
    }
    const bytes = makeBytes();
    let matrix;
    try { matrix = window.WGQR.encodeBytes(bytes); }
    finally { bytes.fill(0); }
    matrixCache.set(key, matrix);
    if (matrixCache.size > 32) {
      const oldest = matrixCache.keys().next().value;
      matrixCache.get(oldest).data.fill(0);
      matrixCache.delete(oldest);
    }
    return matrix;
  }
  function showFrame(index, resetPass = true) {
    if (!series) return;
    frameIndex = Math.max(0, Math.min(series.total - 1, Math.round(index)));
    if (resetPass) {
      transmissionPhase = 'source';
      sourcePassShown = 1;
      nextSourceFrame = (frameIndex + 1) % series.total;
      repairBlocks = Array.from({ length: series.blockCount }, (_, index) => index);
      repairCursor = 0;
      ui['animation-toggle'].disabled = false;
      ui['animation-toggle'].textContent = 'Odtwórz serię';
    }
    currentRepair = null;
    drawQR(frameMatrix(`source:${frameIndex}`, () => series.frame(frameIndex)));
    ui['frame-position'].textContent = `Dane · fragment ${frameIndex + 1} z ${series.total}`;
    ui['frame-slider'].value = String(frameIndex + 1);
    ui['qr-caption'].textContent = `${byteCount(series.size)} · pierwszy przebieg: ${fragmentCount(series.total)}`;
  }
  function showRepairFrame() {
    if (!series || !repairBlocks.length) return;
    transmissionPhase = 'repair';
    const block = repairBlocks[repairCursor % repairBlocks.length];
    repairCursor = (repairCursor + 1) % repairBlocks.length;
    const serial = repairSerial++;
    currentRepair = { block, serial };
    drawQR(frameMatrix(`repair:${block}:${serial}`, () => series.repairFrame(block, serial)));
    ui['frame-position'].textContent = `Naprawa · blok ${block + 1} z ${series.blockCount}`;
    ui['qr-caption'].textContent = `${byteCount(series.size)} · nowe pakiety naprawcze, także dla pominiętych kodów`;
  }
  function selectedFrameRate() {
    const value = Number(ui['frame-rate'].querySelector('input:checked')?.value);
    return [1, 2, 5, 10].includes(value) ? value : 2;
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
    ui['transfer-estimate'].hidden = !series;
    const rate = series ? selectedFrameRate() : null;
    for (const [label, value] of [['one', 1], ['two', 2], ['five', 5], ['ten', 10]]) {
      ui[`estimate-${label}`].textContent = series ? formatPassTime(series.total, value) : '';
      ui[`estimate-${label}-cell`].classList.toggle('is-selected', rate === value);
    }
  }
  function startAnimation() {
    if (!series || transmissionPhase === 'confirmed' || mode !== 'encode' || document.hidden) return;
    pauseAnimation();
    animationPlaying = true;
    ui['animation-toggle'].textContent = 'Wstrzymaj serię';
    ui['animation-toggle'].setAttribute('aria-pressed', 'true');
    const token = sourceEpoch;
    const schedule = () => {
      const fps = selectedFrameRate();
      // Small deterministic timing variations avoid locking onto the same camera phase.
      const jitter = [1, 1.12, 0.91, 1.06, 0.94][animationTick % 5];
      animationTimer = window.setTimeout(tick, Math.round((1000 / fps) * jitter));
    };
    const tick = () => {
      if (!animationPlaying || token !== sourceEpoch || !series || mode !== 'encode' || document.hidden) return;
      animationTick += 1;
      if (transmissionPhase === 'source' && sourcePassShown < series.total) {
        showFrame(nextSourceFrame, false);
        nextSourceFrame = (nextSourceFrame + 1) % series.total;
        sourcePassShown += 1;
      } else {
        showRepairFrame();
      }
      schedule();
    };
    message('encode-message', 'Nadaję dane, a potem nowe pakiety naprawcze. Odbiornik może uzupełnić pominięte kody bez czekania na pełną powtórkę.', 'success');
    status(`Odtwarzanie serii QR — ${selectedFrameRate()} kodów/s`);
    schedule();
  }
  function manualFrame(index) {
    pauseAnimation();
    showFrame(index);
    status('Seria wstrzymana — wybrano fragment ręcznie');
  }
  function drawQR(qr, canvas = ui['qr-canvas']) {
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
    ui['zip-count'].textContent = metadata ? `${fileCount(metadata.count)} w archiwum` : 'Gotowe archiwum ZIP';
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
    if (files.length === 1) return encodeFile(files[0]);
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
      archive = await window.WGZip.createArchive(files, { isCurrent });
      if (!isCurrent()) return;
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
      const file = new File([archive.bytes], archive.name, { type: 'application/zip' });
      ui['transfer-mode'].value = 'series';
      await encodeFile(file, { zipMetadata: metadata });
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
        [87, 71, 81, 82, 45, 65, 67, 75] // WGQR-ACK feedback marker
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
        transfer = await window.WGResilient.createTransfer(bytes, filename, { chunkBytes });
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
        showFrame(0);
        updateTransferEstimate();
        ui['download-qr-label'].textContent = 'Pobierz tę klatkę';
        ui['transfer-info'].textContent = inputIsZip
          ? 'Na drugim urządzeniu wybierz „Odczytaj QR”. Po odebraniu całości pobierzesz ZIP do rozpakowania.'
          : 'Serię odczytasz na tej stronie na drugim urządzeniu. Aplikacja WireGuard nie importuje jej bezpośrednio.';
        ui['capacity-note'].textContent = `${fragmentCount(series.total)} danych po maksymalnie ${series.chunkBytes} B. Po pierwszym przebiegu nadawane są nowe pakiety naprawcze.`;
      } else {
        qr = window.WGQR.encodeBytes(bytes);
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
      ui['source-name'].textContent = sourceName;
      ui['source-size'].textContent = byteCount(bytes.length);
      ui['source-format'].textContent = inputIsZip && sourceZipMetadata ? `Archiwum ZIP · ${fileCount(sourceZipMetadata.count)}` : fileKind(bytes);
      if (inputIsZip) showZipDetails(sourceZipMetadata);
      ui['source-details'].hidden = false;
      ui['qr-empty'].hidden = true;
      ui['qr-result'].hidden = false;
      ui['download-qr'].disabled = false;
      const readyMessage = inputIsZip && sourceZipMetadata
        ? `Spakowano ${fileCount(sourceZipMetadata.count)} do pliki.zip. Seria jest gotowa i wstrzymana; włącz kamerę na drugim urządzeniu, potem odtwórz serię.`
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
      ui['show-feedback'].hidden = true;
      return;
    }
    const received = state.complete || state.kind === 'complete' ? state.total : state.received;
    const complete = received === state.total && Boolean(state.complete || state.kind === 'complete');
    ui['receiving-progress'].hidden = false;
    ui['decoded-empty'].hidden = true;
    ui['receiving-name'].textContent = state.name;
    const resilient = state.version === 2;
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
      let safeRate = 0.55 * 1000 / (metrics.latency + 20);
      const successRatio = metrics.successes / metrics.attempts;
      if (successRatio < 0.5) safeRate = Math.min(safeRate, 2);
      if (successRatio < 0.2) safeRate = 1;
      metrics.recommended = [10, 5, 2, 1].find((rate) => rate <= safeRate) || 1;
    }
    if (!force && metrics.lastPaint && now - metrics.lastPaint < 250) return;
    metrics.lastPaint = now;
    ui['scan-metrics'].hidden = false;
    ui['scan-rate'].textContent = `${metrics.rate.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} /s`;
    ui['scan-latency'].textContent = `${Math.round(metrics.latency)} ms`;
    ui['scan-advice'].textContent = metrics.attempts < 8 || now - metrics.started < 1500
      ? 'Zbieram pomiary. Licznik pokazuje nowe, użyteczne fragmenty — powtórzenia nie zwiększają wyniku.'
      : `Propozycja: ${metrics.recommended} kodów/s. Przekaż ją nadajnikowi kodem zwrotnym; tempo nie zmienia się automatycznie na drugim urządzeniu.`;
  }
  function resetCollector() {
    receiverEpoch += 1;
    if (collector) collector.reset();
    receiverSnapshot = null;
    showReceiving(null, true);
    hideFeedback();
    resetMetrics();
  }
  function prepareReceiver() {
    if (receiverSnapshot && receiverSnapshot.complete) resetCollector();
    clearDecoded();
    showReceiving(receiverSnapshot, true);
  }
  function receiverError(error) {
    if (error.code === 'TRANSFER_RESET') return;
    receiverSnapshot = collector.state;
    showReceiving(receiverSnapshot, true);
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
  function receiveBytes(bytes, isCurrent) {
    const epoch = receiverEpoch;
    const payload = Uint8Array.from(bytes);
    const operation = receiverChain.then(async () => {
      if (epoch !== receiverEpoch || !isCurrent()) return { done: false, stale: true };
      if (receiverSnapshot && receiverSnapshot.complete) return { done: true, delta: 0 };
      try {
        const previous = receiverSnapshot;
        const result = await collector.accept(payload);
        // Switching tabs or stopping the camera retains an already accepted transfer.
        // Clearing/resetting the receiver, however, invalidates even a pending digest.
        if (epoch !== receiverEpoch) return { done: false, stale: true };
        if (result.kind === 'plain') {
          if (previous && !previous.complete && previous.received > 0) {
            showReceiving();
            message('decode-message', 'Trwa odbiór serii. Aby otworzyć pojedynczy QR, najpierw wybierz „Reset odbioru”.', 'warning');
            return { done: false, blocked: true };
          }
          stopCamera();
          return { done: acceptDecoded(result) };
        }
        if (result.kind === 'foreign') {
          showReceiving(result);
          message('decode-message', 'To fragment innego pliku. Dokończ bieżącą serię albo wybierz „Reset odbioru”.', 'warning');
          return { done: false, foreign: true };
        }
        if (result.kind === 'complete') {
          receiverSnapshot = { ...result, bytes: undefined, complete: true };
          const delta = Math.max(0, result.total - (previous?.received || 0));
          stopCamera();
          showReceiving(receiverSnapshot, true);
          return { done: acceptDecoded(result, result.name, true), delta };
        }
        const delta = Math.max(0, result.received - (previous?.received || 0));
        receiverSnapshot = result;
        if (delta > 0 || !previous) showReceiving(result);
        return { done: false, progress: true, delta };
      } catch (error) {
        if (epoch === receiverEpoch) receiverError(error);
        return { done: false, error: true };
      }
    }).finally(() => payload.fill(0));
    // Keep operations serial without allowing a rejected old operation to block a new one.
    receiverChain = operation.catch(() => undefined);
    return operation;
  }
  function hideFeedback() {
    ui['feedback-panel'].hidden = true;
    ui['feedback-canvas'].width = ui['feedback-canvas'].height = 1;
    ui['feedback-caption'].textContent = '';
  }
  function showFeedback() {
    if (!receiverSnapshot || receiverSnapshot.version !== 2) return;
    stopCamera();
    let bytes;
    try {
      bytes = collector.createFeedback({ suggestedRate: metrics.recommended });
      drawQR(window.WGQR.encodeBytes(bytes), ui['feedback-canvas']);
      ui['feedback-panel'].hidden = false;
      ui['resume-receiving'].hidden = Boolean(receiverSnapshot.complete);
      ui['feedback-caption'].textContent = receiverSnapshot.complete
        ? 'Odbiór pliku został sprawdzony. Na nadajniku wybierz „Zeskanuj potwierdzenie”, aby potwierdzić zakończenie.'
        : `Na nadajniku wybierz „Zeskanuj potwierdzenie”. Kod wskaże niepełne bloki i zaproponuje ${metrics.recommended} kodów/s. Potem wznowisz odbiór.`;
      ui['close-feedback'].focus();
    } catch {
      message('decode-message', 'Kod zwrotny jest dostępny po odebraniu fragmentu nowej serii. Odśwież obie strony, jeśli używasz starszej wersji.', 'error');
    } finally {
      if (bytes) bytes.fill(0);
    }
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
    if (![1, 2, 5, 10].includes(rate)) return;
    ui['frame-rate'].querySelectorAll('input[type="radio"]').forEach((input) => { input.checked = Number(input.value) === rate; });
    updateTransferEstimate();
  }
  async function receiveFeedback(bytes, isCurrent) {
    const transfer = series;
    const epoch = sourceEpoch;
    if (!transfer || !isCurrent()) return false;
    try {
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
        repairCursor = 0;
        transmissionPhase = 'repair';
        ui['animation-toggle'].disabled = false;
        showRepairFrame();
        message('feedback-message', `Pozostałe bloki: ${repairBlocks.length}. Ustawiono ${selectedFrameRate()} kodów/s. Wznów odbiór na drugim urządzeniu, a tutaj wybierz „Odtwórz serię”.`, 'success');
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
  async function scanImage(file, current) {
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
      if (Math.max(width, height) > 1600) plans.push([0, 0, width, height, 2400]);
      // Overlapping crops also handle a small QR embedded in a tall phone screenshot.
      if (height > width * 1.3) {
        const slice = Math.min(height, width * 1.35);
        for (const y of [0, (height - slice) / 2, height - slice]) plans.push([0, y, width, slice, 1800]);
      } else if (width > height * 1.3) {
        const slice = Math.min(width, height * 1.35);
        for (const x of [0, (width - slice) / 2, width - slice]) plans.push([x, 0, slice, height, 1800]);
      }
      for (const plan of plans) {
        await breathe();
        if (!isCurrent()) return;
        const result = decodeRegion(image, ...plan);
        if (result && result.bytes && result.bytes.length) return result;
      }
      return null;
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
        try { result = await scanImage(files[index], token); }
        catch (error) { lastImageError = error.message; unreadable += 1; continue; }
        if (token !== decodeEpoch || mode !== 'decode') return;
        if (!result) { unreadable += 1; continue; }
        found += 1;
        const outcome = await receiveBytes(result.bytes, () => token === decodeEpoch && mode === 'decode');
        if (outcome.done) return;
        if (outcome.error || outcome.foreign || outcome.blocked) rejected += 1;
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
    let videoRequest = null;
    let animationRequest = null;
    let retryTimer = null;
    let cancelled = false;
    let scanning = false;
    let lastFrame = null;
    let lastPoll = 0;
    const active = () => !cancelled && isCurrent() && !document.hidden;
    const cancel = () => {
      cancelled = true;
      if (videoRequest !== null && typeof video.cancelVideoFrameCallback === 'function') video.cancelVideoFrameCallback(videoRequest);
      if (animationRequest !== null) window.cancelAnimationFrame(animationRequest);
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
    const schedule = () => {
      if (!active() || scanning) return;
      if (typeof video.requestVideoFrameCallback === 'function') {
        videoRequest = video.requestVideoFrameCallback((_now, metadata) => {
          videoRequest = null;
          return scan(metadata);
        });
      } else {
        retryTimer = window.setTimeout(() => {
          retryTimer = null;
          if (!active()) return;
          if (typeof window.requestAnimationFrame === 'function') {
            animationRequest = window.requestAnimationFrame(() => {
              animationRequest = null;
              return scan();
            });
          } else void scan();
        }, Math.max(0, 34 - (window.performance.now() - lastPoll)));
      }
    };
    const scan = async (metadata) => {
      if (!active() || scanning) return;
      scanning = true;
      lastPoll = window.performance.now();
      try {
        if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
          const key = frameKey(metadata);
          if (key !== null && key === lastFrame) return;
          lastFrame = key;
          if (await processFrame()) cancel();
        }
      } catch (error) {
        if (active()) onError(error);
        cancel();
      } finally {
        scanning = false;
        schedule();
      }
    };
    schedule();
    return cancel;
  }
  async function startFeedbackCamera() {
    if (!series || series.version !== 2) return;
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
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      if (!valid() || document.hidden) { stream.getTracks().forEach((track) => track.stop()); return; }
      feedbackStream = stream;
      const video = ui['feedback-video'];
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      if (!valid()) return;
      const scanner = window.WGCamera.createScanner({ decode: window.WGQR.decodePixels });
      feedbackScanner = scanner;
      stream.getVideoTracks().forEach((track) => track.addEventListener('ended', () => { if (valid()) stopFeedbackCamera(true); }, { once: true }));
      message('feedback-message', 'Skanuję kod zwrotny. Nadajnik pozostaje w pauzie.');
      cancelFeedbackScan = startVideoLoop(video, () => valid() && feedbackStream === stream, async () => {
        const sample = scanner.scan(video);
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
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
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
      ui['scan-help'].textContent = 'Pokaż cały QR z białą ramką. Przy serii kamera czeka na wszystkie fragmenty i sprawdzenie pliku.';
      message('decode-message', 'Skanowanie… skieruj kamerę na kod QR.');
      status('Kamera włączona — skanowanie lokalne');
      stream.getVideoTracks().forEach((track) => track.addEventListener('ended', () => {
        if (token === cameraEpoch) stopCamera(true);
      }, { once: true }));
      const video = ui['camera-video'];
      const scanner = window.WGCamera.createScanner({ decode: window.WGQR.decodePixels });
      cameraScanner = scanner;
      const active = () => token === cameraEpoch && cameraStream === stream && mode === 'decode';
      cancelCameraScan = startVideoLoop(video, active, async () => {
        const epoch = receiverEpoch;
        const sample = scanner.scan(video);
        const outcome = sample.result ? await receiveBytes(sample.result.bytes, active) : { done: false, delta: 0 };
        if (epoch === receiverEpoch && (active() || (outcome.done && mode === 'decode'))) {
          recordScan(sample, outcome.delta || 0, outcome.done);
        }
        return Boolean(outcome.done);
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

  if (!window.WGQR || !window.WGTransfer || !window.WGResilient || !window.WGCamera || !window.WGZip || !scanContext) {
    message('encode-message', 'Nie udało się wczytać narzędzia. Odśwież stronę.', 'error');
    ui['choose-file'].disabled = ui['choose-image'].disabled = ui['sample-file'].disabled = ui['series-sample'].disabled = ui['zip-sample'].disabled = ui['start-camera'].disabled = true;
    return;
  }
  collector = window.WGResilient.createCollector();
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
  ui['choose-file'].addEventListener('click', () => ui['file-input'].click());
  ui['choose-image'].addEventListener('click', () => ui['image-input'].click());
  ui['file-input'].addEventListener('change', () => { if (ui['file-input'].files.length) selectFiles(Array.from(ui['file-input'].files)); });
  ui['image-input'].addEventListener('change', () => { if (ui['image-input'].files.length) decodeImages(Array.from(ui['image-input'].files)); });
  bindDrop(ui['file-drop'], selectFiles, 'encode-message', true);
  bindDrop(ui['image-drop'], decodeImages, 'decode-message', true);
  ui['transfer-mode'].addEventListener('change', () => {
    pauseAnimation();
    if (sourceBytes) {
      // File copies bytes before encodeFile clears the previous source buffer.
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
    const expectedEpoch = sourceEpoch + 1;
    await encodeFile(file, { zipMetadata });
    if (sourceEpoch === expectedEpoch && series) {
      message('encode-message', 'Zmieniono gęstość i utworzono nowy transfer. Na odbiorniku wybierz „Reset odbioru”, zanim wznowisz skanowanie.', 'warning');
    }
  });
  ui['animation-toggle'].addEventListener('click', () => animationPlaying ? pauseAnimation() : startAnimation());
  ui['previous-frame'].addEventListener('click', () => { if (series) manualFrame((frameIndex - 1 + series.total) % series.total); });
  ui['next-frame'].addEventListener('click', () => { if (series) manualFrame((frameIndex + 1) % series.total); });
  ui['frame-slider'].addEventListener('input', () => manualFrame(Number(ui['frame-slider'].value) - 1));
  ui['frame-rate'].addEventListener('change', () => {
    updateTransferEstimate();
    if (animationPlaying) startAnimation();
    else status(`Ustawiono ${selectedFrameRate()} kodów/s — naciśnij „Odtwórz serię”`);
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
    encodeFile(new File([contents], 'przyklad-serii-demo.txt', { type: 'text/plain' }));
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
    if (!sourceBytes) return;
    pauseAnimation();
    const token = sourceEpoch;
    const suffix = series ? currentRepair
      ? `-naprawa-blok-${currentRepair.block + 1}-pakiet-${currentRepair.serial}`
      : `-fragment-${String(frameIndex + 1).padStart(3, '0')}-z-${String(series.total).padStart(3, '0')}` : '';
    const filename = cleanName(sourceName.replace(/\.[^.]*$/, ''), 'kod-qr') + suffix + '.png';
    ui['qr-canvas'].toBlob((blob) => {
      if (token !== sourceEpoch || !sourceBytes) return;
      if (!blob) { message('encode-message', 'Nie udało się zapisać obrazu QR. Spróbuj ponownie.', 'error'); return; }
      downloadBlob(blob, filename);
      status('Obraz PNG gotowy do zapisania');
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
  ui['close-feedback'].addEventListener('click', () => { hideFeedback(); ui['show-feedback'].focus(); });
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
      pauseAnimation();
      const wasActive = Boolean(cameraStream) || !ui['stop-camera'].hidden;
      stopCamera(wasActive);
      stopFeedbackCamera();
      closePreviews();
    }
  });
  window.addEventListener('pagehide', () => {
    resetAll();
    pendingUrls.forEach((url) => URL.revokeObjectURL(url));
    pendingUrls.clear();
  });
  clearSource();
  clearDecoded();
  showReceiving(null);
  resetMetrics();
  selectMode('encode');
})();
