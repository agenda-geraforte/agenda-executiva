// Service Worker Básico para ativar a instalação do PWA
self.addEventListener("install", (e) => {
  console.log("[Service Worker] Aplicativo Instalado!");
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  console.log("[Service Worker] Ativado e pronto para rodar.");
});

self.addEventListener("fetch", (e) => {
  // Por enquanto, apenas deixa a internet funcionar normalmente.
  // No futuro, podemos adicionar cache aqui para o app funcionar sem internet.
});
