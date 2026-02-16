// Wired-In Service Worker for push notifications
// Handles background notification display when the tab is not focused

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Wired-In', {
      body: data.body || 'New content matches your saved search',
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      data: { url: data.url || '/' },
      tag: data.tag || 'wiredin-notification',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.navigate(event.notification.data.url);
          return;
        }
      }
      // Open new window if none exists
      return clients.openWindow(event.notification.data.url);
    })
  );
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
