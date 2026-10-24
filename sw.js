const VERSION = 'v1';
const SHELL = `calleviva-shell-${VERSION}`;
const DYNAMIC = `calleviva-dyn-${VERSION}`;
const ASSETS = ['./', './index.html', './css/styles.css', './js/app.js', './js/db.js', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png'];

// INSTALL: precarga del App Shell
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

// ACTIVATE: limpia cachés de versiones anteriores
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => ![SHELL, DYNAMIC].includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// FETCH: estrategias por tipo de recurso
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Navegación: network-first con respaldo al shell
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }
  // Recursos estáticos propios: cache-first
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => guardar(DYNAMIC, req, res))));
    return;
  }
  // Recursos externos (API de direcciones): network-first con caché dinámica
  e.respondWith(fetch(req).then(res => guardar(DYNAMIC, req, res)).catch(() => caches.match(req)));
});

function guardar(name, req, res) {
  if (res && (res.ok || res.type === 'opaque')) { const copia = res.clone(); caches.open(name).then(c => c.put(req, copia)); }
  return res;
}

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(list => list.length ? list[0].focus() : clients.openWindow('./#/lista')));
});
