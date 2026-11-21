import { build, version as esbuildVersion } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = resolve(root, '..');
const bundlePath = join(publicRoot, 'assets', 'qr-core.js');
const licensesPath = join(publicRoot, 'vendor-licenses.txt');

const libraries = [
  { name: 'qrcode', version: '1.5.4', license: 'license', url: 'https://github.com/soldair/node-qrcode' },
  { name: 'dijkstrajs', version: '1.0.3', license: 'LICENSE.md', url: 'https://github.com/tcort/dijkstrajs' },
  { name: 'jsqr', version: '1.4.0', license: 'LICENSE', url: 'https://github.com/cozmo/jsQR' }
];

const notices = [
  'Third-party software bundled in assets/qr-core.js',
  'All libraries run locally in the browser. No runtime CDN is used.',
  'Build tool: esbuild ' + esbuildVersion + ' (build-time only; not included in the browser bundle).',
  'The original dependency sources are unmodified; esbuild bundles and minifies them.',
  'qrcode contains code derived from QRCode for JavaScript:',
  'Copyright (c) 2009 Kazuhiko Arase; Copyright (c) 2011 Ryan Day. MIT License.',
  ''
];

for (const library of libraries) {
  const directory = join(root, 'node_modules', library.name);
  const packageInfo = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  if (packageInfo.version !== library.version) {
    throw new Error(`Unexpected ${library.name} version; run npm ci using the committed lockfile.`);
  }
  notices.push(
    `${library.name} ${library.version}`,
    library.url,
    await readFile(join(directory, library.license), 'utf8'),
    ''
  );
}

await mkdir(dirname(bundlePath), { recursive: true });
const result = await build({
  absWorkingDir: root,
  entryPoints: ['tools/qr-core-entry.js'],
  outfile: bundlePath,
  bundle: true,
  format: 'iife',
  globalName: 'WGQR',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  sourcemap: false,
  legalComments: 'eof',
  metafile: true,
  banner: {
    js: '/*! WGQR — local byte-preserving QR conversion. Bundles qrcode 1.5.4 (MIT), jsqr 1.4.0 (Apache-2.0), and dijkstrajs 1.0.3 (MIT). Full notices: ../vendor-licenses.txt */'
  }
});

for (const output of Object.values(result.metafile.outputs)) {
  if (output.imports.length > 0) {
    throw new Error('The browser bundle must not import any external runtime files.');
  }
}
await writeFile(licensesPath, notices.join('\n'), 'utf8');

const bundle = await readFile(bundlePath);
await writeFile(join(root, 'tools', 'qr-core-build-info.json'), JSON.stringify({
  esbuild: esbuildVersion,
  dependencies: Object.fromEntries(libraries.map(({ name, version }) => [name, version])),
  bundleBytes: bundle.byteLength,
  bundleSha256: createHash('sha256').update(bundle).digest('hex'),
  inputs: Object.keys(result.metafile.inputs).sort()
}, null, 2) + '\n');

console.log(`Built assets/qr-core.js (${bundle.byteLength} bytes); wrote vendor-licenses.txt.`);
