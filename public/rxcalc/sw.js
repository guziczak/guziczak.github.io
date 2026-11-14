/* RxCalc only caches its static application. Patient inputs never enter this worker. */
const CACHE_VERSION = '2026-11-14.34';
const SCOPE = new URL(self.registration.scope);
const CACHE_PREFIX = `rxcalc:${encodeURIComponent(SCOPE.pathname)}:`;
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const SHELL_URL = new URL('index.html', SCOPE).href;
const STATIC_PATHS = [
  'viewport-layout.js',
  'patient-picker.js', 'patient-picker-model.js', 'patient-picker.css', 'wheel-motion.js', 'wheel-feedback.js',
  'index.html', 'styles.css', 'app.js', 'select-menu.js', 'engine.js', 'catalogue.js', 'catalogue-selection.js', 'workflow.js', 'dental-systemic.js', 'dental-topicals.js', 'human-regimens.js', 'human-regimen-engine.js', 'product-search.js', 'tablet-doses.js', 'dental-output.js', 'regimens.js', 'regimen-engine.js', 'equine-nsaids.js', 'equine-antiparasitics.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png',
  'icons/icon-512.png', 'icons/maskable-512.png'
];
const STATIC_URLS = new Set(STATIC_PATHS.map(path => new URL(path, SCOPE).href));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll([...STATIC_URLS].map(url => new Request(url, { cache: 'reload' })));
    // An update waits until the user accepts it, or all old windows are closed.
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  // Never save URL parameters. Only the known, static shell has a cache entry.
  const resource = new URL(url.pathname, SCOPE.origin).href;

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedShell = await cache.match(SHELL_URL);
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          if (resource === SHELL_URL || resource === SCOPE.href) {
            // Keep each UI shell with its own cached JS/clinical data version.
            // A changed shell becomes visible when the new worker activates.
            if (cachedShell && await cachedShell.clone().text() !== await response.clone().text()) {
              self.registration.update().catch(() => {});
              return cachedShell;
            }
            await cache.put(SHELL_URL, response.clone());
          }
          return response;
        }
        return cachedShell || response;
      } catch {
        return cachedShell || new Response(
          'RxCalc wymaga pierwszego uruchomienia z dostępem do internetu.',
          { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
        );
      }
    })());
    return;
  }

  if (!STATIC_URLS.has(resource)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(resource);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok && response.type === 'basic') await cache.put(resource, response.clone());
    return response;
  })());
});
