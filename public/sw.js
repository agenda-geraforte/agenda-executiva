self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Passa as requisições direto sem interceptar com cache problemático
  event.respondWith(fetch(event.request));
});