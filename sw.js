/* Service Worker – Efforts en tête de mur (PWA)
 * Cache de l'application shell + ressources CDN utilisées au runtime.
 * Les fichiers IFC / études utilisateur ne sont jamais mis en cache.
 */
const CACHE_VERSION = "effort-mur-v1.2.00";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./main.js",
  "./site.webmanifest",
  "./favicon.ico",
  "./favicon.svg",
  "./favicon-96x96.png",
  "./apple-touch-icon.png",
  "./web-app-manifest-192x192.png",
  "./web-app-manifest-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.allSettled(
        SHELL_ASSETS.map(async (url) => {
          try {
            const res = await fetch(url, { cache: "reload" });
            if (res.ok) await cache.put(url, res);
          } catch (_) {
            /* asset optionnel / indisponible */
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isCdnAsset(url) {
  return (
    url.hostname.includes("cdn.jsdelivr.net") ||
    url.hostname.includes("unpkg.com")
  );
}

function shouldBypassCache(request, url) {
  if (request.method !== "GET") return true;
  // Fichiers lourds / données utilisateur
  if (/\.(ifc|IFC|json)$/i.test(url.pathname) && !url.pathname.endsWith("site.webmanifest")) {
    return true;
  }
  // Requêtes chrome-extension etc.
  if (!url.protocol.startsWith("http")) return true;
  return false;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const networkRes = await fetch(request);
    if (networkRes && networkRes.ok) {
      cache.put(request, networkRes.clone());
    }
    return networkRes;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Fallback navigations
    if (request.mode === "navigate") {
      const shell = await caches.open(SHELL_CACHE);
      return (
        (await shell.match("./index.html")) ||
        (await shell.match("./")) ||
        Response.error()
      );
    }
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((networkRes) => {
      if (networkRes && networkRes.ok) {
        cache.put(request, networkRes.clone());
      }
      return networkRes;
    })
    .catch(() => null);
  return cached || (await networkPromise) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  let url;
  try {
    url = new URL(request.url);
  } catch (_) {
    return;
  }

  if (shouldBypassCache(request, url)) return;

  // Navigation & coeur app : réseau d'abord pour recevoir les mises à jour
  if (request.mode === "navigate" || (isSameOrigin(url) && /\/(index\.html)?$/.test(url.pathname))) {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  // main.js / manifest / icônes : réseau d'abord
  if (isSameOrigin(url) && /\.(js|webmanifest|png|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  // CDN three / web-ifc : stale-while-revalidate (offline après 1ère visite)
  if (isCdnAsset(url)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
