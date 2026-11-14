import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const script = new vm.Script(readFileSync(new URL('./theme-init.js', import.meta.url), 'utf8'));

function boot({ saved = null, systemDark = false, blockedStorage = false, brokenMedia = false, withMeta = true } = {}) {
  const root = { dataset: {}, style: {} };
  const meta = { 'theme-color': { content: '#0d6b5e' }, 'color-scheme': { content: 'light dark' } };
  const reads = [];
  let writes = 0;
  const window = {
    matchMedia(query) {
      assert.equal(query, '(prefers-color-scheme: dark)');
      if (brokenMedia) throw new Error('Unavailable');
      return { matches: systemDark };
    },
  };
  Object.defineProperty(window, 'localStorage', {
    get() {
      if (blockedStorage) throw new Error('Storage blocked');
      return {
        getItem(key) { reads.push(key); return saved; },
        setItem() { writes++; },
      };
    },
  });
  const document = {
    documentElement: root,
    querySelector(selector) {
      const name = /^meta\[name="([^"]+)"\]$/.exec(selector)?.[1];
      return withMeta ? meta[name] || null : null;
    },
  };
  // No body, module imports or DOM-ready callback: this runs during head parsing.
  script.runInNewContext({ window, document });
  return { root, meta, theme: window.RxCalcTheme, reads, writes: () => writes };
}

test('saved dark theme is applied before the body exists, even with a light system theme', () => {
  const page = boot({ saved: '"dark"' });
  assert.equal(page.theme.current, 'dark');
  assert.equal(page.root.style.colorScheme, 'dark');
  assert.equal(page.root.style.backgroundColor, 'var(--bg, #12201c)');
  assert.equal(page.meta['theme-color'].content, '#1a2a24');
  assert.equal(page.meta['color-scheme'].content, 'dark');
  assert.deepEqual(page.reads, ['rxcalc.theme']);
  assert.equal(page.writes(), 0);
});

test('saved light theme takes priority over the system dark theme', () => {
  const page = boot({ saved: '"light"', systemDark: true });
  assert.equal(page.theme.current, 'light');
  assert.equal(page.root.style.backgroundColor, 'var(--bg, #f6f8f7)');
  assert.equal(page.meta['theme-color'].content, '#ffffff');
  assert.equal(page.meta['color-scheme'].content, 'light');
});

test('missing, malformed or unsupported saved values use the system preference without persisting it', () => {
  for (const saved of [null, '{broken', '"sepia"', '{}', 'false']) {
    const page = boot({ saved, systemDark: true });
    assert.equal(page.theme.current, 'dark', `saved value: ${saved}`);
    assert.equal(page.writes(), 0);
  }
});

test('blocked storage does not interrupt initialization', () => {
  assert.equal(boot({ blockedStorage: true, systemDark: true }).theme.current, 'dark');
  assert.equal(boot({ blockedStorage: true, systemDark: false }).theme.current, 'light');
});

test('missing system preference support falls back to light and does not override a saved theme', () => {
  assert.equal(boot({ brokenMedia: true }).theme.current, 'light');
  assert.equal(boot({ brokenMedia: true, saved: '"dark"' }).theme.current, 'dark');
});

test('the app can change document and browser colors together without this helper writing preferences', () => {
  const page = boot({ saved: '"dark"' });
  assert.equal(page.theme.apply('light'), 'light');
  assert.equal(page.theme.current, 'light');
  assert.equal(page.root.style.colorScheme, 'light');
  assert.equal(page.meta['theme-color'].content, '#ffffff');
  assert.equal(page.meta['color-scheme'].content, 'light');
  assert.equal(page.theme.apply('dark'), 'dark');
  assert.equal(page.meta['theme-color'].content, '#1a2a24');
  assert.equal(page.writes(), 0);
  assert.equal(boot({ withMeta: false }).theme.apply('dark'), 'dark');
});
