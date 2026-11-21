import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

// Nothing except Vite's entry point and fingerprinted runtime assets belongs in Pages.
const dist = new URL('../dist/', import.meta.url);
const root = await readdir(dist, { withFileTypes: true });
assert.deepEqual(root.filter((entry) => entry.isDirectory()).map((entry) => entry.name), ['assets']);
assert.deepEqual(root.filter((entry) => !entry.isDirectory()).map((entry) => entry.name), ['index.html']);
const index = root.find((entry) => entry.name === 'index.html');
assert.ok(index.isFile(), 'Expected a regular index.html file');

const assets = await readdir(new URL('assets/', dist), { withFileTypes: true });
for (const asset of assets) {
  assert.ok(asset.isFile() && /^[\w-]+-[\w-]+\.(js|css)$/.test(asset.name), `Unexpected Pages artifact: ${asset.name}`);
  const content = await readFile(new URL(`assets/${asset.name}`, dist), 'utf8');
  assert.doesNotMatch(content, /[#@]\s*sourceMappingURL\s*=/, `Source map reference in ${asset.name}`);
}

const html = await readFile(new URL('index.html', dist), 'utf8');
assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
for (const pattern of [/<script\b[^>]*\bsrc="([^"]+)"/, /<link\b[^>]*\bhref="([^"]+)"/]) {
  const assetURL = html.match(pattern)?.[1];
  assert.ok(assets.some(({ name }) => assetURL === `/rulecraft/assets/${name}`), `Invalid Pages entry asset: ${assetURL}`);
}
assert.ok(assets.some(({ name }) => /^save-worker-.*\.js$/.test(name)), 'Expected a bundled save worker');
console.log(`Verified Pages artifact: index.html and ${assets.length} fingerprinted runtime assets.`);
