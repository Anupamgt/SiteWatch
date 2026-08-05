/**
 * Hand-rolled service worker — app shell caching only. No API responses are
 * ever cached, and POST/PUT/DELETE requests are never intercepted, so a
 * stale cache can never serve stale report data or shadow a mutation.
 * REMAINING_WORK.md Step 14 explicitly asks for this instead of next-pwa.
 */
const CACHE_NAME = "dpr-shell-v1";
const APP_SHELL = [
  "/",
  "/login",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {
      // Best-effort: an offline-first install failure shouldn't block
      // activation (e.g. a shell route 404s during a deploy race).
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never intercept anything but a plain GET navigation/asset request.
  // Mutations (POST/PUT/PATCH/DELETE) and all /api/* traffic must always
  // hit the network so autosave, submit, uploads, and dashboards are never
  // served from — or shadowed by — a stale cache entry.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok && (url.pathname === "/" || APP_SHELL.includes(url.pathname))) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
