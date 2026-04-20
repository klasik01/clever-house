// Minimal service worker for PWA install requirements.
// Cache strategy: cache-first for static, pass-through for everything else.
// In production (S14), replace with vite-plugin-pwa generated worker.

const CACHE = "clever-house-v1";
const ASSETS = ["/", "/index.html", "/manifest.webmanifest", "/icon-192.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches
      .match(e.request)
      .then((cached) => cached || fetch(e.request))
  );
});
