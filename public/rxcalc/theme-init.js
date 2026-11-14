/* Run as a blocking head script so the loader uses the saved theme on its first paint. */
(() => {
  'use strict';

  const root = document.documentElement;
  const palettes = {
    light: { background: '#f6f8f7', ink: '#1a302d', chrome: '#ffffff' },
    dark: { background: '#12201c', ink: '#e5efe8', chrome: '#1a2a24' },
  };

  function apply(value) {
    const theme = value === 'dark' ? 'dark' : 'light';
    const palette = palettes[theme];
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    // These fallbacks also cover the time before the main stylesheet arrives.
    root.style.backgroundColor = `var(--bg, ${palette.background})`;
    root.style.color = `var(--ink, ${palette.ink})`;
    const chrome = document.querySelector('meta[name="theme-color"]');
    const colorScheme = document.querySelector('meta[name="color-scheme"]');
    if (chrome) chrome.content = palette.chrome;
    if (colorScheme) colorScheme.content = theme;
    return theme;
  }

  let savedTheme;
  try {
    savedTheme = JSON.parse(window.localStorage.getItem('rxcalc.theme'));
  } catch {
    // Storage can be unavailable; the page must still start normally.
  }
  let initialTheme = savedTheme;
  if (initialTheme !== 'light' && initialTheme !== 'dark') {
    try {
      initialTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      initialTheme = 'light';
    }
  }

  window.RxCalcTheme = Object.freeze({
    apply,
    get current() { return root.dataset.theme; },
  });
  apply(initialTheme);
})();
