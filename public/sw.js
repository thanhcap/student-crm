// V3 F81/F82 — minimal service worker: app shell + static assets cached so the
// app opens (read-only) without a connection. Supabase API calls are NEVER
// cached (stale CRM data is worse than no data — the app renders its
// localStorage snapshot instead when offline).
const SHELL_CACHE = 'crm-shell-v1';
const STATIC_CACHE = 'crm-static-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(['/'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => ![SHELL_CACHE, STATIC_CACHE].includes(k)).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return; // never touch Supabase/external

  // navigations: network first, shell fallback
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(r => { caches.open(SHELL_CACHE).then(c => c.put('/', r.clone())); return r; })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // hashed static assets: cache first
  if (url.pathname.startsWith('/_next/static/') || url.pathname === '/favicon.png') {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
        caches.open(STATIC_CACHE).then(c => c.put(e.request, r.clone()));
        return r;
      }))
    );
  }
});
