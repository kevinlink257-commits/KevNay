
const CACHE_NAME='kevnay-pwa-v1';
const ASSETS=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png','./icon-180.png'];
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e=>{
  if(e.request.url.includes('cdn.jsdelivr')||e.request.url.includes('cdnjs.cloudflare')||e.request.url.includes('supabase')){
    e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(resp=>{
    return caches.open(CACHE_NAME).then(cache=>{cache.put(e.request, resp.clone()); return resp;});
  }).catch(()=>cached)));
});
