// IMPORTANT:
// - This app is used both on GitHub Pages and on Lovable preview domains.
// - Aggressive runtime caching on preview domains can lead to mixed bundles
//   (e.g. React / deps chunks from different builds), which may trigger
//   "Invalid hook call" / "Cannot read properties of null (reading 'useRef')".
// - Therefore, we ONLY enable caching on GitHub Pages.

const IS_GITHUB_PAGES = self.location.hostname.endsWith('.github.io');

// Bump cache version to ensure old caches are dropped after SW updates.
const CACHE_NAME = 'ai-image-editor-v2';
const BASE_PATH = '/pwa_aiImage/';

const STATIC_ASSETS = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'manifest.json',
];

self.addEventListener('install', (event) => {
  // On non-GitHub Pages hosts (e.g. Lovable preview), don't cache anything.
  if (!IS_GITHUB_PAGES) {
    self.skipWaiting();
    return;
  }

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          // Delete everything except the current cache (and even that on non-GH pages)
          .filter((name) => !IS_GITHUB_PAGES || name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(async () => {
      // On Lovable preview domains, unregister so it never controls the app.
      if (!IS_GITHUB_PAGES) {
        await self.registration.unregister();
      }
    })
  );

  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Never cache on non-GitHub Pages hosts.
  if (!IS_GITHUB_PAGES) return;

  const request = event.request;
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Skip external requests
  if (!request.url.startsWith(self.location.origin)) return;
  
  // Skip API and AI model requests
  if (request.url.includes('/api/') || request.url.includes('huggingface')) return;
  
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(request).then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        // Clone and cache the response
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        
        return response;
      }).catch(() => {
        // Return cached index.html for navigation requests
        if (request.mode === 'navigate') {
          return caches.match(BASE_PATH + 'index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
