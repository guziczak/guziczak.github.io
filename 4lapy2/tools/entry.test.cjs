'use strict';

// Run with: node --test 4lapy2/tools/entry.test.cjs
// These are lifecycle checks, not a simulation of browser layout or painting.
const test = require('node:test');
const assert = require('node:assert/strict');
const { initializeFragmentEntry } = require('../entry.js');

function eventHost() {
  const events = new Map();
  return {
    addEventListener(type, handler, options = {}) {
      if (!events.has(type)) events.set(type, new Set());
      events.get(type).add({ handler, once: Boolean(options.once) });
    },
    removeEventListener(type, handler) {
      for (const entry of events.get(type) || []) {
        if (entry.handler === handler) events.get(type).delete(entry);
      }
    },
    emit(type, event = {}) {
      for (const entry of Array.from(events.get(type) || [])) {
        if (!events.get(type).has(entry)) continue;
        if (entry.once) events.get(type).delete(entry);
        entry.handler(event);
      }
    }
  };
}

function fakeClock() {
  let now = 0;
  let sequence = 0;
  const timers = new Map();
  const frames = new Map();
  return {
    setTimeout(callback, delay) {
      const id = ++sequence;
      timers.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame(callback) {
      const id = ++sequence;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame: id => frames.delete(id),
    advance(milliseconds) {
      const end = now + milliseconds;
      while (true) {
        const next = Array.from(timers).filter(([, timer]) => timer.at <= end)
          .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!next) break;
        timers.delete(next[0]);
        now = next[1].at;
        next[1].callback();
      }
      now = end;
    },
    frame() {
      const current = Array.from(frames);
      for (const [id, callback] of current) {
        if (!frames.delete(id)) continue;
        callback(now);
      }
    },
    takeFrame() {
      const next = frames.entries().next().value;
      assert.ok(next, 'Expected a scheduled animation frame');
      frames.delete(next[0]);
      return next[1];
    },
    pendingFrames: () => frames.size
  };
}

function setup({ hash = '#przypomnienie', readyState = 'loading', hidden = false,
  navigationType = 'navigate', fonts = true, missingTarget = false } = {}) {
  const clock = fakeClock();
  let resolveFonts, rejectFonts;
  const fontPromise = new Promise((resolve, reject) => { resolveFonts = resolve; rejectFonts = reject; });
  const historyChanges = [];
  let storageAccesses = 0;
  const calls = [];
  const reveal = () => {
    const classes = new Set(['will-reveal', 'existing-class']);
    return { classes, classList: { add: name => classes.add(name), remove: name => classes.delete(name) } };
  };
  const child = reveal();
  const target = {
    ...reveal(),
    getBoundingClientRect: () => { calls.push({ type: 'layout' }); return { top: 1000 }; },
    querySelectorAll: () => [child], matches: () => true,
    scrollIntoView: options => calls.push({ type: 'scroll', options })
  };
  const doc = {
    ...eventHost(), readyState, hidden,
    documentElement: { dataset: {} },
    getElementById: () => missingTarget ? null : target
  };
  if (fonts) doc.fonts = { ready: fontPromise };
  const page = {
    ...eventHost(),
    location: new URL(`https://guziczak.github.io/4lapy2/?preview=1${hash}`),
    performance: { getEntriesByType: () => [{ type: navigationType }] },
    history: {
      state: { existing: true },
      pushState: (...args) => historyChanges.push(['push', ...args]),
      replaceState: (...args) => historyChanges.push(['replace', ...args])
    },
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    requestAnimationFrame: clock.requestAnimationFrame,
    cancelAnimationFrame: clock.cancelAnimationFrame
  };
  for (const key of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(page, key, { get() { storageAccesses++; return {}; } });
  }
  const originalUrl = page.location.href;
  const active = initializeFragmentEntry(doc, page);
  return {
    active, doc, page, clock, target, child, calls, resolveFonts, rejectFonts,
    pending: () => doc.documentElement.dataset.entryPending === 'true',
    scrolls: () => calls.filter(call => call.type === 'scroll'),
    ready() { doc.readyState = 'interactive'; doc.emit('DOMContentLoaded'); },
    assertNavigationUntouched() {
      assert.equal(page.location.href, originalUrl);
      assert.deepEqual(historyChanges, []);
      assert.deepEqual(page.history.state, { existing: true });
      assert.equal(storageAccesses, 0);
    }
  };
}

test('the initial guard is limited to supported visible section entries', () => {
  for (const hash of ['#o-nas', '#opieka', '#przypomnienie', '#kontakt', '#godziny', '#mapa', '#%70rzypomnienie']) {
    const app = setup({ hash, navigationType: 'reload' });
    assert.equal(app.active, true, hash);
    assert.equal(app.pending(), true, hash);
  }
  for (const options of [
    { hash: '' }, { hash: '#' }, { hash: '#top' }, { hash: '#tresc' },
    { hash: '#missing' }, { hash: '#%E0%A4%A' },
    { readyState: 'interactive' }, { readyState: 'complete' },
    { hidden: true }, { navigationType: 'back_forward' }
  ]) {
    const app = setup(options);
    assert.equal(app.active, false, JSON.stringify(options));
    assert.equal(app.pending(), false);
    app.clock.advance(5000);
    app.clock.frame();
    assert.equal(app.scrolls().length, 0);
    app.assertNavigationUntouched();
  }
});

test('fonts and layout precede one instant position; the next frame reveals without entry fades', async () => {
  const app = setup();
  app.ready();
  assert.deepEqual(app.calls, [{ type: 'layout' }]);
  assert.equal(app.clock.pendingFrames(), 0);
  app.resolveFonts();
  await Promise.resolve();
  assert.equal(app.pending(), true);
  app.clock.frame();
  assert.deepEqual(app.scrolls(), [{ type: 'scroll', options: { behavior: 'instant', block: 'start' } }]);
  assert.equal(app.pending(), true, 'Reveal waits for the frame after the position request');
  for (const element of [app.target, app.child]) {
    assert.equal(element.classes.has('will-reveal'), false);
    assert.equal(element.classes.has('is-visible'), true);
    assert.equal(element.classes.has('existing-class'), true);
  }
  app.clock.frame();
  assert.equal(app.pending(), false);
  app.clock.advance(5000);
  app.clock.frame();
  assert.equal(app.scrolls().length, 1);
  app.assertNavigationUntouched();
});

test('font timeout positions once and a later font resolution cannot move the reader again', async () => {
  const app = setup();
  app.ready();
  app.clock.advance(349);
  assert.equal(app.clock.pendingFrames(), 0);
  app.clock.advance(1);
  app.clock.frame();
  app.clock.frame();
  assert.equal(app.scrolls().length, 1);
  assert.equal(app.pending(), false);
  app.resolveFonts();
  await Promise.resolve();
  app.clock.advance(5000);
  app.clock.frame();
  assert.equal(app.scrolls().length, 1);
  app.assertNavigationUntouched();
});

test('missing font API and a failed font promise both preserve access to the section', async () => {
  for (const fonts of [false, true]) {
    const app = setup({ fonts });
    app.ready();
    if (fonts) {
      app.rejectFonts(new Error('Font unavailable'));
      await Promise.resolve();
    }
    app.clock.frame();
    app.clock.frame();
    assert.equal(app.pending(), false);
    assert.equal(app.scrolls().length, 1);
  }
});

test('the overall fail-open deadline prevents a late font callback from positioning', async () => {
  const app = setup();
  app.clock.advance(1300);
  app.ready();
  app.clock.advance(199);
  assert.equal(app.pending(), true);
  app.clock.advance(1);
  assert.equal(app.pending(), false);
  app.resolveFonts();
  await Promise.resolve();
  app.clock.advance(5000);
  app.clock.frame();
  app.clock.frame();
  assert.equal(app.scrolls().length, 0);
  app.assertNavigationUntouched();

  const neverReady = setup();
  neverReady.clock.advance(1500);
  assert.equal(neverReady.pending(), false);
  neverReady.ready();
  neverReady.resolveFonts();
  await Promise.resolve();
  neverReady.clock.frame();
  assert.equal(neverReady.scrolls().length, 0);
});

test('fail-open also invalidates an animation frame that was already queued', () => {
  const app = setup({ fonts: false });
  app.ready();
  const staleFrame = app.clock.takeFrame();
  app.clock.advance(1500);
  assert.equal(app.pending(), false);
  staleFrame();
  app.clock.frame();
  assert.equal(app.scrolls().length, 0);
});

test('input and lifecycle cancellations invalidate queued work before it can scroll', () => {
  const cancellations = [
    app => app.doc.emit('pointerdown'),
    app => app.doc.emit('touchstart'),
    app => app.doc.emit('wheel'),
    app => app.doc.emit('keydown'),
    app => app.page.emit('pagehide'),
    app => app.page.emit('hashchange'),
    app => app.page.emit('site:fragmentchange'),
    app => app.page.emit('beforeprint'),
    app => app.page.emit('pageshow', { persisted: true }),
    app => { app.doc.hidden = true; app.doc.emit('visibilitychange'); }
  ];
  for (const cancel of cancellations) {
    const app = setup({ fonts: false });
    app.ready();
    const staleFrame = app.clock.takeFrame();
    cancel(app);
    assert.equal(app.pending(), false);
    staleFrame();
    app.clock.advance(5000);
    app.clock.frame();
    assert.equal(app.scrolls().length, 0);
    app.assertNavigationUntouched();
  }
});

test('ordinary pageshow and remaining visible do not cancel a valid initial entry', () => {
  const app = setup({ fonts: false });
  app.page.emit('pageshow', { persisted: false });
  app.doc.emit('visibilitychange');
  assert.equal(app.pending(), true);
  app.ready();
  app.clock.frame();
  app.clock.frame();
  assert.equal(app.pending(), false);
  assert.equal(app.scrolls().length, 1);
});

test('missing targets, changed fragments and layout failures fail open without scrolling', () => {
  const missing = setup({ missingTarget: true });
  missing.ready();
  assert.equal(missing.pending(), false);
  assert.equal(missing.scrolls().length, 0);

  for (const changeBeforeReady of [true, false]) {
    const app = setup({ fonts: false });
    if (!changeBeforeReady) app.ready();
    app.page.location.hash = '#kontakt';
    if (changeBeforeReady) app.ready();
    app.clock.frame();
    assert.equal(app.pending(), false);
    assert.equal(app.scrolls().length, 0);
  }

  const brokenLayout = setup();
  brokenLayout.target.getBoundingClientRect = () => { throw new Error('No layout'); };
  brokenLayout.ready();
  assert.equal(brokenLayout.pending(), false);
  assert.equal(brokenLayout.scrolls().length, 0);
});
