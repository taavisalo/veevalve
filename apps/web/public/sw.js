const CACHE_VERSION = 'v3';
const APP_SHELL_CACHE = `veevalve-app-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `veevalve-static-${CACHE_VERSION}`;
const NAVIGATION_NETWORK_TIMEOUT_MS = 450;
const APP_SHELL_URLS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/apple-startup/veevalve-640x1136.png',
  '/apple-startup/veevalve-750x1334.png',
  '/apple-startup/veevalve-828x1792.png',
  '/apple-startup/veevalve-1125x2436.png',
  '/apple-startup/veevalve-1170x2532.png',
  '/apple-startup/veevalve-1179x2556.png',
  '/apple-startup/veevalve-1206x2622.png',
  '/apple-startup/veevalve-1242x2208.png',
  '/apple-startup/veevalve-1242x2688.png',
  '/apple-startup/veevalve-1284x2778.png',
  '/apple-startup/veevalve-1290x2796.png',
  '/apple-startup/veevalve-1320x2868.png',
  '/apple-startup/veevalve-1536x2048.png',
  '/apple-startup/veevalve-1620x2160.png',
  '/apple-startup/veevalve-1640x2360.png',
  '/apple-startup/veevalve-1668x2224.png',
  '/apple-startup/veevalve-1668x2388.png',
  '/apple-startup/veevalve-2048x2732.png',
];
const STATIC_PATHS = new Set(APP_SHELL_URLS.filter((url) => url !== '/'));

const isCacheableResponse = (response) => {
  return response && response.ok && response.type !== 'opaque';
};

const getCacheableNetworkResponse = async (request) => {
  const response = await fetch(request);
  if (!isCacheableResponse(response)) {
    return response;
  }

  return response;
};

const cacheResponse = async (cacheName, request, response) => {
  if (!isCacheableResponse(response)) {
    return;
  }

  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
};

const findCachedNavigation = async (request) => {
  const cache = await caches.open(APP_SHELL_CACHE);
  const exactMatch = await cache.match(request);
  if (exactMatch) {
    return exactMatch;
  }

  return cache.match('/');
};

const timeout = (durationMs) =>
  new Promise((resolve) => {
    setTimeout(() => resolve(undefined), durationMs);
  });

const handleNavigationRequest = async (event) => {
  const request = event.request;
  const networkResponsePromise = (async () => {
    const preloadResponse = await event.preloadResponse;
    const response = preloadResponse || (await getCacheableNetworkResponse(request));
    await cacheResponse(APP_SHELL_CACHE, request, response);

    const requestUrl = new URL(request.url);
    if (requestUrl.origin === self.location.origin && requestUrl.pathname === '/') {
      await cacheResponse(APP_SHELL_CACHE, '/', response);
    }

    return response;
  })();

  event.waitUntil(networkResponsePromise.catch(() => undefined));

  try {
    const networkResponse = await Promise.race([
      networkResponsePromise,
      timeout(NAVIGATION_NETWORK_TIMEOUT_MS),
    ]);
    if (networkResponse) {
      return networkResponse;
    }
  } catch {
    // Fall back to a cached shell below.
  }

  const cachedResponse = await findCachedNavigation(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    return await networkResponsePromise;
  } catch (error) {
    const fallbackResponse = await findCachedNavigation(request);
    if (fallbackResponse) {
      return fallbackResponse;
    }

    throw error;
  }
};

const handleStaticRequest = async (event) => {
  const request = event.request;
  const cachedResponse = await caches.match(request);
  const networkResponsePromise = getCacheableNetworkResponse(request).then(async (response) => {
    await cacheResponse(STATIC_CACHE, request, response);
    return response;
  });

  event.waitUntil(networkResponsePromise.catch(() => undefined));

  if (cachedResponse) {
    return cachedResponse;
  }

  return networkResponsePromise;
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((cacheNames) =>
          Promise.all(
            cacheNames
              .filter((cacheName) => ![APP_SHELL_CACHE, STATIC_CACHE].includes(cacheName))
              .map((cacheName) => caches.delete(cacheName)),
          ),
        ),
      self.registration.navigationPreload ? self.registration.navigationPreload.enable() : null,
      self.clients.claim(),
    ]),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(event));
    return;
  }

  if (requestUrl.pathname.startsWith('/_next/static/') || STATIC_PATHS.has(requestUrl.pathname)) {
    event.respondWith(handleStaticRequest(event));
  }
});

self.addEventListener('push', (event) => {
  if (!event) {
    return;
  }

  const payload = (() => {
    try {
      return event.data ? event.data.json() : null;
    } catch {
      return null;
    }
  })();

  const title =
    payload && typeof payload.title === 'string' && payload.title.trim().length > 0
      ? payload.title.trim()
      : 'VeeValve';
  const body =
    payload && typeof payload.body === 'string' && payload.body.trim().length > 0
      ? payload.body.trim()
      : '';
  const tag =
    payload && typeof payload.tag === 'string' && payload.tag.trim().length > 0
      ? payload.tag.trim()
      : undefined;
  const url =
    payload && typeof payload.url === 'string' && payload.url.startsWith('/')
      ? payload.url
      : '/';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      data: { url },
      renotify: false,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    event.notification &&
    event.notification.data &&
    typeof event.notification.data.url === 'string' &&
    event.notification.data.url.startsWith('/')
      ? event.notification.data.url
      : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});
