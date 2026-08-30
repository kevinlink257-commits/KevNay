
const CACHE_NAME = 'inverkev-pwa-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Network first for CDN, cache first for local assets
  if (e.request.url.includes('cdn.jsdelivr.net') || e.request.url.includes('googleapis')) {
    e.respondWith(fetch(e.request).catch(()=> caches.match(e.request)));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(resp => {
        // cache dynamic
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(e.request, resp.clone());
          return resp;
        });
      }).catch(()=> cached);
    })
  );
});
