// ============================================================================
// Jackpotlo Pro - Production Service Worker (PWA & Offline SPA Resilience)
// ============================================================================

const CACHE_NAME = 'lottotrack-pro-v10';
const PRECACHE_SHELL = ['/', '/app/', '/manifest.json'];
// Two HTML shells: the POS under /app (and /admin), the marketing + sign-in site everywhere else
const shellKeyFor = pathname => (/^\/(app|admin)(\/|$)/.test(pathname) ? '/app/' : '/');

// 1. Install Event: Precache the SPA app shell and activate immediately
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Evict all older cache versions and claim clients
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(k => {
          if (k !== CACHE_NAME) {
            return caches.delete(k);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Safe Network-First Strategy with Guaranteed Response
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // --------------------------------------------------------------------------
  // Rule A: Bypass service worker entirely for local development & tunnels
  // --------------------------------------------------------------------------
  if (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.port === '5173' ||
    url.pathname.includes('/src/') ||
    url.hostname.includes('loca.lt')
  ) {
    return; // Direct browser native pass-through
  }

  // --------------------------------------------------------------------------
  // Rule B: Never intercept non-GET requests (POST /api/auth/login, etc.)
  // --------------------------------------------------------------------------
  if (request.method !== 'GET') {
    return; // Cache API only supports GET/HEAD; let browser handle natively
  }

  // --------------------------------------------------------------------------
  // Rule C: Never intercept or cache backend API calls (/api/*)
  // Ensures authenticated tokens, database responses & health checks are real-time
  // --------------------------------------------------------------------------
  if (url.pathname.startsWith('/api/')) {
    return; // Pass through directly to Netlify proxy / Enzonic backend
  }

  // --------------------------------------------------------------------------
  // Rule D: Cross-origin assets (e.g. Google Fonts)
  // --------------------------------------------------------------------------
  if (url.origin !== self.location.origin) {
    // Only cache successful font / styling responses, never block on failure
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response('', { status: 408, statusText: 'Request Timeout' });
      })
    );
    return;
  }

  // --------------------------------------------------------------------------
  // Rule E: Navigation Requests (SPA Routing: /, /admin, /admin#admin, etc.)
  // Must ALWAYS return a valid HTML Response. Never return undefined.
  // --------------------------------------------------------------------------
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // If we received a valid 200 response, clone and update /index.html cache
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(shellKeyFor(url.pathname), clone)).catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          // Offline / network failure fallback: serve cached SPA shell
          const cachedIndex = await caches.match(shellKeyFor(url.pathname));
          if (cachedIndex) return cachedIndex;

          // Safe minimal fallback HTML response if cache is empty (NEVER undefined!)
          return new Response(
            '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Jackpotlo</title></head><body style="margin:0;background:#0b0f19;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><div style="text-align:center;"><h2>Offline</h2><p>Please check your connection and reload.</p></div></body></html>',
            {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            }
          );
        })
    );
    return;
  }

  // --------------------------------------------------------------------------
  // Rule F: Same-Origin Static Assets (JS bundles, CSS, icons, images)
  // Network-first with cache fallback. Guarantees a valid Response is returned.
  // --------------------------------------------------------------------------
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone)).catch(() => {});
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        // Guaranteed valid fallback Response (Never 503 or undefined)
        const path = url.pathname.toLowerCase();
        if (path.endsWith('.js') || path.endsWith('.mjs')) {
          return new Response('/* offline fallback */', {
            status: 200,
            headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
          });
        }
        if (path.endsWith('.css')) {
          return new Response('/* offline fallback */', {
            status: 200,
            headers: { 'Content-Type': 'text/css; charset=utf-8' }
          });
        }
        return new Response('', {
          status: 404,
          statusText: 'Not Found'
        });
      })
  );
});
