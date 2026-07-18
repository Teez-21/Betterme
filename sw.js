// ============================================
// BetterME — Service Worker
// Cache-first strategy for full offline functionality.
// ============================================

const CACHE_NAME = 'betterme-cache-v3';
const CORE_ASSETS = ['./index.html', './js/app.js', './js/db.js', './js/utils.js', './js/pin.js', './js/habits.js', './js/calendar.js', './js/finance.js', './js/dashboard.js', './js/settings.js', './js/charts.js', './css/style.css'];
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/db.js',
  './js/utils.js',
  './js/charts.js',
  './js/habits.js',
  './js/calendar.js',
  './js/finance.js',
  './js/dashboard.js',
  './js/settings.js',
  './js/pin.js',
  './js/app.js',
  './fonts/Neogen-Black.ttf',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-384.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/logo-full.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isCore = CORE_ASSETS.some(a => url.pathname.endsWith(a.replace('./', '/'))) || event.request.mode === 'navigate';

  if (isCore) {
    // Network-first for HTML/CSS/JS so updates are picked up immediately when online.
    event.respondWith(
      fetch(event.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return res;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for static assets (fonts, icons) that never change.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
