const CACHE_NAME = 'spotify-app-shell-v1';
const AUDIO_CACHE = 'spotify-audio-v1';

// Static assets to cache immediately so the app frame opens offline
const STATIC_ASSETS = [
  '/',
  '/index.html',
  'https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg'
];

// 1. Install Event: Pre-cache the basic App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching static app shell');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// 2. Activate Event: Clean up old or outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== AUDIO_CACHE) {
            console.log('[Service Worker] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  // Take control of all open client tabs immediately
  self.clients.claim();
});

// 3. Fetch Event: Intercept network requests & serve cached content when offline
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strategy A: Audio Stream Requests (Cache First, fallback to Network)
  if (
    url.pathname.endsWith('.m4a') || 
    url.pathname.includes('googlevideo') || 
    event.request.destination === 'audio'
  ) {
    event.respondWith(
      caches.open(AUDIO_CACHE).then(async (cache) => {
        // Check if the audio file exists in our audio cache
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // Otherwise attempt to fetch from network and auto-cache if successful
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          return new Response('Audio track unavailable offline', {
            status: 503,
            statusText: 'Offline Audio Not Found'
          });
        }
      })
    );
    return;
  }

  // Strategy B: Standard App Files / Pages (Cache First, fallback to Network)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).catch(() => {
        // If navigating to a page while offline, fall back to cached index.html
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
