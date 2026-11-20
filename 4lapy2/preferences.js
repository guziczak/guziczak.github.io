/* Display preferences only. Form values and map consent are never stored. */
(function () {
  'use strict';

  const root = document.documentElement;
  const pageLanguage = root.lang === 'en' ? 'en' : 'pl';
  const themeKey = '4lapy2-theme';
  const languageKey = '4lapy2-language';
  const validTheme = value => value === 'light' || value === 'dark';
  const validLanguage = value => value === 'pl' || value === 'en';
  const read = key => {
    try { return window.localStorage.getItem(key); } catch (_) { return null; }
  };
  const remember = (key, value) => {
    try { window.localStorage.setItem(key, value); } catch (_) { /* Preferences still work for this visit. */ }
  };
  const media = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const savedTheme = read(themeKey);
  let chosenTheme = validTheme(savedTheme) ? savedTheme : null;

  const themeLabel = theme => pageLanguage === 'en'
    ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`
    : `Włącz ${theme === 'dark' ? 'jasny' : 'ciemny'} motyw`;

  function updateThemeControls() {
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      const label = themeLabel(root.dataset.theme);
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.hidden = false;
    });
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    const color = document.querySelector('meta[name="theme-color"]');
    if (color) color.setAttribute('content', theme === 'dark' ? '#141d18' : '#f8f9f4');
    updateThemeControls();
  }

  // This script runs before the stylesheet, so the stored theme paints immediately.
  applyTheme(chosenTheme || (media && media.matches ? 'dark' : 'light'));
  const onSystemTheme = () => {
    if (!chosenTheme) applyTheme(media && media.matches ? 'dark' : 'light');
  };
  if (media && media.addEventListener) media.addEventListener('change', onSystemTheme);
  else if (media && media.addListener) media.addListener(onSystemTheme);

  // The script is shared by /4lapy2/ and /4lapy2/en/. Deriving the base from its
  // own URL also supports preview folders and explicit index.html addresses.
  const script = document.currentScript;
  const base = script && script.src
    ? new URL('./', script.src)
    : new URL(pageLanguage === 'en' ? '../' : './', window.location.href);
  const languageUrl = language => new URL(language === 'en' ? 'en/' : './', base);
  const current = new URL(window.location.href);
  const requestedLanguage = current.searchParams.get('lang');
  const savedLanguage = read(languageKey);
  const supportsPageTransitions = 'onpageswap' in window && 'onpagereveal' in window;
  const motion = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reducedMotion = () => Boolean(motion && motion.matches);
  const otherLanguage = pageLanguage === 'pl' ? 'en' : 'pl';

  function languageAt(value) {
    if (!value) return null;
    try {
      const url = new URL(value, base);
      if (url.origin !== base.origin) return null;
      for (const language of ['pl', 'en']) {
        const path = languageUrl(language).pathname;
        if (url.pathname === path || url.pathname === `${path}index.html`) return language;
      }
    } catch (_) { /* An unknown destination gets ordinary navigation. */ }
    return null;
  }

  function incomingLanguageChoice() {
    if (!supportsPageTransitions || reducedMotion() || requestedLanguage !== pageLanguage ||
      languageAt(current) !== pageLanguage) return false;
    try {
      const navigation = window.performance && window.performance.getEntriesByType('navigation')[0];
      if (navigation && navigation.type !== 'navigate') return false;
    } catch (_) { /* Safari versions without this information use the referrer. */ }
    try {
      const activation = window.navigation && window.navigation.activation;
      if (activation && activation.navigationType && !['push', 'replace'].includes(activation.navigationType)) return false;
      if (activation && activation.entry && languageAt(activation.entry.url) !== pageLanguage) return false;
      const from = activation && activation.from && activation.from.url;
      return languageAt(from || document.referrer || '') === otherLanguage;
    } catch (_) { return false; }
  }

  // Capture the explicit choice before the existing URL cleanup removes ?lang.
  let incomingLanguage = incomingLanguageChoice();
  let outgoingLanguageUrl = null;
  let activeTransition = null;
  let expectedContent = null;

  function removeExpectedContent() {
    if (!expectedContent) return;
    expectedContent.remove();
    expectedContent = null;
  }

  function clearLanguageTransition(transition) {
    if (transition && transition !== activeTransition) return;
    activeTransition = null;
    delete root.dataset.languageTransition;
    removeExpectedContent();
  }

  function observeTransition(transition) {
    // Skipped transitions reject ready; neither that nor a failed finished
    // promise should produce an unhandled rejection during normal navigation.
    if (transition.ready && typeof transition.ready.catch === 'function') transition.ready.catch(() => {});
    if (transition.finished && typeof transition.finished.then === 'function') {
      const finish = () => clearLanguageTransition(transition);
      transition.finished.then(finish, finish);
    }
  }

  function skipTransition(transition) {
    if (!transition) return;
    observeTransition(transition);
    transition.skipTransition();
  }

  function resetLanguageNavigation() {
    outgoingLanguageUrl = null;
    incomingLanguage = false;
    clearLanguageTransition();
  }

  function initializeLanguageTransitions() {
    if (!supportsPageTransitions) return;

    // The marker is after the page content in both documents. Rendering waits
    // for its HTML only on an explicit language entry, never on normal visits.
    if (incomingLanguage && document.readyState === 'loading') {
      expectedContent = document.createElement('link');
      expectedContent.setAttribute('rel', 'expect');
      expectedContent.setAttribute('blocking', 'render');
      expectedContent.setAttribute('href', '#page-ready');
      document.head.appendChild(expectedContent);
      document.addEventListener('DOMContentLoaded', removeExpectedContent, { once: true });
    }

    document.addEventListener('click', event => {
      outgoingLanguageUrl = null;
      if (event.defaultPrevented || event.isTrusted === false || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || reducedMotion()) return;
      const link = event.target.closest && event.target.closest('a[data-language-switch]');
      if (!link || link.dataset.languageSwitch !== otherLanguage || link.hasAttribute('download') ||
        (link.target && link.target.toLowerCase() !== '_self')) return;
      try {
        const target = new URL(link.href, window.location.href);
        if (languageAt(target) !== otherLanguage || target.searchParams.get('lang') !== otherLanguage) return;
        outgoingLanguageUrl = target.href;
      } catch (_) { /* Leave malformed links to the browser. */ }
    });

    window.addEventListener('pageswap', event => {
      const transition = event.viewTransition;
      const destination = outgoingLanguageUrl;
      outgoingLanguageUrl = null;
      let eligible = Boolean(destination) && !reducedMotion();
      // activation is not required: older Safari can use the verified click.
      const activation = event.activation;
      if (activation && activation.navigationType && !['push', 'replace'].includes(activation.navigationType)) eligible = false;
      if (activation && activation.entry && activation.entry.url !== destination) eligible = false;
      if (!transition || !eligible) {
        clearLanguageTransition();
        skipTransition(transition);
        return;
      }
      root.dataset.languageTransition = 'outgoing';
      activeTransition = transition;
      observeTransition(transition);
    });

    // Registered in this synchronous head script, before entry.js registers its
    // own pagereveal handler that positions a fragment and reveals its content.
    window.addEventListener('pagereveal', event => {
      const transition = event.viewTransition;
      const eligible = incomingLanguage && !reducedMotion();
      incomingLanguage = false;
      removeExpectedContent();
      if (!transition || !eligible) {
        clearLanguageTransition();
        skipTransition(transition);
        return;
      }
      root.dataset.languageTransition = 'incoming';
      activeTransition = transition;
      observeTransition(transition);
    });

    window.addEventListener('pagehide', resetLanguageNavigation);
    window.addEventListener('pageshow', event => { if (event.persisted) resetLanguageNavigation(); });
    const onMotion = () => {
      if (!reducedMotion()) return;
      skipTransition(activeTransition);
      resetLanguageNavigation();
    };
    if (motion && motion.addEventListener) motion.addEventListener('change', onMotion);
    else if (motion && motion.addListener) motion.addListener(onMotion);
  }

  function navigateToLanguage(language, explicit) {
    const target = languageUrl(language);
    target.search = current.search;
    if (explicit) target.searchParams.set('lang', language);
    target.hash = current.hash;
    window.location.replace(target.href);
  }

  if (validLanguage(requestedLanguage)) {
    remember(languageKey, requestedLanguage);
    if (requestedLanguage !== pageLanguage) {
      navigateToLanguage(requestedLanguage, true);
      return;
    }
    // Keep copied URLs clean once the explicit choice has been applied.
    current.searchParams.delete('lang');
    try { window.history.replaceState(window.history.state, '', current.href); } catch (_) { /* No routing depends on cleanup. */ }
  } else if (pageLanguage === 'en') {
    // A direct English URL is intentional, even if Polish was chosen earlier.
    remember(languageKey, 'en');
  } else if (savedLanguage === 'en') {
    navigateToLanguage('en', false);
    return;
  } else {
    remember(languageKey, 'pl');
  }

  initializeLanguageTransitions();

  function initializeControls() {
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.addEventListener('click', () => {
        chosenTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
        remember(themeKey, chosenTheme);
        applyTheme(chosenTheme);
      });
    });
    updateThemeControls();

    const languageLinks = Array.from(document.querySelectorAll('[data-language-switch]'));
    const updateLanguageLinks = () => {
      languageLinks.forEach(link => {
        const language = link.dataset.languageSwitch;
        if (!validLanguage(language)) return;
        const target = languageUrl(language);
        target.search = window.location.search;
        target.searchParams.set('lang', language);
        target.hash = window.location.hash;
        link.setAttribute('href', target.href);
      });
    };
    updateLanguageLinks();
    languageLinks.forEach(link => link.addEventListener('click', () => {
      const language = link.dataset.languageSwitch;
      if (validLanguage(language)) remember(languageKey, language);
      updateLanguageLinks();
    }));
    window.addEventListener('hashchange', updateLanguageLinks);
    window.addEventListener('site:fragmentchange', updateLanguageLinks);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeControls, { once: true });
  else initializeControls();

  window.addEventListener('storage', event => {
    if (event.key !== themeKey) return;
    chosenTheme = validTheme(event.newValue) ? event.newValue : null;
    applyTheme(chosenTheme || (media && media.matches ? 'dark' : 'light'));
  });
}());
