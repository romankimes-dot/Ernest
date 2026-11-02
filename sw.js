// Service worker : hors ligne. Code servi depuis le cache de sa version ; données (data/) cache d'abord puis réseau.
const VERSION = 'ernest-v23';
const CORE = ['./', './index.html', './manifest.webmanifest', './css/app.css', './js/app.js', './js/model.js', './js/store.js', './js/bridge.js', './js/ernest.js', './js/garden2d.js', './js/cards.js', './js/icons.js', './js/garden3d.js', './js/cottage3d.js', './serre3d.html', './js/serre3d.js', './vendor/three.module.min.js', './vendor/OrbitControls.js', './icons/icon-192.png', './icons/icon-512.png',
  './data/ernest/repliques.json', './data/cartes/botanique.json', './data/cartes/profession.json', './data/cartes/tips.json', './data/cartes/blagues.json', './data/cartes/encouragements.json', './data/cartes/feuilleton.json'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return;
  if (url.pathname.includes('/data/')) {
    e.respondWith(caches.open(VERSION).then(async (c) => { const hit = await c.match(e.request); const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit); return hit || net; }));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
