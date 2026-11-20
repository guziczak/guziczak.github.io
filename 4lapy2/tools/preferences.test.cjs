'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const script = fs.readFileSync(path.join(__dirname, '../preferences.js'), 'utf8');

function visit(options = {}) {
  let current = new URL(options.url || 'https://example.test/projects/4lapy2/');
  const language = options.language || 'pl';
  const storage = new Map(Object.entries(options.stored || {}));
  const redirects = [];
  const windowEvents = new Map();
  const documentEvents = new Map();
  const mediaEvents = new Map();
  const root = { lang: language, dataset: {}, style: {} };
  let ready = false;
  const element = (dataset = {}) => ({
    dataset, attributes: {}, events: new Map(), hidden: true,
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, fn) { this.events.set(name, fn); }
  });
  const button = element();
  const link = element({ languageSwitch: language === 'pl' ? 'en' : 'pl' });
  const themeMeta = element();
  const media = { matches: !!options.osDark, addEventListener(name, fn) { mediaEvents.set(name, fn); } };
  const document = {
    documentElement: root,
    readyState: 'loading',
    currentScript: { src: options.scriptUrl || 'https://example.test/projects/4lapy2/preferences.js?v=1' },
    querySelector(selector) { return selector === 'meta[name="theme-color"]' ? themeMeta : null; },
    querySelectorAll(selector) {
      if (!ready) return [];
      if (selector === '[data-theme-toggle]') return [button];
      if (selector === '[data-language-switch]') return [link];
      return [];
    },
    addEventListener(name, fn) { documentEvents.set(name, fn); }
  };
  const window = {
    location: {
      get href() { return current.href; },
      get search() { return current.search; },
      get hash() { return current.hash; },
      replace(value) { redirects.push(value); }
    },
    history: { state: null, replaceState(state, _, value) { current = new URL(value); } },
    get localStorage() {
      if (options.blockedStorage) throw new Error('Storage is unavailable');
      return { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
    },
    matchMedia() { return media; },
    addEventListener(name, fn) { windowEvents.set(name, fn); }
  };
  vm.runInNewContext(script, { window, document, URL });
  return {
    root, storage, redirects, button, link, themeMeta,
    get url() { return current; },
    ready() { ready = true; documentEvents.get('DOMContentLoaded')?.(); },
    systemTheme(dark) { media.matches = dark; mediaEvents.get('change')?.({ matches: dark }); },
    clickTheme() { button.events.get('click')(); },
    hash(value) { current.hash = value; windowEvents.get('hashchange')?.(); },
    replaceFragment(value) { current.hash = value; windowEvents.get('site:fragmentchange')?.(); },
    otherTabTheme(value) { windowEvents.get('storage')?.({ key: '4lapy2-theme', newValue: value }); }
  };
}

test('saved theme wins before controls are available', () => {
  const page = visit({ osDark: true, stored: { '4lapy2-theme': 'light' } });
  assert.equal(page.root.dataset.theme, 'light');
  assert.equal(page.root.style.colorScheme, 'light');
  assert.equal(page.themeMeta.attributes.content, '#f8f9f4');
  page.ready();
  assert.equal(page.button.hidden, false);
  assert.equal(page.button.attributes['aria-label'], 'Włącz ciemny motyw');
  page.systemTheme(true);
  assert.equal(page.root.dataset.theme, 'light');
});

test('system changes apply until the user chooses a theme', () => {
  const page = visit();
  page.systemTheme(true);
  assert.equal(page.root.dataset.theme, 'dark');
  page.ready();
  page.clickTheme();
  assert.equal(page.storage.get('4lapy2-theme'), 'light');
  page.systemTheme(true);
  assert.equal(page.root.dataset.theme, 'light');
});

test('explicit language choice wins over saved language and keeps other URL parts', () => {
  const page = visit({
    url: 'https://example.test/projects/4lapy2/?ref=local&lang=pl#przypomnienie',
    stored: { '4lapy2-language': 'en' }
  });
  assert.equal(page.redirects.length, 0);
  assert.equal(page.storage.get('4lapy2-language'), 'pl');
  assert.equal(page.url.href, 'https://example.test/projects/4lapy2/?ref=local#przypomnienie');
  page.ready();
  assert.equal(page.link.attributes.href, 'https://example.test/projects/4lapy2/en/?ref=local&lang=en#przypomnienie');
});

test('saved English routes the Polish entry into its matching subfolder with the hash', () => {
  const page = visit({
    url: 'https://example.test/projects/4lapy2/index.html#kontakt',
    stored: { '4lapy2-language': 'en' }
  });
  assert.deepEqual(page.redirects, ['https://example.test/projects/4lapy2/en/#kontakt']);
});

test('a direct English URL does not redirect back to a previously selected Polish page', () => {
  const page = visit({
    language: 'en', url: 'https://example.test/projects/4lapy2/en/',
    stored: { '4lapy2-language': 'pl' }, osDark: true
  });
  assert.equal(page.redirects.length, 0);
  assert.equal(page.storage.get('4lapy2-language'), 'en');
  page.ready();
  assert.equal(page.button.attributes['aria-label'], 'Switch to light mode');
  page.hash('#o-nas');
  assert.equal(page.link.attributes.href, 'https://example.test/projects/4lapy2/?lang=pl#o-nas');
});

test('a language query on the other route redirects once without losing its explicit choice', () => {
  const page = visit({ language: 'en', url: 'https://example.test/projects/4lapy2/en/?lang=pl#opieka' });
  assert.deepEqual(page.redirects, ['https://example.test/projects/4lapy2/?lang=pl#opieka']);
  const destination = visit({ url: page.redirects[0], stored: { '4lapy2-language': 'en' } });
  assert.equal(destination.redirects.length, 0);
  assert.equal(destination.url.href, 'https://example.test/projects/4lapy2/#opieka');
});

test('blocked storage still permits the theme switch and direct language links', () => {
  const page = visit({ blockedStorage: true, osDark: true });
  page.ready();
  page.clickTheme();
  assert.equal(page.root.dataset.theme, 'light');
  page.systemTheme(true);
  assert.equal(page.root.dataset.theme, 'light');
  assert.equal(page.link.attributes.href, 'https://example.test/projects/4lapy2/en/?lang=en');
  page.link.events.get('click')();
});

test('manual return to the top updates the language link after the stale fragment is replaced', () => {
  for (const language of ['pl', 'en']) {
    const path = language === 'en' ? 'en/' : '';
    const page = visit({ language, url: `https://example.test/projects/4lapy2/${path}?ref=local#przypomnienie` });
    page.ready();
    assert.match(page.link.attributes.href, /#przypomnienie$/);
    page.replaceFragment('');
    const target = new URL(page.link.attributes.href);
    assert.equal(target.hash, '');
    assert.equal(target.searchParams.get('ref'), 'local');
    assert.equal(target.searchParams.get('lang'), language === 'en' ? 'pl' : 'en');
    assert.equal(page.redirects.length, 0);
  }
});

test('cross-tab theme preference updates, and clearing it resumes the system theme', () => {
  const page = visit({ osDark: true });
  page.ready();
  page.otherTabTheme('light');
  assert.equal(page.root.dataset.theme, 'light');
  page.otherTabTheme(null);
  assert.equal(page.root.dataset.theme, 'dark');
});
