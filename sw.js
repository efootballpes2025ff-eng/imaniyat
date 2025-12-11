const CACHE_VERSION = 'v1';
const CACHE_NAMES = {
  core: `islamic-app-core-${CACHE_VERSION}`,
  images: `islamic-app-images-${CACHE_VERSION}`,
  fonts: `islamic-app-fonts-${CACHE_VERSION}`,
  api: `islamic-app-api-${CACHE_VERSION}`
};

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

const EXTERNAL_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;600;700&family=Tajawal:wght@400;500;700&display=swap'
];

const ICON_ASSETS = [
  './icon-192.png',
  './icon-512.png'
];

const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate'
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAMES.core).then((cache) => {
        return cache.addAll(CORE_ASSETS).catch((error) => {
          console.warn('Failed to cache core assets:', error);
        });
      }),
      caches.open(CACHE_NAMES.fonts).then((cache) => {
        return cache.addAll(EXTERNAL_ASSETS).catch((error) => {
          console.warn('Failed to cache external assets:', error);
        });
      }),
      caches.open(CACHE_NAMES.images).then((cache) => {
        return cache.addAll(ICON_ASSETS).catch((error) => {
          console.warn('Failed to cache icon assets:', error);
        });
      })
    ]).then(() => {
      self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          const isOldVersion = !Object.values(CACHE_NAMES).includes(cacheName);
          if (isOldVersion) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (url.origin === location.origin) {
    if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i)) {
      event.respondWith(cacheFirstStrategy(request, CACHE_NAMES.images));
    } else if (url.pathname === '/index.html' || url.pathname === '/') {
      event.respondWith(networkFirstStrategy(request, CACHE_NAMES.core));
    } else {
      event.respondWith(cacheFirstStrategy(request, CACHE_NAMES.core));
    }
  } else if (isExternalAsset(url.href)) {
    event.respondWith(staleWhileRevalidateStrategy(request, CACHE_NAMES.fonts));
  } else {
    event.respondWith(networkFirstStrategy(request, CACHE_NAMES.api));
  }
});

function isExternalAsset(url) {
  return EXTERNAL_ASSETS.some(asset => url.includes(asset));
}

function cacheFirstStrategy(request, cacheName) {
  return caches.match(request).then((response) => {
    if (response) {
      return response;
    }
    return fetch(request).then((response) => {
      if (!response || response.status !== 200 || response.type === 'error') {
        return response;
      }
      const responseToCache = response.clone();
      caches.open(cacheName).then((cache) => {
        cache.put(request, responseToCache);
      });
      return response;
    }).catch(() => {
      return caches.match(request).then((cachedResponse) => {
        return cachedResponse || createOfflineResponse();
      });
    });
  });
}

function networkFirstStrategy(request, cacheName) {
  return fetch(request).then((response) => {
    if (!response || response.status !== 200) {
      return response;
    }
    const responseToCache = response.clone();
    caches.open(cacheName).then((cache) => {
      cache.put(request, responseToCache);
    });
    return response;
  }).catch(() => {
    return caches.match(request).then((response) => {
      return response || createOfflineResponse();
    });
  });
}

function staleWhileRevalidateStrategy(request, cacheName) {
  return caches.match(request).then((cachedResponse) => {
    const fetchPromise = fetch(request).then((response) => {
      if (!response || response.status !== 200) {
        return response;
      }
      const responseToCache = response.clone();
      caches.open(cacheName).then((cache) => {
        cache.put(request, responseToCache);
      });
      return response;
    }).catch(() => {
      return cachedResponse;
    });
    return cachedResponse || fetchPromise;
  });
}

function createOfflineResponse() {
  return new Response(
    '<!DOCTYPE html>' +
    '<html lang="ar" dir="rtl">' +
    '<head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>بدون اتصال - إيمانيات</title>' +
    '<style>' +
    'body { font-family: Arial, sans-serif; background-color: #006400; color: #ffd700; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; text-align: center; }' +
    '.offline-container { max-width: 400px; padding: 20px; }' +
    'h1 { font-size: 28px; margin-bottom: 10px; }' +
    'p { font-size: 16px; line-height: 1.6; }' +
    '</style>' +
    '</head>' +
    '<body>' +
    '<div class="offline-container">' +
    '<h1>📴 بدون اتصال بالإنترنت</h1>' +
    '<p>يرجى التحقق من اتصالك بالشبكة والمحاولة مرة أخرى.</p>' +
    '</div>' +
    '</body>' +
    '</html>',
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/html; charset=utf-8'
      })
    }
  );
}

