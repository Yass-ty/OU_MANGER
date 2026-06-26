// Service Worker basique pour l'installation PWA
const CACHE_NAME = 'oom-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Optionnel : Gérer la mise en cache si besoin
  // Ici on laisse juste le fetch passer pour rendre l'app "installable"
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
