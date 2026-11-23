(function (root) {
  'use strict';

  const QUIET_ZONE = 4;
  const MAX_SIDE = 4096;
  const BLACK = new Uint32Array(new Uint8Array([0, 0, 0, 255]).buffer)[0];
  const surfaces = new WeakMap();

  function positive(value, fallback) {
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  function availableWidth(canvas) {
    const parent = canvas.parentElement;
    if (!parent || typeof parent.getBoundingClientRect !== 'function') return 0;
    const width = parent.getBoundingClientRect().width;
    if (!Number.isFinite(width) || width <= 0) return 0;
    if (typeof root.getComputedStyle !== 'function') return width;
    const style = root.getComputedStyle(parent);
    const inset = ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth']
      .reduce((sum, key) => sum + (Number.parseFloat(style[key]) || 0), 0);
    return Math.max(0, width - inset);
  }

  // Keep the bitmap on a uniform integer module grid, but let the preview fill
  // its field. Snapping the displayed size down to that grid can halve a dense
  // QR on a low-DPI screen. Render at least the display resolution, then fit it.
  // PNG exports can opt into the original integer-sized output explicitly.
  function drawQR(qr, canvas, options = {}) {
    if (!qr || !Number.isInteger(qr.size) || qr.size < 21 || qr.size > 177 ||
        !qr.data || qr.data.length < qr.size * qr.size || !canvas) {
      throw new TypeError('Nieprawidłowa siatka kodu QR.');
    }
    const modules = qr.size + QUIET_ZONE * 2;
    const pixelRatio = Math.min(8, positive(options.pixelRatio, positive(root.devicePixelRatio, 1)));
    const cssWidth = positive(options.cssWidth, availableWidth(canvas));
    const measured = cssWidth > 0;
    const target = Math.min(MAX_SIDE, measured ? cssWidth * pixelRatio : positive(options.maxSide, 960));
    const integerScale = options.integerScale === true || !measured;
    const scale = Math.max(1, Math.min(Math.floor(MAX_SIDE / modules),
      integerScale ? Math.floor(target / modules) : Math.ceil(target / modules)));
    const size = modules * scale;
    const cssSide = measured ? (integerScale ? size / pixelRatio : cssWidth) : null;

    if (canvas.width !== size) canvas.width = size;
    if (canvas.height !== size) canvas.height = size;
    if (canvas.style) {
      canvas.style.width = measured ? `${cssSide}px` : '100%';
      canvas.style.height = 'auto';
    }

    let surface = surfaces.get(canvas);
    if (!surface || surface.size !== size) {
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Nie można utworzyć obrazu QR.');
      const image = context.createImageData(size, size);
      surface = { size, context, image, pixels: new Uint32Array(image.data.buffer, image.data.byteOffset, image.data.byteLength / 4) };
      surfaces.set(canvas, surface);
    }
    const { context, image, pixels } = surface;
    pixels.fill(0xffffffff);
    for (let y = 0; y < qr.size; y += 1) {
      const row = (y + QUIET_ZONE) * scale * size;
      let x = 0;
      while (x < qr.size) {
        if (!qr.data[y * qr.size + x]) { x += 1; continue; }
        const start = x;
        while (x < qr.size && qr.data[y * qr.size + x]) x += 1;
        pixels.fill(BLACK, row + (start + QUIET_ZONE) * scale, row + (x + QUIET_ZONE) * scale);
      }
      // Reuse the completed row, including both white margins, for the module height.
      for (let dy = 1; dy < scale; dy += 1) pixels.copyWithin(row + dy * size, row, row + size);
    }
    context.putImageData(image, 0, 0);
    return { size, scale, cssSide, modules, measured, pixelRatio };
  }

  function clear(canvas) {
    const surface = surfaces.get(canvas);
    if (surface) surface.pixels.fill(0);
    surfaces.delete(canvas);
    canvas.width = canvas.height = 1;
  }

  root.WGRender = Object.freeze({ drawQR, clear });
})(typeof window === 'undefined' ? globalThis : window);
