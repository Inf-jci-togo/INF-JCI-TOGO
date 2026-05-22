const CACHE_NAME = 'inf-jci-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/logo-inf-officiel.png',
  './assets/logo-blanc.png',
  './assets/logo-filigrane.png',
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

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.w