// Fiado — offline cache.
// To ship an update: change the app files, bump VERSION, push. Open apps then show "Atualizar app".
// Your data lives in localStorage and is never touched by updates.
const VERSION = 'fiado-v13';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  // Fetch fresh copies (skip the HTTP cache) and wait: the page decides when to switch.
  e.waitUntil(caches.open(VERSION).then(c =>
    Promise.all(SHELL.map(u => fetch(u, { cache: 'reload' }).then(r => { if (!r.ok) throw new Error(u); return c.put(u, r); })))
  ));
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // The page: always the version this worker shipped, so it only changes after "Atualizar app".
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.open(VERSION).then(c => c.match('./index.html')).then(hit => hit || fetch(req))
    );
    return;
  }

  const sameOrigin = url.origin === location.origin;
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !font) return;
  if (sameOrigin && url.pathname.endsWith('/sw.js')) return;

  e.respondWith(
    caches.open(VERSION).then(cache =>
      cache.match(req, { ignoreSearch: sameOrigin }).then(hit => {
        if (hit && sameOrigin) return hit;
        const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      })
    )
  );
});
