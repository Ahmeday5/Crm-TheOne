/* eslint-disable */
/**
 * Firebase Cloud Messaging service worker — handles BACKGROUND push
 * notifications (when the app tab is closed or not focused).
 *
 * IMPORTANT: a service worker can't read Angular's `environment`, so the web
 * config below must be filled with the SAME values you put in
 * `environment.firebase` (the `vapidKey` is NOT needed here). Until it's
 * filled, background notifications stay disabled (foreground still works once
 * the app config is set).
 *
 * Keep the firebasejs version in sync with the installed `firebase` package.
 */
importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: 'AIzaSyD3jrSMr364-FbMcn1uT1fEcrp6NJZJ_Ik',
  authDomain: 'theonecrm-c6fc5.firebaseapp.com',
  projectId: 'theonecrm-c6fc5',
  storageBucket: 'theonecrm-c6fc5.firebasestorage.app',
  messagingSenderId: '577955000613',
  appId: '1:577955000613:web:54dca1c7b8f6d278e96acc',
};

if (firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const notification = payload.notification || {};
    const title = notification.title || 'إشعار جديد';
    const options = {
      body: notification.body || '',
      icon: '/assets/img/logo.png',
      badge: '/assets/img/logo.png',
      dir: 'rtl',
      data: payload.data || {},
    };
    self.registration.showNotification(title, options);
  });
}

// Focus / open the app when a notification is clicked.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/notifications');
    }),
  );
});
