const CACHE_NAME = 'inf-jci-v15';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/logo-inf-officiel.png',
  './assets/logo-blanc.png',
  './assets/logo-filigrane.png',
  './assets/logo-light-service.png',
  './assets/kokouvi-djiwonou.jpeg',
  './assets/jean-pierre-agonglovi.jpeg',
  './assets/anne-solange-ameganvi.jpeg',
  './assets/biova-mensah.jpg',
  './assets/ekoue-ayi-gbovey.jpg',
  './assets/kossitse-mensah.jpg',
  './assets/pikliwe-kassang.jpeg',
  './assets/defi-mondedji.jpeg',
  './assets/hyppolite-djoka.jpeg',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

// Installation : mise en cache + skipWaiting dans la promesse
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activation : nettoyage anciens caches → claim → rechargement automatique
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => {
        clients.forEach(c => {
          c.postMessage({ type: 'SW_UPDATED' });
          try { c.navigate(c.url); } catch (e) {}
        });
      })
  );
});

// Fetch : cache-first (fonctionne hors ligne)
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).catch(() => caches.match('./index.html'));
    })
  );
});
