'use strict';

// Run with: node --test 4lapy3/tools/navigation.test.cjs
// Exercise the production policy without simulating browser layout or scrolling.
const test = require('node:test');
const assert = require('node:assert/strict');
const { initializeAnchorNavigation, initializeManualTop } = require('../site.js');

function eventHost() {
  const listeners = new Map();
  const registrations = [];
  return {
    registrations,
    addEventListener(type, listener, options) {
      registrations.push({ type, options });
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    emit(type, event = {}) {
      for (const listener of listeners.get(type) || []) listener(event);
    }
  };
}

function setup({ href = 'https://guziczak.github.io/4lapy3/', reduced = false, legacyMedia = false } = {}) {
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
    'https://guziczak.github.io/4lapy3/',
    'https://guziczak.github.io/4lapy3/#przypomnienie',
    'https://guziczak.github.io/4lapy3/en/?lang=en#przypomnienie',
    'https://guziczak.github.io/4lapy3/en/#kontakt'
  ]) assert.equal(setup({ href }).behavior(), 'auto', href);
});

test('native pointer and keyboard anchor activation opt into smooth scrolling', () => {
  for (const detail of [1, 0]) {
    const app = setup();
    const event = app.click('#przypomnienie', { detail }, { target: '_self' });
    assert.equal(app.behavior(), 'smooth');
    assert.equal(event.defaultPrevented, false);
  }
  const app = setup({ href: 'https://guziczak.github.io/4lapy3/en/?preview=1' });
  app.click('#%C5%81apy');
  assert.equal(app.behavior(), 'smooth', 'An existing percent-encoded fragment is decoded');
});

