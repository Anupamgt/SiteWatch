/**
 * App-shell service worker — offline fallback only.
 *
 * IMPORTANT: HTML navigations are network-first. Cache-first HTML after a
 * Vercel redeploy was serving stale documents that pointed at deleted
 * `/_next/static/*` chunks, which left users on a persistent blank dark
 * screen (PWA background_color).
 *
 * API / mutations are never intercepted.
 */
const CACHE_NAME = "dpr-shell-v5";
const OFFLINE_SHELL = [
  "/login",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(OFFLINE_SHELL))
      .catch(() => {
        // Best-effort: install must not fail the SW if a shell asset 404s mid-deploy.
      }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function isNavigationRequest(request) {
  if (request.mode === "navigate") return true;
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  // Never cache hashed Next bundles — the CDN/immutable URLs handle that.
  if (url.pathname.startsWith("/_next/")) return;

  // HTML: always prefer network so deploys are visible immediately.
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Keep a fresh offline copy of the login shell only.
          if (response.ok && url.pathname === "/login") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match("/login");
        }),
    );
    return;
  }

  // Static shell assets (icons/manifest): stale-while-revalidate.
  if (OFFLINE_SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
