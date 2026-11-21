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
    'decoded-preview', 'status-bar'
  ].forEach((id) => { ui[id] = $(id); });

  const MAX_BYTES = 2953;
  const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
  const DEFAULT_CAPACITY = 'Jeden QR mieści do 2953 bajtów. Plik zostaje zapisany bez zmian.';
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
    ui['file-drop'].setAttribute('aria-busy', String(busy));
  }
  function decodeBusy(busy) {
    ui['choose-image'].disabled = busy;
    ui['start-camera'].disabled = busy;
    ui['image-drop'].setAttribute('aria-busy', String(busy));
  }
  function clearSource() {
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
    if (file.size > MAX_BYTES) {
      message('encode-message', `Plik ma ${byteCount(file.size)}. Jeden QR mieści maksymalnie ${byteCount(MAX_BYTES)}. Wybierz mniejszy plik; jego treść nie zostanie skrócona.`, 'error');
      status('Plik jest za duży na jeden QR');
      return;
    }
    encodeBusy(true);
    status('Tworzenie kodu QR…');
    let bytes;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
      if (token !== sourceEpoch || mode !== 'encode') { bytes.fill(0); return; }
      const qr = window.WGQR.encodeBytes(bytes);
      drawQR(qr);
      sourceBytes = bytes;
      sourceName = cleanName(file.name, 'plik');
      ui['source-name'].textContent = sourceName;
      ui['source-size'].textContent = byteCount(bytes.length);
      ui['source-format'].textContent = fileKind(bytes);
      ui['source-details'].hidden = false;
      ui['qr-empty'].hidden = true;
      ui['qr-result'].hidden = false;
      ui['download-qr'].disabled = false;
      ui['qr-caption'].textContent = `${byteCount(bytes.length)} · kod QR gotowy do skanowania`;
      ui['capacity-note'].textContent = qr.level === 'L'
        ? 'Większy plik: QR używa niższej korekcji błędów. Przy skanowaniu pokaż cały kod ostro i bez odbić.'
        : DEFAULT_CAPACITY;
      message('encode-message', 'Gotowe. Zeskanuj kod na drugim urządzeniu lub pobierz PNG.', 'success');
      status('Kod QR utworzony lokalnie');
    } catch {
      if (bytes && bytes !== sourceBytes) bytes.fill(0);
      if (token === sourceEpoch) {
        clearSource();
        message('encode-message', 'Nie udało się odczytać pliku lub utworzyć QR. Spróbuj ponownie z małym plikiem .conf.', 'error');
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
  function acceptDecoded(result) {
    if (!result || !result.bytes || !result.bytes.length) return false;
    decodedBytes = Uint8Array.from(result.bytes);
    ui['decoded-size'].textContent = byteCount(decodedBytes.length);
    ui['decoded-kind'].textContent = fileKind(decodedBytes);
    ui['decoded-empty'].hidden = true;
    ui['decoded-result'].hidden = false;
    ui['download-file'].disabled = false;
    const kind = fileKind(decodedBytes);
    ui['output-name'].value = kind === 'Konfiguracja WireGuard' ? 'wireguard.conf' : kind === 'Plik binarny' ? 'odczytany-plik.bin' : 'odczytany-plik.txt';
    message('decode-message', 'Kod odczytany. Nazwij plik i pobierz jego zawartość.', 'success');
    status('QR odczytany lokalnie');
    return true;
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
  async function decodeImage(file) {
    const token = ++decodeEpoch;
    cancelImageRead();
    stopCamera();
    clearDecoded();
    message('decode-message');
    if (!file) return;
    if (!file.size || file.size > MAX_IMAGE_BYTES) {
      message('decode-message', 'Wybierz niepusty obraz PNG, JPG lub WebP do 20 MB.', 'error');
      return;
    }
    if (file.type === 'image/svg+xml' || (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|gif|bmp|avif|heic|heif)$/i.test(file.name))) {
      message('decode-message', 'Wybierz zdjęcie lub zrzut ekranu z kodem QR (PNG, JPG lub WebP).', 'error');
      return;
    }
    decodeBusy(true);
    status('Odczytywanie obrazu QR…');
    message('decode-message', 'Odczytywanie obrazu…');
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
        if (result && acceptDecoded(result)) return;
      }
      message('decode-message', 'Nie znaleziono czytelnego QR. Przytnij obraz bliżej kodu, zachowując białą ramkę, albo użyj wyraźniejszego zdjęcia.', 'error');
      status('Nie znaleziono QR w obrazie');
    } catch (error) {
      if (token !== decodeEpoch) return;
      const text = error.message === 'image-too-large'
        ? 'Ten obraz ma zbyt duże wymiary. Przytnij go do samego kodu QR i spróbuj ponownie.'
        : 'Nie udało się odczytać tego obrazu. Spróbuj pliku PNG, JPG lub WebP.';
      message('decode-message', text, 'error');
      status('Nie udało się odczytać obrazu');
    } finally {
      if (image) image.src = '';
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
    clearDecoded();
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
      ui['scan-help'].textContent = 'Pokaż cały kod wraz z białą ramką. Kamera wyłączy się po odczytaniu.';
      message('decode-message', 'Skanowanie… skieruj kamerę na kod QR.');
      status('Kamera włączona — skanowanie lokalne');
      stream.getVideoTracks().forEach((track) => track.addEventListener('ended', () => {
        if (token === cameraEpoch) stopCamera(true);
      }, { once: true }));
      const scan = () => {
        if (token !== cameraEpoch) return;
        const video = ui['camera-video'];
        try {
          if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
            const result = decodeRegion(video, 0, 0, video.videoWidth, video.videoHeight, 1600);
            if (result && result.bytes && result.bytes.length) {
              stopCamera();
              acceptDecoded(result);
              return;
            }
          }
        } catch {
          stopCamera();
          message('decode-message', 'Nie udało się odczytać obrazu z kamery. Spróbuj ponownie lub wczytaj zdjęcie QR.', 'error');
          return;
        }
        cameraTimer = window.setTimeout(scan, 180);
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
  function bindDrop(zone, handler, errorTarget) {
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
      if (files.length !== 1) {
        if (errorTarget === 'encode-message') { sourceEpoch += 1; clearSource(); encodeBusy(false); }
        else { decodeEpoch += 1; cancelImageRead(); stopCamera(); clearDecoded(); }
        message(errorTarget, 'Przeciągnij jeden plik naraz.', 'error');
        return;
      }
      handler(files[0]);
    });
  }

  if (!window.WGQR || !scanContext) {
    message('encode-message', 'Nie udało się wczytać narzędzia. Odśwież stronę.', 'error');
    ui['choose-file'].disabled = ui['choose-image'].disabled = ui['sample-file'].disabled = ui['start-camera'].disabled = true;
    return;
  }
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
  ui['image-input'].addEventListener('change', () => { if (ui['image-input'].files[0]) decodeImage(ui['image-input'].files[0]); });
  bindDrop(ui['file-drop'], encodeFile, 'encode-message');
  bindDrop(ui['image-drop'], decodeImage, 'decode-message');
  // Dropping outside either target must not navigate away and expose the file.
  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', (event) => event.preventDefault());
  ui['sample-file'].addEventListener('click', () => {
    const sample = '# PRZYKLAD DEMONSTRACYJNY — nie jest aktywnym VPN\n[Interface]\nPrivateKey = DEMO_NIEPRAWIDLOWY_KLUCZ\nAddress = 10.0.0.2/32\n\n[Peer]\nPublicKey = DEMO_NIEPRAWIDLOWY_KLUCZ\nEndpoint = vpn.example.com:51820\nAllowedIPs = 0.0.0.0/0, ::/0\n';
    encodeFile(new File([sample], 'przyklad-demo.conf', { type: 'text/plain' }));
  });
  ui['download-qr'].addEventListener('click', () => {
    if (!sourceBytes) return;
    const token = sourceEpoch;
    const filename = cleanName(sourceName.replace(/\.[^.]*$/, ''), 'kod-qr') + '.png';
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
  selectMode('encode');
})();
