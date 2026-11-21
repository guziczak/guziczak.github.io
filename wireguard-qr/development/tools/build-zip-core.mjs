import { build, version as esbuildVersion } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeVendorLicenses } from './write-vendor-licenses.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = resolve(root, '..');
const bundlePath = join(publicRoot, 'assets', 'zip-core.js');
const installed = JSON.parse(await readFile(join(root, 'node_modules/fflate/package.json'), 'utf8'));
if (installed.version !== '0.8.2') throw new Error('Unexpected fflate version; run npm ci.');
await mkdir(dirname(bundlePath), { recursive: true });
const result = await build({
  absWorkingDir: root,
  entryPoints: ['tools/zip-core-entry.js'],
  outfile: bundlePath,
  bundle: true,
  format: 'iife',
  globalName: 'WGZip',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  sourcemap: false,
  legalComments: 'eof',
  metafile: true,
  banner: {
    js: '/*! WGZip — browser-local ZIP creation. Bundles fflate 0.8.2 (MIT), Copyright (c) 2023 Arjun Barrett. Full notices: ../vendor-licenses.txt */'
  }
});
for (const output of Object.values(result.metafile.outputs)) {
  if (output.imports.length > 0) throw new Error('The ZIP bundle must have no external runtime imports.');
}
const bundle = await readFile(bundlePath);
if (/\b(?:fetch|importScripts)\s*\(|\b(?:XMLHttpRequest|WebSocket|Worker|SharedWorker)\b|\bnew\s+Function\b/.test(bundle.toString('utf8'))) {
  throw new Error('The ZIP bundle must not include network, worker, or dynamic-code APIs.');
}
await writeVendorLicenses(root, join(publicRoot, 'vendor-licenses.txt'), esbuildVersion);
await writeFile(join(root, 'tools', 'zip-core-build-info.json'), JSON.stringify({
  esbuild: esbuildVersion,
  dependencies: { fflate: installed.version },
  bundleBytes: bundle.byteLength,
  bundleSha256: createHash('sha256').update(bundle).digest('hex'),
  inputs: Object.keys(result.metafile.inputs).sort()
}, null, 2) + '\n');
console.log(`Built assets/zip-core.js (${bundle.byteLength} bytes); wrote combined vendor-licenses.txt.`);
