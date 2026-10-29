/* ── Service Worker — Offline + Push Notifications ── */
const CACHE = 'hydrate-v1';
const ASSETS = ['/', '/index.html', '/app.js', '/style.css',
  '/f2.png', '/f3.png', '/f4.png', '/f5.png', '/icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

/* Push notification received */
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(data.title || '💧 Water Reminder!', {
    body: data.body || "It's time to drink water! Stay hydrated 🌊",
    icon: '/icon.png',
    badge: '/icon.png',
    vibrate: [200, 100, 200],
    tag: 'water-reminder',
    renotify: true,
    actions: [
      { action: 'drank', title: '✅ I drank!' },
      { action: 'snooze', title: '⏰ 10 min later' }
    ]
  }));
});

/* Notification click */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'drank' || e.action === 'snooze') {
    self.clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length) clients[0].postMessage({ action: e.action });
      else self.clients.openWindow('/');
    });
  } else {
    self.clients.openWindow('/');
  }
});

/* Timer-based reminders (when app open in background) */
self.addEventListener('message', e => {
  if (e.data.type === 'SCHEDULE_REMINDER') {
    const delay = e.data.delay || 3600000;
    setTimeout(() => {
      self.registration.showNotification('💧 Water Reminder!', {
        body: e.data.message || "Time to drink water! Stay hydrated 🌊",
        icon: '/icon.png',
        badge: '/icon.png',
        vibrate: [200, 100, 200],
        tag: 'water-reminder',
        renotify: true,
        actions: [
          { action: 'drank', title: '✅ I drank!' },
          { action: 'snooze', title: '⏰ 10 min later' }
        ]
      });
    }, delay);
  }
});
