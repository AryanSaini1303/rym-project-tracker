self.addEventListener('push', function (event) {
  if (!event.data) return;

  const showNotification = async () => {
    // 1. Check if the user currently has the app open and focused
    const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    let isFocused = false;
    for (let client of windowClients) {
      if (client.focused) {
        isFocused = true;
        break;
      }
    }

    // 2. If the app is open, DO NOT show a system notification (the app will show a toast instead)
    if (isFocused) {
      return;
    }

    // 3. Otherwise, the app is in the background, so show the system notification
    try {
      const data = event.data.json();
      const options = {
        body: data.body || '',
        icon: data.icon || '/pwa-192x192.png',
        badge: data.badge || '/pwa-192x192.png',
        data: { url: data.url || '/' }
      };
      await self.registration.showNotification(data.title || 'New Notification', options);
    } catch (e) {
      await self.registration.showNotification('New Notification', {
        body: event.data.text(),
        icon: '/pwa-192x192.png'
      });
    }
  };

  event.waitUntil(showNotification());
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((windowClients) => {
        for (var i = 0; i < windowClients.length; i++) {
          var client = windowClients[i];
          if (client.url.includes(event.notification.data.url) && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
    );
  }
});
