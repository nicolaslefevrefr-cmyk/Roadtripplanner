/* RoadTrip Planner — Service Worker */
const CACHE = 'roadtrip-v8';
const CORE = [
  './',
  './index.html',
  './style.css',
  './config.js',
  './ui.js',
  './zones.js',
  './visibility.js',
  './pois.js',
  './gps.js',
  './events.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Nunito:wght@400;600;700;800&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Network-first for tile/routing APIs (always need fresh data)
  const url = e.request.url;
  if (url.includes('openstreetmap.org') ||
      url.includes('osrm.org') ||
      url.includes('arcgisonline.com') ||
      url.includes('nominatim') ||
      url.includes('wikipedia.org') ||
      url.includes('googleapis.com/drive') ||
      url.includes('accounts.google.com')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  // Cache-first for app shell
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
      if (resp && resp.status === 200 && e.request.method === 'GET') {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return resp;
    }))
  );
});
