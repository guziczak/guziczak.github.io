'use strict';

// Run with: node --test 4lapy2/tools/navigation.test.cjs
// Exercise the production policy without simulating browser layout or scrolling.
const test = require('node:test');
const assert = require('node:assert/strict');
const { initializeAnchorNavigation } = require('../site.js');

function eventHost() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    emit(type, event = {}) {
      for (const listener of listeners.get(type) || []) listener(event);
    }
  };
}

function setup({ href = 'https://guziczak.github.io/4lapy2/', reduced = false, legacyMedia = false } = {}) {
  const nativeOnly = () => assert.fail('Fragment navigation must remain native');
  const destination = { focus: nativeOnly, scrollIntoView: nativeOnly };
  const ids = new Map(['przypomnienie', 'kontakt', 'Łapy'].map(id => [id, destination]));
  const doc = {
    ...eventHost(),
    documentElement: { style: { scrollBehavior: 'smooth' } },
    getElementById: id => ids.get(id) || null
  };
  const page = {
    ...eventHost(), location: { href },
    history: { pushState: nativeOnly, replaceState: nativeOnly },
    scroll: nativeOnly, scrollTo: nativeOnly, scrollBy: nativeOnly
  };
  const mediaEvents = eventHost();
  const media = { matches: reduced };
  if (legacyMedia) media.addListener = listener => mediaEvents.addEventListener('change', listener);
  else media.addEventListener = mediaEvents.addEventListener;

  initializeAnchorNavigation(doc, page, media);

  return {
    doc, page, media,
    behavior: () => doc.documentElement.style.scrollBehavior,
    click(hrefValue = '#przypomnienie', eventValues = {}, linkValues = {}) {
      const link = hrefValue === null ? null : {
        href: new URL(hrefValue, page.location.href).href,
        target: '', hasAttribute: () => false, ...linkValues
      };
      const event = {
        button: 0, detail: 1, defaultPrevented: false,
        metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
        target: { closest: () => link }, preventDefault: nativeOnly, ...eventValues
      };
      doc.emit('click', event);
      assert.equal(page.location.href, href, 'The policy must not navigate manually');
      return event;
    },
    setReduced(matches) {
      media.matches = matches;
      mediaEvents.emit('change', { matches });
    }
  };
}

test('direct PL and EN fragment arrivals start instant without navigating or changing history', () => {
  for (const href of [
    'https://guziczak.github.io/4lapy2/',
    'https://guziczak.github.io/4lapy2/#przypomnienie',
    'https://guziczak.github.io/4lapy2/en/?lang=en#przypomnienie',
    'https://guziczak.github.io/4lapy2/en/#kontakt'
  ]) assert.equal(setup({ href }).behavior(), 'auto', href);
});

test('native pointer and keyboard anchor activation opt into smooth scrolling', () => {
  for (const detail of [1, 0]) {
    const app = setup();
    const event = app.click('#przypomnienie', { detail }, { target: '_self' });
    assert.equal(app.behavior(), 'smooth');
    assert.equal(event.defaultPrevented, false);
  }
  const app = setup({ href: 'https://guziczak.github.io/4lapy2/en/?preview=1' });
  app.click('#%C5%81apy');
  assert.equal(app.behavior(), 'smooth', 'An existing percent-encoded fragment is decoded');
});

test('language links and all other document changes stay instant after an earlier anchor click', () => {
  const cases = [
    ['https://guziczak.github.io/4lapy2/', 'en/?lang=en#przypomnienie'],
    ['https://guziczak.github.io/4lapy2/en/', '../?lang=pl#przypomnienie'],
    ['https://guziczak.github.io/4lapy2/', '?lang=pl#przypomnienie'],
    ['https://guziczak.github.io/4lapy2/', '/4lapy/#przypomnienie'],
    ['https://guziczak.github.io/4lapy2/', 'https://example.org/4lapy2/#przypomnienie'],
    ['https://guziczak.github.io/4lapy2/', '?preview=1#przypomnienie']
  ];
  for (const [href, target] of cases) {
    const app = setup({ href });
    app.click();
    assert.equal(app.behavior(), 'smooth');
    app.click(target);
    assert.equal(app.behavior(), 'auto', target);
  }
});

test('modified, prevented, download and separate-window clicks keep browser defaults', () => {
  const cases = [
    ['prevented', { defaultPrevented: true }],
    ['middle button', { button: 1 }],
    ['right button', { button: 2 }],
    ['control', { ctrlKey: true }],
    ['command', { metaKey: true }],
    ['shift', { shiftKey: true }],
    ['alt', { altKey: true }],
    ['download', {}, { hasAttribute: name => name === 'download' }],
    ['new tab', {}, { target: '_blank' }],
    ['named window', {}, { target: 'appointment' }]
  ];
  for (const [name, eventValues, linkValues] of cases) {
    const app = setup();
    app.click();
    app.click('#kontakt', eventValues, linkValues);
    assert.equal(app.behavior(), 'auto', name);
  }
});

test('missing, malformed and non-link targets do not leave smooth behavior behind', () => {
  for (const href of ['#missing', '#', '#%E0%A4%A', null]) {
    const app = setup();
    app.click();
    app.click(href);
    assert.equal(app.behavior(), 'auto', String(href));
  }
  const app = setup();
  app.click();
  app.click(null, { target: {} });
  assert.equal(app.behavior(), 'auto', 'A target without closest is harmless');
});

test('fragment completion, history and BFCache lifecycle clear the per-click opt-in', () => {
  const app = setup();
  for (const type of ['hashchange', 'pagehide', 'pageshow', 'popstate']) {
    app.click();
    app.page.emit(type, { persisted: true });
    assert.equal(app.behavior(), 'auto', type);
  }
  app.click();
  app.doc.emit('scrollend');
  assert.equal(app.behavior(), 'auto', 'scrollend also handles a same-hash scroll');
});

test('reduced motion is honored initially and after live preference changes', () => {
  for (const legacyMedia of [false, true]) {
    const app = setup({ reduced: true, legacyMedia });
    app.click();
    assert.equal(app.behavior(), 'auto');
    app.setReduced(false);
    assert.equal(app.behavior(), 'auto', 'Preference changes alone never start animation');
    app.click();
    assert.equal(app.behavior(), 'smooth');
    app.setReduced(true);
    assert.equal(app.behavior(), 'auto', 'Enabling reduced motion clears a previous opt-in');
    app.click();
    assert.equal(app.behavior(), 'auto');
  }
});
