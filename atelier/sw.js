// Offline support: app shell is precached; same-origin files are served stale-while-revalidate.
const VERSION = 'atelier-v1';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/main.js', './js/config.js', './js/util.js', './js/constants.js', './js/color.js', './js/engine.js', './js/garments.js',
  './js/demo.js', './js/db.js', './js/store.js', './js/sync.js', './js/weather.js', './js/analyzer.js', './js/planning.js',
  './js/icons.js', './js/ui.js', './js/context.js', './js/studio.js', './js/router.js',
  './js/views/home.js', './js/views/wardrobe.js', './js/views/item-editor.js', './js/views/create.js', './js/views/outfit.js',
  './js/views/planner.js', './js/views/calendar.js', './js/views/favorites.js', './js/views/stats.js', './js/views/laundry.js',
  './js/views/travel.js', './js/views/shopping.js', './js/views/preview.js', './js/views/settings.js',
  './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

const RUNTIME = /fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|www\.gstatic\.com\/firebasejs/;

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === location.origin;
  if (!same && !RUNTIME.test(url.href)) return; // APIs (weather, Firestore) go straight to the network
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: same });
      const net = fetch(req)
        .then((res) => {
          if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
          return res;
        })
        .catch(() => hit);
      return hit || net;
    }),
  );
});
