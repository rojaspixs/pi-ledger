// PI Field Ledger — Service Worker v4.2
// Network-first for HTML (fresh deploys reach users fast)
// Cache-first for static assets
// Version bumped on every deploy to purge old caches.

const VERSION = '2026-04-16-v4.2';
const CACHE = 'pi-ledger-' + VERSION;

// Things we want available offline after first visit.
const PRECACHE_URLS = [
  './',
  './index.html',
  './icon.svg',
  './splash.svg',
  './manifest.webmanifest'
];

// Install: pre-cache the shell and take over immediately.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

// Activate: nuke any old caches, claim all clients.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
//   - HTML / navigation requests → network-first, fall back to cache.
//   - Other GET requests on same origin → cache-first, fall back to network.
//   - Everything else (Firestore, Google APIs, cross-origin) → pass through to the network.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // External APIs — don't cache, don't interfere.
  if (!sameOrigin) return;

  const isHTML =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // Network-first so new builds show up on next launch.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Static assets — cache-first.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});

// Let the page trigger an immediate update.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
