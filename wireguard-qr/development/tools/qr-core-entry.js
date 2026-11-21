import QRCode from 'qrcode/lib/core/qrcode.js';
import jsQR from 'jsqr';

const MEDIUM_BYTE_LIMIT = 2331;
const LOW_BYTE_LIMIT = 2953;

function error(code, message) {
  const result = new Error(message);
  result.name = 'QRCoreError';
  result.code = code;
  return result;
}

function isTypedArray(value, name) {
  return ArrayBuffer.isView(value)
    && Object.prototype.toString.call(value) === `[object ${name}]`;
}

/**
 * Encode the original file bytes without text conversion or normalization.
 * Returns a row-major, unpadded QR matrix: data[y * size + x], 1 = black.
 * The caller must add a four-module white quiet zone when rendering it.
 */
export function encodeBytes(bytes) {
  if (!isTypedArray(bytes, 'Uint8Array')) {
    throw error('INVALID_INPUT', 'Oczekiwano tablicy bajtów Uint8Array.');
  }
  if (bytes.byteLength === 0) {
    throw error('EMPTY_INPUT', 'Plik jest pusty. Wybierz konfigurację zawierającą dane.');
  }
  if (bytes.byteLength > LOW_BYTE_LIMIT) {
    throw error(
      'INPUT_TOO_LARGE',
      'Plik jest za duży na jeden kod QR. Maksymalny rozmiar to 2953 bajty.'
    );
  }

  const level = bytes.byteLength <= MEDIUM_BYTE_LIMIT ? 'M' : 'L';
  const qr = QRCode.create([{ data: bytes, mode: 'byte' }], {
    errorCorrectionLevel: level
  });

  return {
    size: qr.modules.size,
    data: new Uint8Array(qr.modules.data),
    level,
    version: qr.version
  };
}

/**
 * Decode RGBA pixels. Use decoded bytes, never the decoder's text field:
 * its Unicode conversion can discard invalid UTF-8 or change file bytes.
 */
export function decodePixels(pixels, width, height, options = {}) {
  if (!isTypedArray(pixels, 'Uint8ClampedArray')
    || !Number.isSafeInteger(width)
    || !Number.isSafeInteger(height)
    || width <= 0
    || height <= 0
    || !Number.isSafeInteger(width * height * 4)
    || pixels.length !== width * height * 4) {
    throw error('INVALID_IMAGE', 'Nieprawidłowe dane obrazu RGBA lub jego wymiary.');
  }

  const inversionAttempts = options && options.inversionAttempts !== undefined
    ? options.inversionAttempts : 'attemptBoth';
  if (inversionAttempts !== 'attemptBoth' && inversionAttempts !== 'dontInvert') {
    throw error('INVALID_OPTIONS', 'Nieprawidłowy tryb odczytu kolorów kodu QR.');
  }
  const decoded = jsQR(pixels, width, height, { inversionAttempts });
  if (!decoded) return null;

  return {
    bytes: Uint8Array.from(decoded.binaryData),
    location: decoded.location,
    version: decoded.version
  };
}
