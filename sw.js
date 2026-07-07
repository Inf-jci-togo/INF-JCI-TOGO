const CACHE_NAME = 'inf-jci-v67';
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
  './assets/icon-512.png',
  './textes-raw.js'
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

// Fetch : network-first pour index.html, cache-first pour les assets
self.addEventListener('fetch', e => {
  const url = e.request.url;
  const isHTML = url.endsWith('/') || url.endsWith('/index.html') || url.includes('INF-JCI-TOGO/') && !url.includes('.');

  if (isHTML) {
    // Network-first pour la page principale → toujours la dernière version
    e.respondWith(
      fetch(e.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
  } else {
    // Cache-first pour images, manifest, etc. → rapide et hors ligne
    e.respondWith(
      caches.match(e.request).then(cached => {
        return cached || fetch(e.request).catch(() => caches.match('./index.html'));
      })
    );
  }
});
