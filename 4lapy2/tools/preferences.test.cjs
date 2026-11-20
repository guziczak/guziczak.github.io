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
  const motionEvents = new Map();
  const headElements = [];
  const listen = (events, name, fn) => {
    if (!events.has(name)) events.set(name, []);
    events.get(name).push(fn);
  };
  const emit = (events, name, event = {}) => { for (const fn of events.get(name) || []) fn(event); };
  const root = { lang: language, dataset: {}, style: {} };
  let ready = false;
  const element = (dataset = {}) => ({
    dataset, attributes: {}, events: new Map(), hidden: true,
    setAttribute(name, value) { this.attributes[name] = value; },
    get href() { return new URL(this.attributes.href, current).href; },
    target: '', hasAttribute(name) { return Object.hasOwn(this.attributes, name); },
    addEventListener(name, fn) { this.events.set(name, fn); },
    remove() { const index = headElements.indexOf(this); if (index >= 0) headElements.splice(index, 1); }
  });
  const button = element();
  const link = element({ languageSwitch: language === 'pl' ? 'en' : 'pl' });
  const themeMeta = element();
  const media = { matches: !!options.osDark, addEventListener(name, fn) { mediaEvents.set(name, fn); } };
  const motion = { matches: !!options.reducedMotion };
  if (options.legacyMotion) motion.addListener = fn => motionEvents.set('change', fn);
  else motion.addEventListener = (name, fn) => motionEvents.set(name, fn);
  const document = {
    documentElement: root,
    readyState: 'loading',
    referrer: options.referrer || '',
    head: { appendChild(node) { headElements.push(node); return node; } },
    createElement() { return element(); },
    currentScript: { src: options.scriptUrl || 'https://example.test/projects/4lapy2/preferences.js?v=1' },
    querySelector(selector) { return selector === 'meta[name="theme-color"]' ? themeMeta : null; },
    querySelectorAll(selector) {
      if (!ready) return [];
      if (selector === '[data-theme-toggle]') return [button];
      if (selector === '[data-language-switch]') return [link];
      return [];
    },
    addEventListener(name, fn) { listen(documentEvents, name, fn); }
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
    performance: { getEntriesByType: () => [{ type: options.navigationType || 'navigate' }] },
    navigation: options.activation ? { activation: options.activation } : undefined,
    matchMedia(query) { return query.includes('reduced-motion') ? motion : media; },
    addEventListener(name, fn) { listen(windowEvents, name, fn); }
  };
  if (options.transitions) { window.onpageswap = null; window.onpagereveal = null; }
  vm.runInNewContext(script, { window, document, URL });
  return {
    root, storage, redirects, button, link, themeMeta, headElements,
    get url() { return current; },
    ready() { ready = true; document.readyState = 'interactive'; emit(documentEvents, 'DOMContentLoaded'); },
    systemTheme(dark) { media.matches = dark; mediaEvents.get('change')?.({ matches: dark }); },
    clickTheme() { button.events.get('click')(); },
    hash(value) { current.hash = value; emit(windowEvents, 'hashchange'); },
    replaceFragment(value) { current.hash = value; emit(windowEvents, 'site:fragmentchange'); },
    otherTabTheme(value) { emit(windowEvents, 'storage', { key: '4lapy2-theme', newValue: value }); },
    event(name, values) { emit(windowEvents, name, values); },
    motion(reduced) { motion.matches = reduced; motionEvents.get('change')?.({ matches: reduced }); },
    extraLink({ href, language: linkLanguage = 'en', target = '', download = false } = {}) {
      const extra = element({ languageSwitch: linkLanguage });
      extra.setAttribute('href', href || link.attributes.href);
      extra.target = target;
      if (download) extra.setAttribute('download', '');
      return extra;
    },
    clickLanguage(overrides = {}, anchor = link) {
      const event = {
        button: 0, detail: 1, isTrusted: true, defaultPrevented: false,
        metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
        target: { closest: () => anchor },
        preventDefault() { assert.fail('Language navigation must remain native'); },
        ...overrides
      };
      if (anchor === link) link.events.get('click')?.(event);
      emit(documentEvents, 'click', event);
      return event;
    }
  };
}

