import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createContext, runInContext } from 'node:vm';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const fixtureRoot = new URL('./fixtures/', import.meta.url);
const bundle = await readFile(new URL('../../assets/qr-core.js', import.meta.url), 'utf8');
const browser = createContext({ TextEncoder }, { codeGeneration: { strings: false, wasm: false } });
runInContext(bundle, browser, { timeout: 3000 });
const { encodeBytes, decodePixels } = browser.WGQR;
const utf8 = value => new TextEncoder().encode(value);

// Synthetic keys and a documentation-only endpoint: these are not a working VPN.
const base = [
  '# Synthetic fixture only; not a working VPN configuration.',
  '[Interface]',
  'PrivateKey = AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  'Address = 10.8.0.2/32',
  'DNS = 1.1.1.1',
  '',
  '[Peer]',
  'PublicKey = AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
  'Endpoint = 198.51.100.20:51820',
  'AllowedIPs = 0.0.0.0/0, ::/0',
  'PersistentKeepalive = 25',
  ''
].join('\n');

function makePng(bytes, inverted = false) {
  const qr = encodeBytes(bytes);
  const scale = 4;
  const margin = 4;
  const side = (qr.size + margin * 2) * scale;
  const png = new PNG({ width: side, height: side });
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const qx = Math.floor(x / scale) - margin;
      const qy = Math.floor(y / scale) - margin;
      const dark = qx >= 0 && qy >= 0 && qx < qr.size && qy < qr.size
        && Boolean(qr.data[qy * qr.size + qx]);
      const value = (inverted ? !dark : dark) ? 0 : 255;
      const offset = (y * side + x) * 4;
      png.data[offset] = value;
      png.data[offset + 1] = value;
      png.data[offset + 2] = value;
      png.data[offset + 3] = 255;
    }
  }
  const encoded = PNG.sync.write(png);
  const reopened = PNG.sync.read(encoded);
  const recovered = decodePixels(new Uint8ClampedArray(reopened.data), reopened.width, reopened.height);
  assert.ok(recovered);
  assert.deepEqual(Buffer.from(recovered.bytes), Buffer.from(bytes));
  return encoded;
}

await mkdir(fixtureRoot, { recursive: true });
const fixtures = [
  ['basic', utf8(base)],
  ['bom-crlf', Uint8Array.from([0xef, 0xbb, 0xbf, ...utf8(base.replaceAll('\n', '\r\n'))])],
  ['polish-emoji', utf8('# Zażółć gęślą jaźń — dom 🔑🏠\n' + base)],
  ['trailing-spaces', utf8(base.replaceAll('\n', '  \n') + '\n   ')],
  ['inverted', utf8(base), true]
];

for (const [name, bytes, inverted] of fixtures) {
  await writeFile(new URL(name + '.conf', fixtureRoot), bytes);
  await writeFile(new URL(name + '.png', fixtureRoot), makePng(bytes, inverted));
}

const blank = new PNG({ width: 256, height: 256 });
blank.data.fill(255);
await writeFile(new URL('no-qr.png', fixtureRoot), PNG.sync.write(blank));
await writeFile(new URL('empty.conf', fixtureRoot), new Uint8Array());
await writeFile(new URL('too-large.conf', fixtureRoot), utf8(base + '# ' + 'x'.repeat(2954 - utf8(base).length - 2)));
await writeFile(new URL('README.txt', fixtureRoot), [
  'Synthetic test fixtures for the browser UI. No real credentials are included.',
  'Each PNG contains the exact bytes of its matching .conf file.',
  'basic: ordinary configuration, LF line endings.',
  'bom-crlf: UTF-8 BOM followed by CRLF line endings.',
  'polish-emoji: UTF-8 comments with Polish diacritics and emoji.',
  'trailing-spaces: spaces and blank lines that must remain unchanged.',
  'inverted: white modules on black; decode should still work.',
  'no-qr.png: blank white image; decoding must report no QR.',
  'empty.conf: must report an empty-file error.',
  'too-large.conf: exactly 2954 bytes; must report QR capacity exceeded.',
  '',
  'Regenerate with: npm run fixtures',
  ''
].join('\n'));
console.log(`Generated ${fixtures.length} paired .conf/PNG fixtures and three error fixtures under tools/fixtures/.`);
