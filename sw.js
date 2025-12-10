const CACHE_NAME = 'islamic-app-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;600;700&family=Tajawal:wght@400;500;700&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()) // Force activation
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});

// --- Scheduled Notifications for Adhan ---

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATIONS') {
    const timings = event.data.timings;
    schedulePrayerNotifications(timings);
  }
});

async function schedulePrayerNotifications(timings) {
  if (Notification.permission !== 'granted') {
    console.log('Notification permission not granted.');
    return;
  }

  if (!('showTrigger' in Notification.prototype)) {
      console.warn('Notification Triggers are not supported by this browser.');
      // Optionally, message the client back to inform the user.
      return;
  }

  const registration = await self.registration;
  
  // Clear any previously scheduled prayer notifications
  const notifications = await registration.getNotifications({ tag: 'adhan-' });
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
    const timeString = timings[prayer].split(' ')[0]; // e.g., "17:45"
    const [hours, minutes] = timeString.split(':').map(Number);
    
    const now = new Date();
    let notificationTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);

    // If the prayer time is in the past for today, schedule it for tomorrow
    if (notificationTime < now) {
      notificationTime.setDate(notificationTime.getDate() + 1);
    }

    try {
      await registration.showNotification(`حان الآن موعد أذان ${prayerNames[prayer]}`, {
        tag: `adhan-${prayer}`, // Use a tag prefix to manage these notifications
        body: 'اضغط لفتح التطبيق',
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        showTrigger: new TimestampTrigger(notificationTime.getTime()),
        data: {
            url: self.location.origin, // URL to open on click
        }
      });
      console.log(`Scheduled notification for ${prayer} at ${notificationTime.toLocaleString()}`);
    } catch (e) {
      console.error(`Error scheduling notification for ${prayer}:`, e);
    }
  }
}

// --- Push Notifications (from server, if ever used) ---

self.addEventListener('push', event => {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: 'icon-192.png',
    badge: 'icon-192.png'
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
        if (client.url === urlToOpen && 'focus' in client) {
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
