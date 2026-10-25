// Warriors Pitching offline helper.
// Pages and plan files always try the network first, so athletes get your newest version
// whenever they have signal, and fall back to the saved copy when they don't.
const CACHE = 'warriors-v2';
const CORE = ['./', './index.html', './faq.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameSite = url.origin === self.location.origin;
  if (sameSite) {
    // network first, saved copy when offline
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
  } else {
    // styles, icons and fonts from CDNs: saved copy first, refresh in the background
    e.respondWith(caches.match(req).then(cached => {
      const net = fetch(req).then(res => { caches.open(CACHE).then(c => c.put(req, res.clone())); return res; }).catch(() => cached);
      return cached || net;
    }));
  }
});
