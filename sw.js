// Awqat service worker: app shell offline, network-first for data.
const V = 'awqat-v13';
const SHELL = [
  './', 'index.html', 'config.js', 'css/app.css', 'manifest.webmanifest',
  'js/app.js', 'js/home.js', 'js/pages.js', 'js/prayer.js', 'js/store.js', 'js/ui.js', 'js/net.js', 'js/alarms.js', 'js/ocr.js', 'js/hw.js', 'data/hwnet.json', 'js/plan.js',
  'data/content.js', 'data/places.js', 'vendor/adhan.js', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-180.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (same || font) {
    // stale-while-revalidate for the shell and fonts
    e.respondWith(caches.open(V).then(async (c) => {
      const hit = await c.match(req, { ignoreSearch: same });
      const net = fetch(req).then((r) => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => cs.length ? cs[0].focus() : self.clients.openWindow('./')));
});
