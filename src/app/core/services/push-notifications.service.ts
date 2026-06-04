import { Injectable, NgZone, inject } from '@angular/core';
import type { Messaging } from 'firebase/messaging';
import { environment } from '../../../environments/environment';
import { NotificationsService } from './notifications.service';
import { NotificationsStore } from './notifications.store';

/**
 * Firebase Cloud Messaging (FCM) integration — real-time push notifications.
 *
 * Flow:
 *   1. `init()` boots Firebase, registers the messaging service worker, asks
 *      for browser permission, fetches this device's FCM token and registers
 *      it with the backend (`register-fcm-token`).
 *   2. Foreground pushes (`onMessage`) refresh the badge + bell list instantly,
 *      so the UI updates the moment anything happens — no manual refresh.
 *   3. Background pushes are shown as OS notifications by the service worker.
 *   4. `disable()` (on logout) unregisters the token both server- and
 *      client-side.
 *
 * Everything is lazy (`import()`) and guarded: when `environment.firebase`
 * isn't configured the service is inert and the app falls back to polling.
 */
@Injectable({ providedIn: 'root' })
export class PushNotificationsService {
  private readonly notifications = inject(NotificationsService);
  private readonly store = inject(NotificationsStore);
  private readonly zone = inject(NgZone);

  private messaging: Messaging | null = null;
  private started = false;

  /** True once the tenant filled the Firebase web config + VAPID key. */
  get isConfigured(): boolean {
    const fb = environment.firebase;
    return !!fb && !!fb.apiKey && !!fb.vapidKey;
  }

  async init(): Promise<void> {
    if (this.started || !this.isConfigured) return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return;

    this.started = true;
    try {
      const { isSupported, getMessaging, getToken, onMessage } = await import(
        'firebase/messaging'
      );
      if (!(await isSupported())) {
        this.started = false;
        return;
      }

      const { initializeApp, getApps } = await import('firebase/app');
      const cfg = environment.firebase;
      const app = getApps().length
        ? getApps()[0]
        : initializeApp({
            apiKey: cfg.apiKey,
            authDomain: cfg.authDomain,
            projectId: cfg.projectId,
            storageBucket: cfg.storageBucket,
            messagingSenderId: cfg.messagingSenderId,
            appId: cfg.appId,
          });

      const registration = await navigator.serviceWorker.register(
        '/firebase-messaging-sw.js',
      );

      if (Notification.permission === 'denied') {
        this.started = false;
        return;
      }
      const permission =
        Notification.permission === 'granted'
          ? 'granted'
          : await Notification.requestPermission();
      if (permission !== 'granted') {
        this.started = false;
        return;
      }

      this.messaging = getMessaging(app);
      const token = await getToken(this.messaging, {
        vapidKey: cfg.vapidKey,
        serviceWorkerRegistration: registration,
      });
      if (token) {
        this.notifications.registerFcmToken(token).subscribe();
      }

      // Foreground push → refresh badge + list inside Angular's zone.
      onMessage(this.messaging, () => {
        this.zone.run(() => {
          this.store.loadUnreadCount();
          this.store.loadFirst();
        });
      });
    } catch {
      this.started = false;
    }
  }

  /** Unregister this device on logout (server-side + Firebase). */
  async disable(): Promise<void> {
    if (!this.isConfigured) return;
    this.notifications.removeFcmToken().subscribe();
    try {
      if (this.messaging) {
        const { deleteToken } = await import('firebase/messaging');
        await deleteToken(this.messaging);
      }
    } catch {
      /* ignore — server-side removal already requested */
    }
    this.messaging = null;
    this.started = false;
  }
}
