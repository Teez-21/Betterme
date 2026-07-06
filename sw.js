// ============================================
// BetterME — Service Worker
// Cache-first strategy for full offline functionality.
// ============================================

const CACHE_NAME = 'betterme-cache-v1';
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
  './fonts/Cocogoose-Pro-Bold-trial.ttf',
  './fonts/Cocogoose-Pro-Bold-Italic-trial.ttf',
  './fonts/Cocogoose-Pro-Light-trial.ttf',
  './fonts/Cocogoose-Pro-Light-Italic-trial.ttf',
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
