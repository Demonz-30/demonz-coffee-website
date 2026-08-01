/* ============================================================
   DEMONZ COFFEE — Service Worker (PWA / Offline)
   v1.0 (Milestone C1)
   Strategy:
   - Precache app shell on install.
   - Runtime cache first, then network with cache fallback (stale-while-revalidate
     for assets; cache-first for image/font assets; network-first for navigation).
   ============================================================ */

const VERSION = 'demonz-coffee-v2';
const PRECACHE = [
  './',
  './index.html',
  './offline.html',
  './404.html',
  './manifest.json',
  './css/style.min.css',
  './css/fonts.css',
  './vendor/css/swiper-bundle.min.css',
  './js/app.min.js',
  './js/main.min.js',
  './js/three-hero.min.js',
  './vendor/js/gsap.min.js',
  './vendor/js/ScrollTrigger.min.js',
  './vendor/js/three.min.js',
  './vendor/js/OrbitControls.js',
  './vendor/js/GLTFLoader.js',
  './vendor/js/lenis.min.js',
  './vendor/js/swiper-bundle.min.js',
  './vendor/js/typed.umd.js',
  './vendor/js/vanilla-tilt.min.js'
];

// Cache namespaces
const CACHE_ASSETS = 'demonz-assets-v1';
const CACHE_FONTS = 'demonz-fonts-v1';
const CACHE_IMAGES = 'demonz-images-v1';
const CACHE_PAGES = 'demonz-pages-v1';

// Assets to eager-cache on install
const ASSET_CACHE_LIST = [
  'assets/logo/web/logo2.webp',
  'assets/logo/web/logo3.webp'
];

// Only cache same-origin (or localhost) requests to avoid proxy issues in dev.
const isSameOrigin = (url) => {
  const a = new URL(url, self.location.origin);
  return a.origin === self.location.origin;
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_ASSETS)
      .then((cache) => cache.addAll(PRECACHE))
      .catch((err) => { console.warn('[SW] Precache partial failure:', err); })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k.startsWith('demonz-') && k !== VERSION && ![CACHE_ASSETS, CACHE_FONTS, CACHE_IMAGES, CACHE_PAGES].includes(k))
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Helper to put a response in a named cache (clone-safe)
function cachePut(cacheName, req, res) {
  if (!res || res.status !== 200 || res.type === 'opaque') return;
  const copy = res.clone();
  caches.open(cacheName).then((cache) => cache.put(req, copy));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET
  if (req.method !== 'GET') return;

  // Only handle same-origin requests (skip cross-origin fonts/images/GA/etc.)
  if (!isSameOrigin(req.url)) return;

  const url = new URL(req.url);

  // ---- Navigation (HTML) ------- network-first, fallback to cached index, then offline ----
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          cachePut(CACHE_PAGES, './index.html', res.clone());
          return res;
        })
        .catch(() =>
          caches.match('./index.html')
            .then((cached) => cached || caches.match('./offline.html'))
            .then((cached) => cached || caches.match('./'))
        )
    );
    return;
  }

  // ---- Fonts (woff2) ------------ cache-first ----
  if (req.destination === 'font' || (url.href.includes('.woff2') || url.href.includes('.woff'))) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          cachePut(CACHE_FONTS, req, res);
          return res;
        });
      })
    );
    return;
  }

  // ---- Images (webp/png/svg/jpeg) ---- cache-first with background refresh ----
  if (/\.(webp|png|svg|jpe?g|avif|gif|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            cachePut(CACHE_IMAGES, req, res);
            return res.clone();
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // ---- JS / CSS (stale-while-revalidate) ----
  if (/\.(js|css)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req).then((res) => {
          cachePut(CACHE_ASSETS, req, res);
          return res.clone();
        });
        return cached || network;
      })
    );
    return;
  }

  // ---- Default: network first, cache fallback ----
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
