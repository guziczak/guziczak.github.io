import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const libraries = [
  { name: 'qrcode', version: '1.5.4', license: 'license', url: 'https://github.com/soldair/node-qrcode', bundle: 'assets/qr-core.js' },
  { name: 'dijkstrajs', version: '1.0.3', license: 'LICENSE.md', url: 'https://github.com/tcort/dijkstrajs', bundle: 'assets/qr-core.js' },
  { name: 'jsqr', version: '1.4.0', license: 'LICENSE', url: 'https://github.com/cozmo/jsQR', bundle: 'assets/qr-core.js' },
  { name: 'fflate', version: '0.8.2', license: 'LICENSE', url: 'https://github.com/101arrowz/fflate', bundle: 'assets/zip-core.js' }
];

export async function writeVendorLicenses(root, destination, esbuildVersion) {
  const notices = [
    'Third-party software bundled in assets/qr-core.js and assets/zip-core.js',
    'All libraries run locally in the browser. No runtime CDN is used.',
    `Build tool: esbuild ${esbuildVersion} (build-time only; not included in the browser bundles).`,
    'The original dependency sources are unmodified; esbuild bundles and minifies them.',
    'qrcode contains code derived from QRCode for JavaScript:',
    'Copyright (c) 2009 Kazuhiko Arase; Copyright (c) 2011 Ryan Day. MIT License.',
    ''
  ];
  for (const library of libraries) {
    const directory = join(root, 'node_modules', library.name);
    const installed = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
    if (installed.version !== library.version) throw new Error(`Unexpected ${library.name} version; run npm ci.`);
    notices.push(
      `${library.name} ${library.version} — ${library.bundle}`,
      library.url,
      await readFile(join(directory, library.license), 'utf8'),
      ''
    );
  }
  await writeFile(destination, notices.join('\n'), 'utf8');
}