// Combined message handler
self.addEventListener('message', async event => { // Make the handler async
  if (event.data) {
    const registration = await self.registration;
    switch (event.data.type) {
      case 'SKIP_WAITING':
        self.skipWaiting();
        break;
      case 'SCHEDULE_NOTIFICATIONS':
        if (event.data.timings) {
          schedulePrayerNotifications(event.data.timings);
        }
        break;
      case 'CLEAR_NOTIFICATIONS':
        console.log('Clearing scheduled notifications at user request.');
        const notifications = await registration.getNotifications({ tag: /^adhan-/ });
        notifications.forEach(notification => notification.close());
        console.log(`Cleared ${notifications.length} scheduled notifications.`);
        break;
      default:
        console.log('Received unhandled message:', event.data);
        break;
    }
  }
});

// --- Scheduled Notifications for Adhan ---

async function schedulePrayerNotifications(timings) {
  if (Notification.permission !== 'granted') {
    console.log('Notification permission not granted. Client should request permission.');
    return;
  }

  if (!('showTrigger' in Notification.prototype)) {
      console.warn('Notification Triggers are not supported by this browser. Scheduled notifications will not work.');
      // Optionally, message the client back to inform the user.
      return;
  }

  const registration = await self.registration;
  
  // Clear any previously scheduled prayer notifications to avoid duplicates
  const notifications = await registration.getNotifications({ tag: /^adhan-/ });
  notifications.forEach(notification => notification.close());
  console.log(`Cleared ${notifications.length} old scheduled prayer notifications.`);

  const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const prayerNames = {
      Fajr: 'الفجر',
      Dhuhr: 'الظهر',
      Asr: 'العصر',
      Maghrib: 'المغرب',
      Isha: 'العشاء'
  };

  for (const prayer of prayers) {
    if (!timings[prayer]) continue; // Skip if a prayer time is missing

    const timeString = timings[prayer].split(' ')[0]; // e.g., "17:45"
    const [hours, minutes] = timeString.split(':').map(Number);
    
    const now = new Date();
    let notificationTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);

    // If the prayer time for today has already passed, schedule it for tomorrow
    if (notificationTime < now) {
      notificationTime.setDate(notificationTime.getDate() + 1);
    }

    try {
      await registration.showNotification(`حان الآن موعد أذان ${prayerNames[prayer]}`, {
        tag: `adhan-${prayer}-${notificationTime.getTime()}`, // Unique tag to prevent collisions
        body: 'اضغط لفتح التطبيق',
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        vibrate: [200, 100, 200, 100, 200], // Add a vibration pattern
        showTrigger: new TimestampTrigger(notificationTime.getTime()),
        data: {
            url: self.location.origin, // URL to open on click
        }
      });
      console.log(`Scheduled notification for ${prayer} at ${notificationTime.toLocaleString()}`);
    } catch (e) {
      console.error(`Error scheduling notification for ${prayer}: `, e);
    }
  }
}

// --- Push Notifications (from server) ---

self.addEventListener('push', event => {
  let data = {title: 'إشعار جديد', body: 'لديك رسالة جديدة من إيمانيات', url: '/'};
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      // If data is not JSON, just show it as plain text.
      console.warn('Push data is not JSON, treating as text.');
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    vibrate: [100, 50, 100], // Vibrate pattern for mobile
    data: {
      url: data.url || self.location.origin, // Fallback URL
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// --- Notification Click Handler ---

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const urlToOpen = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // If a window for the app is already open, focus it.
      for (const client of clientList) {
        if (new URL(client.url).pathname === new URL(urlToOpen, self.location.origin).pathname && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window.
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