test('language links and all other document changes stay instant after an earlier anchor click', () => {
  const cases = [
    ['https://guziczak.github.io/4lapy3/', 'en/?lang=en#przypomnienie'],
    ['https://guziczak.github.io/4lapy3/en/', '../?lang=pl#przypomnienie'],
    ['https://guziczak.github.io/4lapy3/', '?lang=pl#przypomnienie'],
    ['https://guziczak.github.io/4lapy3/', '/4lapy/#przypomnienie'],
    ['https://guziczak.github.io/4lapy3/', 'https://example.org/4lapy3/#przypomnienie'],
    ['https://guziczak.github.io/4lapy3/', '?preview=1#przypomnienie']
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

test('native fragment events do not cancel the smooth request before it starts', () => {
  const app = setup();
  app.click();
  for (const type of ['popstate', 'hashchange']) {
    app.page.emit(type);
    assert.equal(app.behavior(), 'smooth', type);
  }
  app.doc.emit('scrollend');
  assert.equal(app.behavior(), 'auto');
});

test('scroll completion and BFCache lifecycle clear the per-click opt-in', () => {
  const app = setup();
  for (const type of ['pagehide', 'pageshow']) {
    app.click();
    app.page.emit(type, { persisted: true });
    assert.equal(app.behavior(), 'auto', type);
  }
  app.click();
  app.doc.emit('scrollend');
  assert.equal(app.behavior(), 'auto', 'scrollend also handles a same-hash scroll');
});

test('the next pointer or keyboard interaction clears any remaining smooth opt-in', () => {
  for (const type of ['pointerdown', 'keydown']) {
    const app = setup();
    app.click();
    // A same-hash no-op need not dispatch hashchange or scrollend.
    app.doc.emit(type, { key: 'Tab', button: 0 });
    assert.equal(app.behavior(), 'auto', type);
    app.click('#kontakt', { detail: type === 'keydown' ? 0 : 1 });
    assert.equal(app.behavior(), 'smooth', 'A subsequent real anchor may opt in again');
  }
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

function target(tag = 'body', editable = false) {
  return {
    isContentEditable: editable,
    closest(selector) {
      return selector.split(',').some(part => part.trim() === tag || (tag === 'a' && part.trim() === 'a[href]'))
        ? this : null;
    }
  };
}

function setupManualTop({ href = 'https://guziczak.github.io/4lapy3/en/?lang=en&next=%23stay#przypomnienie', y = 600 } = {}) {
  const nativeOnly = () => assert.fail('Manual-top detection must not block input, scroll, focus or push history');
  const calls = [], notifications = [], order = [];
  const state = { preserved: 'native-history-entry', scroll: { y: 600 } };
  const doc = { ...eventHost(), documentElement: { dataset: {} } };
  const page = {
    ...eventHost(), location: { href }, scrollY: y,
    scroll: nativeOnly, scrollTo: nativeOnly, scrollBy: nativeOnly,
    Event: class { constructor(type) { this.type = type; } },
    dispatchEvent(event) {
      notifications.push(event);
      order.push('fragmentchange');
      this.emit(event.type, event);
    },
    history: {
      state, pushState: nativeOnly,
      replaceState(nextState, title, url) {
        calls.push({ state: nextState, title, url });
        order.push('replaceState');
        this.state = nextState;
        page.location.href = new URL(url, page.location.href).href;
      }
    }
  };
  initializeManualTop(doc, page);
  return {
    doc, page, state, calls, notifications, order,
    input(type, values = {}) {
      doc.emit(type, {
        target: target(), isTrusted: true, defaultPrevented: false,
        preventDefault: nativeOnly, ...values
      });
    },
    at(nextY) { page.scrollY = nextY; page.emit('scroll'); }
  };
}

test('manual-top policy leaves initial top frames and automatic fragment scrolling untouched', () => {
  const app = setupManualTop({ y: 0 });
  assert.equal(app.calls.length, 0);
  app.at(0);
  app.at(800);
  app.at(0);
  app.page.emit('hashchange');
  app.at(0);
  assert.equal(app.calls.length, 0);
  assert.ok(app.page.location.href.endsWith('#przypomnienie'));
});

test('entry positioning resets manual intent and cannot arm top clearing', () => {
  const app = setupManualTop();
  app.input('wheel', { deltaY: -50, deltaX: 0 });
  app.doc.documentElement.dataset.entryPending = 'true';
  app.at(0);
  app.input('wheel', { deltaY: -50, deltaX: 0 });
  app.input('keydown', { key: 'Home' });
  app.input('touchstart', { touches: [{ identifier: 1, clientX: 100, clientY: 100 }] });
  app.input('touchmove', { touches: [{ identifier: 1, clientX: 100, clientY: 120 }] });
  assert.equal(app.calls.length, 0);
  delete app.doc.documentElement.dataset.entryPending;
  app.at(0);
  assert.equal(app.calls.length, 0, 'Guard completion is not manual intent');
  app.input('keydown', { key: 'Home' });
  assert.equal(app.calls.length, 1);
});

test('a manual scroll clears only at the top and preserves state, path and query', () => {
  const app = setupManualTop();
  app.input('wheel', { deltaY: -80, deltaX: 0 });
  app.at(200);
  app.at(1.1);
  assert.equal(app.calls.length, 0, 'Manual intent alone does not clear a mid-page fragment');
  app.at(1);
  assert.equal(app.page.location.href, 'https://guziczak.github.io/4lapy3/en/?lang=en&next=%23stay');
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].state, app.state);
  assert.equal(app.page.history.state, app.state);
  assert.deepEqual(app.order, ['replaceState', 'fragmentchange']);
  assert.equal(app.notifications[0].type, 'site:fragmentchange');
  assert.ok(app.notifications[0] instanceof app.page.Event);
  app.at(-12);
  app.input('wheel', { deltaY: -20, deltaX: 0 });
  assert.equal(app.calls.length, 1, 'A cleared hash is not replaced or announced again');
});

test('a vertical pull at negative iOS overscroll clears before touchend or another scroll event', () => {
  const app = setupManualTop({ y: -8 });
  app.input('touchstart', { touches: [{ identifier: 7, clientX: 100, clientY: 100 }] });
  assert.equal(app.calls.length, 0, 'Touchstart may be an ordinary tap');
  app.input('touchmove', { touches: [{ identifier: 7, clientX: 102, clientY: 114 }] });
  assert.equal(app.calls.length, 1, 'The native pull-to-refresh can now reload a fragment-free URL');
});

test('taps, horizontal gestures, pinch wheels and synthetic input do not arm top clearing', () => {
  const wheelCases = [
    { deltaY: 0, deltaX: 40 }, { deltaY: 2, deltaX: 40 },
    { deltaY: -40, deltaX: 0, ctrlKey: true },
    { deltaY: -40, deltaX: 0, shiftKey: true },
    { deltaY: -40, deltaX: 0, defaultPrevented: true },
    { deltaY: -40, deltaX: 0, isTrusted: false }
  ];
  for (const wheel of wheelCases) {
    const app = setupManualTop({ y: 0 });
    app.input('wheel', wheel);
    app.at(0);
    assert.equal(app.calls.length, 0);
  }
  for (const move of [null, { clientX: 103, clientY: 103 }, { clientX: 130, clientY: 102 }]) {
    const app = setupManualTop({ y: 0 });
    app.input('touchstart', { touches: [{ identifier: 1, clientX: 100, clientY: 100 }] });
    if (move) app.input('touchmove', { touches: [{ identifier: 1, ...move }] });
    app.input('touchend', { touches: [] });
    app.at(0);
    assert.equal(app.calls.length, 0);
  }
});

test('Home scrolls can clear the hash but editing and control activation cannot', () => {
  const app = setupManualTop();
  app.input('keydown', { key: 'Home' });
  assert.equal(app.calls.length, 0);
  app.at(0);
  assert.equal(app.calls.length, 1);
  for (const control of [target('input'), target('textarea'), target('select'), target('div', true)]) {
    const editing = setupManualTop({ y: 0 });
    editing.input('keydown', { key: 'Home', target: control });
    editing.at(0);
    assert.equal(editing.calls.length, 0);
  }
  for (const tag of ['button', 'summary']) {
    const control = setupManualTop({ y: 0 });
    control.input('keydown', { key: ' ', target: target(tag) });
    assert.equal(control.calls.length, 0, 'Space activates the control');
    control.input('keydown', { key: 'Home', target: target(tag) });
    assert.equal(control.calls.length, 1, 'Home can still scroll with a control focused');
  }
});

test('anchor clicks and page/history lifecycle reset stale manual intent', () => {
  for (const type of ['popstate', 'hashchange', 'pagehide', 'pageshow', 'anchor-click']) {
    const app = setupManualTop();
    app.input('wheel', { deltaY: -40, deltaX: 0 });
    if (type === 'anchor-click') app.input('click', { target: target('a') });
    else app.page.emit(type, { persisted: true });
    app.at(0);
    assert.equal(app.calls.length, 0, type);
    app.input('wheel', { deltaY: -40, deltaX: 0 });
    assert.equal(app.calls.length, 1, `New manual intent still works after ${type}`);
  }
});

test('touch momentum retains intent and every manual-top listener is passive', () => {
  const app = setupManualTop();
  app.input('touchstart', { touches: [{ identifier: 1, clientX: 100, clientY: 100 }] });
  app.input('touchmove', { touches: [{ identifier: 1, clientX: 100, clientY: 130 }] });
  app.input('touchend', { touches: [] });
  app.at(0);
  assert.equal(app.calls.length, 1);
  for (const { type, options } of [...app.doc.registrations, ...app.page.registrations]) {
    assert.equal(options.passive, true, type);
  }
});
