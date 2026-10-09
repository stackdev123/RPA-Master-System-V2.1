const CACHE_NAME = 'rpa-master-shell-v4';
const DATA_CACHE_NAME = 'rpa-master-data-v4';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo trial.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  const allowedCaches = [CACHE_NAME, DATA_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (!allowedCaches.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only intercept GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip Vite internal / HMR / dep chunks / source modules so Vite dev server never mixes React instances
  if (
    url.protocol === 'chrome-extension:' ||
    url.pathname.includes('/@vite') ||
    url.pathname.includes('/@react-refresh') ||
    url.pathname.includes('/node_modules/') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.js') ||
    url.search.includes('t=') ||
    url.search.includes('v=')
  ) {
    return;
  }

  // 1. Supabase REST GET queries or local /api/ GET queries -> Network First, Fallback to Data Cache
  if (url.hostname.includes('supabase.co') || url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(DATA_CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'X-Offline-Cache': 'empty' }
          });
        })
    );
    return;
  }

  // 2. HTML Navigation requests -> Network First, Fallback to cached /index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(async () => {
          return (await caches.match(request)) || (await caches.match('/index.html'));
        })
    );
    return;
  }

  // 3. Static Assets -> Network First, Fallback to Cache when offline
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;
        throw new Error('Offline and not in cache');
      })
  );
});
