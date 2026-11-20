/* Position an incoming section link before revealing the page content. */
(function () {
  'use strict';

  const SECTION_IDS = new Set(['o-nas', 'opieka', 'przypomnienie', 'kontakt', 'godziny', 'mapa']);

  function initializeFragmentEntry(doc, page) {
    let id;
    const initialHash = page.location.hash;
    try { id = decodeURIComponent(initialHash.slice(1)); } catch (_) { return false; }
    if (!SECTION_IDS.has(id) || doc.readyState !== 'loading' || doc.hidden) return false;
    // History traversal owns its previous scroll position, including BFCache.
    try {
      const navigation = page.performance && page.performance.getEntriesByType('navigation')[0];
      if (navigation && navigation.type === 'back_forward') return false;
    } catch (_) { /* Older browsers still support an ordinary fragment entry. */ }

    const root = doc.documentElement;
    const listeners = [];
    let finished = false;
    let queued = false;
    let frame = null;
    let fontTimer = null;
    let failOpenTimer = null;

    function listen(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      listeners.push(() => target.removeEventListener(type, handler, options));
    }

    function finish() {
      if (finished) return;
      finished = true;
      delete root.dataset.entryPending;
      page.clearTimeout(failOpenTimer);
      page.clearTimeout(fontTimer);
      if (frame !== null) page.cancelAnimationFrame(frame);
      listeners.forEach(remove => remove());
    }

    function positionNow(target) {
      // This section is the first view, so it should not run an entry fade.
      const reveals = Array.from(target.querySelectorAll('[data-reveal]'));
      if (target.matches('[data-reveal]')) reveals.push(target);
      reveals.forEach(element => {
        element.classList.remove('will-reveal');
        element.classList.add('is-visible');
      });
      // Native scroll-padding handles the sticky header on each breakpoint.
      target.scrollIntoView({ behavior: 'instant', block: 'start' });
    }

    function position(target) {
      if (finished || queued) return;
      queued = true;
      page.clearTimeout(fontTimer);
      frame = page.requestAnimationFrame(() => {
        frame = null;
        if (finished) return;
        if (page.location.hash !== initialHash) { finish(); return; }
        try {
          positionNow(target);
          // Reveal only after the browser has applied that scroll to its layout.
          frame = page.requestAnimationFrame(finish);
        } catch (_) { finish(); }
      });
    }

    function ready() {
      if (finished) return;
      const target = doc.getElementById(id);
      if (!target || page.location.hash !== initialHash) { finish(); return; }
      try {
        // Start layout/font discovery after the full document and CSS are ready.
        target.getBoundingClientRect();
        const fontsReady = doc.fonts && doc.fonts.ready;
        if (fontsReady && typeof fontsReady.then === 'function') {
          fontTimer = page.setTimeout(() => position(target), 350);
          fontsReady.then(() => position(target), () => position(target));
        } else position(target);
      } catch (_) { finish(); }
    }

    function prepareLanguageSnapshot(event) {
      if (!event.viewTransition || root.dataset.languageTransition !== 'incoming') return;
      const target = doc.getElementById(id);
      if (!target || page.location.hash !== initialHash) {
        event.viewTransition.skipTransition();
        return;
      }
      try {
        // pagereveal is synchronous: waiting here would capture hidden content.
        // Cold fonts keep the existing bounded entry path instead of animating
        // an unstable layout. Both languages share the same local font files.
        target.getBoundingClientRect();
        if (doc.fonts && doc.fonts.status === 'loading') {
          event.viewTransition.skipTransition();
          return;
        }
        positionNow(target);
        finish();
      } catch (_) {
        event.viewTransition.skipTransition();
        finish();
      }
    }

    // The guard is never a dependency for access to the page. Timeouts and user
    // input cancel every pending callback, so late fonts cannot move the reader.
    failOpenTimer = page.setTimeout(finish, 1500);
    root.dataset.entryPending = 'true';
    try {
      listen(doc, 'DOMContentLoaded', ready, { once: true });
      listen(page, 'pagereveal', prepareLanguageSnapshot);
      ['pointerdown', 'touchstart', 'wheel', 'keydown'].forEach(type =>
        listen(doc, type, finish, { capture: true, passive: true }));
      ['pagehide', 'hashchange', 'site:fragmentchange', 'beforeprint'].forEach(type => listen(page, type, finish));
      listen(page, 'pageshow', event => { if (event.persisted) finish(); });
      listen(doc, 'visibilitychange', () => { if (doc.hidden) finish(); });
    } catch (_) { finish(); }
    return !finished;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { initializeFragmentEntry };
  if (typeof document !== 'undefined') initializeFragmentEntry(document, window);
}());
