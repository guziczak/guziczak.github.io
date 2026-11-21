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
    'reset-receiver', 'receiving-help'
  ].forEach((id) => { ui[id] = $(id); });

  const MAX_BYTES = 2953;
  const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
  const DEFAULT_CAPACITY = 'Jeden QR: do 2953 B. Seria QR: do 256 KiB. Odtwarzanie serii zaczyna się od pauzy.';
  let mode = 'encode';
  let sourceBytes = null;
  let decodedBytes = null;
  let sourceName = '';
  let sourceEpoch = 0;
  let decodeEpoch = 0;
  let cameraEpoch = 0;
  let cameraStream = null;
  let cameraTimer = null;
  let pendingImageCancel = null;
  let series = null;
  let frameIndex = 0;
  let animationTimer = null;
  let animationPlaying = false;
  let animationCycle = 0;
  let animationOrder = [];
  let animationPosition = 0;
  let receiverEpoch = 0;
  let receiverChain = Promise.resolve();
  let collector = null;
  const matrixCache = new Map();
  const pendingUrls = new Set();
  const scanCanvas = document.createElement('canvas');
  const scanContext = scanCanvas.getContext('2d', { willReadFrequently: true });

  function status(text) { ui['status-bar'].textContent = text; }
  function message(target, text = '', kind = '') {
    ui[target].textContent = text;
    ui[target].dataset.kind = kind;
  }
  function byteCount(count) { return `${count.toLocaleString('pl-PL')} B`; }
  function cleanName(name, fallback = 'wireguard.conf') {
    const cleaned = String(name || '').replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, '_').replace(/^\.+/, '').trim().slice(0, 120);
    return cleaned || fallback;
  }
  function textFrom(bytes) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { return null; }
  }
  function fileKind(bytes) {
    const text = textFrom(bytes);
    if (text !== null && /^\s*\[Interface\]\s*$/m.test(text) && /^\s*\[Peer\]\s*$/m.test(text)) {
      return 'Konfiguracja WireGuard';
    }
    return text === null || /\u0000/.test(text) ? 'Plik binarny' : 'Plik tekstowy';
  }
  function preview(bytes) {
    if (!bytes) return '';
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
  function encodeBusy(busy) {
    ui['choose-file'].disabled = busy;
    ui['sample-file'].disabled = busy;
    ui['series-sample'].disabled = busy;
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
    if (series) series.frames.forEach((frame) => frame.fill(0));
    series = null;
    matrixCache.forEach((matrix) => matrix.data.fill(0));
    matrixCache.clear();
    frameIndex = 0;
    animationOrder = [];
    animationCycle = animationPosition = 0;
    if (sourceBytes) sourceBytes.fill(0);
    sourceBytes = null;
    sourceName = '';
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
    if (cameraTimer !== null) window.clearTimeout(cameraTimer);
    cameraTimer = null;
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
    ui['animation-toggle'].textContent = 'Odtwórz serię';
    ui['animation-toggle'].setAttribute('aria-pressed', 'false');
    if (series && mode === 'encode') {
      message('encode-message', 'Seria jest wstrzymana. Możesz ją wznowić lub wybrać brakujący fragment ręcznie.', 'success');
      status('Seria QR — odtwarzanie wstrzymane');
    }
  }
  function frameMatrix(index) {
    if (matrixCache.has(index)) {
      const cached = matrixCache.get(index);
      matrixCache.delete(index);
      matrixCache.set(index, cached);
      return cached;
    }
    const matrix = window.WGQR.encodeBytes(series.frames[index]);
    matrixCache.set(index, matrix);
    if (matrixCache.size > 32) {
      const oldest = matrixCache.keys().next().value;
      matrixCache.get(oldest).data.fill(0);
      matrixCache.delete(oldest);
    }
    return matrix;
  }
  function showFrame(index) {
    if (!series) return;
    frameIndex = Math.max(0, Math.min(series.total - 1, Math.round(index)));
    drawQR(frameMatrix(frameIndex));
    ui['frame-position'].textContent = `Fragment ${frameIndex + 1} z ${series.total}`;
    ui['frame-slider'].value = String(frameIndex + 1);
    ui['qr-caption'].textContent = `${byteCount(series.size)} · ${series.total} ${series.total === 1 ? 'fragment' : 'fragmentów'} QR`;
  }
  function makeAnimationOrder(start) {
    const direction = animationCycle % 2 ? -1 : 1;
    animationOrder = Array.from({ length: series.total }, (_, i) => (start + direction * i + series.total) % series.total);
    animationPosition = 0;
  }
  function startAnimation() {
    if (!series || mode !== 'encode' || document.hidden) return;
    pauseAnimation();
    animationPlaying = true;
    animationCycle = 0;
    makeAnimationOrder(frameIndex);
    ui['animation-toggle'].textContent = 'Wstrzymaj serię';
    ui['animation-toggle'].setAttribute('aria-pressed', 'true');
    const token = sourceEpoch;
    const schedule = () => {
      const fps = Number(ui['frame-rate'].value) || 3;
      // Small deterministic timing variations avoid locking onto the same camera phase.
      const jitter = [1, 1.12, 0.91, 1.06, 0.94][(animationPosition + animationCycle) % 5];
      animationTimer = window.setTimeout(tick, Math.round((1000 / fps) * jitter));
    };
    const tick = () => {
      if (!animationPlaying || token !== sourceEpoch || !series || mode !== 'encode' || document.hidden) return;
      animationPosition += 1;
      if (animationPosition >= animationOrder.length) {
        animationCycle += 1;
        makeAnimationOrder((animationCycle + frameIndex + 1) % series.total);
      }
      showFrame(animationOrder[animationPosition]);
      schedule();
    };
    message('encode-message', 'Seria jest odtwarzana w pętli. Skieruj na ekran kamerę drugiego urządzenia i zaczekaj na wszystkie fragmenty.', 'success');
    status('Odtwarzanie serii QR — pokaż ekran drugiemu urządzeniu');
    schedule();
  }
  function manualFrame(index) {
    pauseAnimation();
    showFrame(index);
    status('Seria wstrzymana — wybrano fragment ręcznie');
  }
  function drawQR(qr) {
    const margin = 4;
    const scale = Math.max(6, Math.floor(960 / (qr.size + margin * 2)));
    const canvas = ui['qr-canvas'];
    canvas.width = canvas.height = (qr.size + margin * 2) * scale;
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
  async function encodeFile(file) {
    const token = ++sourceEpoch;
    clearSource();
    encodeBusy(false);
    message('encode-message');
    if (!file) return;
    if (!file.size) {
      message('encode-message', 'Ten plik jest pusty. Wybierz plik z konfiguracją.', 'error');
      status('Wybrany plik jest pusty');
      return;
    }
    const requestedMode = ui['transfer-mode'].value;
    let useSeries = requestedMode === 'series' || (requestedMode === 'auto' && file.size > MAX_BYTES);
    const limit = useSeries ? window.WGTransfer.MAX_FILE_BYTES : MAX_BYTES;
    if (file.size > limit) {
      const advice = requestedMode === 'single' && file.size <= window.WGTransfer.MAX_FILE_BYTES
        ? 'Wybierz tryb „Automatycznie” lub „Seria QR”, a następnie ponownie wybierz plik.'
        : 'Maksymalny rozmiar serii to 256 KiB. Wybierz mniejszy plik.';
      message('encode-message', `Plik ma ${byteCount(file.size)}. ${advice}`, 'error');
      status('Plik przekracza limit wybranego trybu');
      return;
    }
    encodeBusy(true);
    status(useSeries ? 'Przygotowywanie serii QR…' : 'Tworzenie kodu QR…');
    let bytes;
    let transfer;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
      if (token !== sourceEpoch || mode !== 'encode') { bytes.fill(0); return; }
      const reservedPrefix = [87, 71, 81, 82, 45, 88, 70, 82]; // WGQR-XFR protocol marker
      const protocolLike = bytes.length >= 8 && reservedPrefix.every((value, index) => bytes[index] === value);
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
        transfer = await window.WGTransfer.createTransfer(bytes, filename);
        if (token !== sourceEpoch || mode !== 'encode') {
          transfer.frames.forEach((frame) => frame.fill(0));
          bytes.fill(0);
          return;
        }
        series = transfer;
        ui['series-controls'].hidden = false;
        ui['frame-slider'].max = String(series.total);
        ui['frame-slider'].value = '1';
        showFrame(0);
        ui['download-qr-label'].textContent = 'Pobierz tę klatkę';
        ui['transfer-info'].textContent = 'Serię odczytasz na tej stronie na drugim urządzeniu. Aplikacja WireGuard nie importuje jej bezpośrednio.';
        ui['capacity-note'].textContent = `${series.total} fragmentów po maksymalnie 600 B danych. Odtwarzaj w pętli lub wybieraj brakujące numery ręcznie.`;
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
      ui['source-name'].textContent = sourceName;
      ui['source-size'].textContent = byteCount(bytes.length);
      ui['source-format'].textContent = fileKind(bytes);
      ui['source-details'].hidden = false;
      ui['qr-empty'].hidden = true;
      ui['qr-result'].hidden = false;
      ui['download-qr'].disabled = false;
      message('encode-message', useSeries ? 'Seria jest gotowa i wstrzymana. Włącz kamerę na drugim urządzeniu, a potem odtwórz serię.' : 'Gotowe. Zeskanuj kod na drugim urządzeniu lub pobierz PNG.', 'success');
      status(useSeries ? 'Seria QR gotowa — odtwarzanie wstrzymane' : 'Kod QR utworzony lokalnie');
    } catch {
      if (bytes && bytes !== sourceBytes) bytes.fill(0);
      if (transfer && transfer !== series) transfer.frames.forEach((frame) => frame.fill(0));
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
    ui['output-name'].value = filename ? cleanName(filename) : kind === 'Konfiguracja WireGuard' ? 'wireguard.conf' : kind === 'Plik binarny' ? 'odczytany-plik.bin' : 'odczytany-plik.txt';
    message('decode-message', verified ? 'Odebrano wszystkie fragmenty i sprawdzono sumę SHA-256. Plik jest gotowy do pobrania.' : 'Kod odczytany. Nazwij plik i pobierz jego zawartość.', 'success');
    if (mode === 'decode') status(verified ? 'Plik odtworzony i sprawdzony' : 'QR odczytany lokalnie');
    return true;
  }
  function showReceiving(state = collector && collector.state) {
    if (!state) {
      ui['receiving-progress'].hidden = true;
      ui['decoded-empty'].hidden = Boolean(decodedBytes);
      ui['receiving-name'].textContent = '';
      ui['receiving-count'].textContent = '';
      ui['receiving-progressbar'].max = 1;
      ui['receiving-progressbar'].value = 0;
      ui['receiving-missing'].textContent = '';
      ui['receiving-help'].textContent = '';
      return;
    }
    const received = state.complete || state.kind === 'complete' ? state.total : state.received;
    const complete = received === state.total && Boolean(state.complete || state.kind === 'complete');
    ui['receiving-progress'].hidden = false;
    ui['decoded-empty'].hidden = true;
    ui['receiving-name'].textContent = state.name;
    ui['receiving-count'].textContent = `${received} z ${state.total} fragmentów · ${byteCount(state.size)}`;
    ui['receiving-progressbar'].max = state.total;
    ui['receiving-progressbar'].value = received;
    const missing = state.missing || [];
    ui['receiving-missing'].textContent = missing.length
      ? `Brakuje: ${missing.slice(0, 18).join(', ')}${missing.length > 18 ? ` i jeszcze ${missing.length - 18}` : ''}.`
      : complete ? 'Odebrano całą serię.' : 'Sprawdzanie integralności pliku…';
    ui['receiving-help'].textContent = complete
      ? 'Zachowano nazwę oraz bajty pliku. Aby odebrać inny plik, rozpocznij nowy odczyt.'
      : 'Kolejność nie ma znaczenia. Powtórzone fragmenty są pomijane; możesz pokazać brakujące klatki ręcznie.';
  }
  function resetCollector() {
    receiverEpoch += 1;
    if (collector) collector.reset();
    showReceiving(null);
  }
  function prepareReceiver() {
    if (collector.state && collector.state.complete) resetCollector();
    clearDecoded();
    showReceiving();
  }
  function receiverError(error) {
    if (error.code === 'TRANSFER_RESET') return;
    const state = collector.state;
    showReceiving(state);
    const text = error.code === 'CRYPTO_UNAVAILABLE'
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
      if (collector.state && collector.state.complete) return { done: true };
      try {
        const previous = collector.state;
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
          stopCamera();
          showReceiving(result);
          return { done: acceptDecoded(result, result.name, true) };
        }
        showReceiving(result);
        message('decode-message', result.duplicate ? 'Ten fragment już mamy. Czekam na brakujące.' : `Odebrano ${result.received} z ${result.total} fragmentów.`, 'success');
        if (mode === 'decode') status(`Odbieranie serii: ${result.received} / ${result.total}`);
        return { done: false, progress: true };
      } catch (error) {
        if (epoch === receiverEpoch) receiverError(error);
        return { done: false, error: true };
      }
    }).finally(() => payload.fill(0));
    // Keep operations serial without allowing a rejected old operation to block a new one.
    receiverChain = operation.catch(() => undefined);
    return operation;
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
  async function scanImage(file, token) {
    if (!file.size || file.size > MAX_IMAGE_BYTES) {
      throw new Error('image-size');
    }
    if (file.type === 'image/svg+xml' || (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|gif|bmp|avif|heic|heif)$/i.test(file.name))) {
      throw new Error('invalid-image');
    }
    let image;
    try {
      image = await readImage(file);
      if (token !== decodeEpoch || mode !== 'decode') return;
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
        if (token !== decodeEpoch || mode !== 'decode') return;
        const result = decodeRegion(image, ...plan);
        if (result && result.bytes && result.bytes.length) return result;
      }
      return null;
    } finally {
      if (image) image.src = '';
      if (token === decodeEpoch) scanCanvas.width = scanCanvas.height = 1;
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
        if (decodedBytes || (collector.state && collector.state.complete)) return;
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
      } else if (!rejected && collector.state) {
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
  async function startCamera() {
    decodeEpoch += 1;
    cancelImageRead();
    stopCamera();
    prepareReceiver();
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
      const scan = async () => {
        if (token !== cameraEpoch) return;
        const video = ui['camera-video'];
        try {
          if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
            const result = decodeRegion(video, 0, 0, video.videoWidth, video.videoHeight, 1600);
            if (result && result.bytes && result.bytes.length) {
              const outcome = await receiveBytes(result.bytes, () => token === cameraEpoch && mode === 'decode');
              if (outcome.done || token !== cameraEpoch) return;
            }
          }
        } catch {
          stopCamera();
          message('decode-message', 'Nie udało się odczytać obrazu z kamery. Spróbuj ponownie lub wczytaj zdjęcie QR.', 'error');
          return;
        }
        if (token === cameraEpoch) cameraTimer = window.setTimeout(scan, 180);
      };
      scan();
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

  if (!window.WGQR || !window.WGTransfer || !scanContext) {
    message('encode-message', 'Nie udało się wczytać narzędzia. Odśwież stronę.', 'error');
    ui['choose-file'].disabled = ui['choose-image'].disabled = ui['sample-file'].disabled = ui['series-sample'].disabled = ui['start-camera'].disabled = true;
    return;
  }
  collector = window.WGTransfer.createCollector();
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
  ui['file-input'].addEventListener('change', () => { if (ui['file-input'].files[0]) encodeFile(ui['file-input'].files[0]); });
  ui['image-input'].addEventListener('change', () => { if (ui['image-input'].files.length) decodeImages(Array.from(ui['image-input'].files)); });
  bindDrop(ui['file-drop'], encodeFile, 'encode-message');
  bindDrop(ui['image-drop'], decodeImages, 'decode-message', true);
  ui['transfer-mode'].addEventListener('change', () => {
    pauseAnimation();
    if (sourceBytes) {
      // File copies bytes before encodeFile clears the previous source buffer.
      const file = new File([sourceBytes], sourceName, { type: 'application/octet-stream' });
      encodeFile(file);
    }
  });
  ui['animation-toggle'].addEventListener('click', () => animationPlaying ? pauseAnimation() : startAnimation());
  ui['previous-frame'].addEventListener('click', () => { if (series) manualFrame((frameIndex - 1 + series.total) % series.total); });
  ui['next-frame'].addEventListener('click', () => { if (series) manualFrame((frameIndex + 1) % series.total); });
  ui['frame-slider'].addEventListener('input', () => manualFrame(Number(ui['frame-slider'].value) - 1));
  ui['frame-rate'].addEventListener('change', () => { pauseAnimation(); status('Zmieniono prędkość — naciśnij „Odtwórz serię”'); });
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
    const contents = (heading + 'Przykladowy plik do transferu przez piec kodow QR.\n'.repeat(70)).slice(0, 3000);
    ui['transfer-mode'].value = 'series';
    encodeFile(new File([contents], 'przyklad-serii-demo.txt', { type: 'text/plain' }));
  });
  ui['download-qr'].addEventListener('click', () => {
    if (!sourceBytes) return;
    pauseAnimation();
    const token = sourceEpoch;
    const suffix = series ? `-fragment-${String(frameIndex + 1).padStart(3, '0')}-z-${String(series.total).padStart(3, '0')}` : '';
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
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pauseAnimation();
      const wasActive = Boolean(cameraStream) || !ui['stop-camera'].hidden;
      stopCamera(wasActive);
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
  selectMode('encode');
})();
