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
