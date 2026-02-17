self.addEventListener('install', () => {
  void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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
