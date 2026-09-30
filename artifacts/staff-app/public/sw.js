// Service Worker — CrowdFlow Staff PWA
const CACHE_NAME = 'cf-staff-shell-v2';
const SHELL_ASSETS = ['/', '/manifest.json', '/favicon.svg', '/icon-192.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never touch API calls, live streams, other sites, or non-GET requests
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Network-first for page navigation, fall back to cached shell when offline
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/')));
    return;
  }

  // Cache-first for this site's own static files
  event.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
});