function transition() {
  let resolve, reject;
  const finished = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {
    ready: Promise.resolve(), finished, resolve, reject, skipped: 0,
    skipTransition() { this.skipped++; }
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

function incoming(options = {}) {
  return visit({
    transitions: true, language: 'en',
    url: 'https://example.test/projects/4lapy2/en/?lang=en#przypomnienie',
    referrer: 'https://example.test/projects/4lapy2/', ...options
  });
}

test('ordinary pointer and keyboard language links opt in without replacing native navigation', async () => {
  for (const detail of [1, 0]) {
    const page = visit({ transitions: true, url: 'https://example.test/projects/4lapy2/#przypomnienie' });
    page.ready();
    const href = page.link.attributes.href;
    const click = page.clickLanguage({ detail });
    assert.equal(page.root.dataset.languageTransition, undefined, 'No outgoing animation before native pageswap');
    const vt = transition();
    page.event('pageswap', { viewTransition: vt, activation: { navigationType: 'push', entry: { url: href } } });
    assert.equal(page.root.dataset.languageTransition, 'outgoing');
    assert.equal(vt.skipped, 0);
    assert.equal(click.defaultPrevented, false);
    assert.equal(page.link.attributes.href, href);
    assert.equal(page.url.hash, '#przypomnienie');
    assert.deepEqual(page.redirects, []);
    assert.deepEqual([...page.storage.keys()], ['4lapy2-language']);
    vt.resolve();
    await Promise.resolve();
    assert.equal(page.root.dataset.languageTransition, undefined);
  }
});

test('Safari without activation data can use the verified language click', () => {
  const page = visit({ transitions: true });
  page.ready();
  page.clickLanguage();
  const vt = transition();
  page.event('pageswap', { viewTransition: vt });
  assert.equal(page.root.dataset.languageTransition, 'outgoing');
  assert.equal(vt.skipped, 0);
  page.event('pagehide');
  assert.equal(page.root.dataset.languageTransition, undefined);
});

test('prevented, modified, synthetic and non-language clicks do not arm an outgoing transition', () => {
  for (const overrides of [
    { defaultPrevented: true }, { ctrlKey: true }, { metaKey: true },
    { altKey: true }, { shiftKey: true }, { button: 1 }, { button: 2 },
    { isTrusted: false }, { target: { closest: () => null } }
  ]) {
    const page = visit({ transitions: true });
    page.ready();
    page.clickLanguage();
    page.clickLanguage(overrides);
    const vt = transition();
    page.event('pageswap', { viewTransition: vt });
    assert.equal(vt.skipped, 1, JSON.stringify(overrides));
    assert.equal(page.root.dataset.languageTransition, undefined);
  }
  for (const values of [
    { download: true }, { target: '_blank' }, { target: 'other-window' },
    { href: 'https://elsewhere.test/en/?lang=en' },
    { href: 'https://example.test/another/en/?lang=en' },
    { href: 'https://example.test/projects/4lapy2/en/' },
    { href: 'https://example.test/projects/4lapy2/?lang=pl', language: 'pl' }
  ]) {
    const page = visit({ transitions: true });
    page.ready();
    page.clickLanguage({}, page.extraLink(values));
    const vt = transition();
    page.event('pageswap', { viewTransition: vt });
    assert.equal(vt.skipped, 1, JSON.stringify(values));
  }
});

test('pageswap rejects other destinations, reloads and history traversal even after an earlier click', () => {
  for (const activation of [
    { navigationType: 'reload' }, { navigationType: 'traverse' },
    { navigationType: 'push', entry: { url: 'https://example.test/projects/4lapy2/en/?lang=en#kontakt' } }
  ]) {
    const page = visit({ transitions: true });
    page.ready();
    page.clickLanguage();
    const vt = transition();
    page.event('pageswap', { viewTransition: vt, activation });
    assert.equal(vt.skipped, 1);
    assert.equal(page.root.dataset.languageTransition, undefined);
  }
  const unarmed = visit({ transitions: true });
  const vt = transition();
  unarmed.event('pageswap', { viewTransition: vt });
  assert.equal(vt.skipped, 1);
});

test('explicit incoming language is recognized before query cleanup and marked at pagereveal', async () => {
  const page = incoming();
  assert.equal(page.url.search, '');
  assert.equal(page.url.hash, '#przypomnienie');
  assert.equal(page.headElements.length, 1);
  assert.deepEqual(page.headElements[0].attributes, { rel: 'expect', blocking: 'render', href: '#page-ready' });
  assert.equal(page.root.dataset.languageTransition, undefined);
  const vt = transition();
  page.event('pagereveal', { viewTransition: vt });
  assert.equal(page.root.dataset.languageTransition, 'incoming');
  assert.equal(page.headElements.length, 0);
  assert.equal(vt.skipped, 0);
  page.event('pageshow', { persisted: false });
  assert.equal(page.root.dataset.languageTransition, 'incoming', 'First pageshow does not interrupt the animation');
  vt.resolve();
  await Promise.resolve();
  assert.equal(page.root.dataset.languageTransition, undefined);
});

test('activation can identify the incoming pair without a referrer, including the reverse language', () => {
  const page = incoming({
    language: 'pl', referrer: '', url: 'https://example.test/projects/4lapy2/?lang=pl#kontakt',
    activation: {
      navigationType: 'push', from: { url: 'https://example.test/projects/4lapy2/en/' },
      entry: { url: 'https://example.test/projects/4lapy2/?lang=pl#kontakt' }
    }
  });
  assert.equal(page.headElements.length, 1);
  page.ready();
  assert.equal(page.headElements.length, 0, 'Parsed content removes the temporary render expectation');
  const vt = transition();
  page.event('pagereveal', { viewTransition: vt });
  assert.equal(page.root.dataset.languageTransition, 'incoming');
  assert.equal(vt.skipped, 0);
});

test('ordinary direct entries, reloads, history and unrelated referrers never animate or render-block', () => {
  for (const options of [
    { referrer: '' },
    { url: 'https://example.test/projects/4lapy2/en/#przypomnienie' },
    { referrer: 'https://elsewhere.test/projects/4lapy2/' },
    { referrer: 'https://example.test/another/' },
    { referrer: 'https://example.test/projects/4lapy2/en/' },
    { navigationType: 'reload' }, { navigationType: 'back_forward' },
    { activation: { navigationType: 'traverse', from: { url: 'https://example.test/projects/4lapy2/' } } }
  ]) {
    const page = incoming(options);
    assert.equal(page.headElements.length, 0, JSON.stringify(options));
    const vt = transition();
    page.event('pagereveal', { viewTransition: vt });
    assert.equal(vt.skipped, 1);
    assert.equal(page.root.dataset.languageTransition, undefined);
  }
  const unsupported = incoming({ transitions: false });
  assert.equal(unsupported.headElements.length, 0);
  unsupported.ready();
  assert.match(unsupported.link.attributes.href, /\?lang=pl#przypomnienie$/);
});

test('pagehide, BFCache and rejected promises clean temporary flags without affecting the URL', async () => {
  for (const event of ['pagehide', 'pageshow']) {
    const page = incoming();
    page.event(event, { persisted: true });
    assert.equal(page.headElements.length, 0);
    const vt = transition();
    page.event('pagereveal', { viewTransition: vt });
    assert.equal(vt.skipped, 1);
    assert.equal(page.root.dataset.languageTransition, undefined);
    assert.equal(page.url.hash, '#przypomnienie');
  }
  const page = incoming();
  const vt = transition();
  vt.ready = Promise.reject(new Error('Transition skipped'));
  page.event('pagereveal', { viewTransition: vt });
  vt.reject(new Error('Navigation interrupted'));
  await Promise.resolve();
  assert.equal(page.root.dataset.languageTransition, undefined);
  assert.equal(page.headElements.length, 0);
});

test('reduced motion skips incoming and outgoing transitions and cancels an active one', () => {
  const reduced = incoming({ reducedMotion: true });
  assert.equal(reduced.headElements.length, 0);
  reduced.ready();
  reduced.clickLanguage();
  for (const event of ['pagereveal', 'pageswap']) {
    const vt = transition();
    reduced.event(event, { viewTransition: vt });
    assert.equal(vt.skipped, 1);
  }
  for (const legacyMotion of [false, true]) {
    const page = incoming({ legacyMotion });
    const vt = transition();
    page.event('pagereveal', { viewTransition: vt });
    page.motion(true);
    assert.equal(vt.skipped, 1);
    assert.equal(page.root.dataset.languageTransition, undefined);
    assert.equal(page.headElements.length, 0);
  }
});
