import { Injectable, signal } from '@angular/core';

/** A live, in-app push toast for a freshly-arrived notification. */
export interface NotificationToast {
  /** Backend notification id (also the de-dupe key). */
  id: number;
  title: string;
  message: string;
  type: string;
  relatedEntityType: string | null;
  relatedEntityId: number | null;
}

const AUTO_DISMISS_MS = 35_000;
const MAX_VISIBLE = 4;

/**
 * Dedicated stack for real-time notification toasts (distinct from the generic
 * `ToastService`). Toasts are pushed when a new notification arrives — via FCM
 * push or the unread-count poll — and auto-dismiss after ~35s unless closed.
 */
@Injectable({ providedIn: 'root' })
export class NotificationToastService {
  readonly toasts = signal<NotificationToast[]>([]);
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  show(toast: NotificationToast): void {
    // Skip if this notification is already on screen.
    if (this.toasts().some((t) => t.id === toast.id)) return;

    this.toasts.update((list) => [toast, ...list].slice(0, MAX_VISIBLE));
    const handle = setTimeout(() => this.dismiss(toast.id), AUTO_DISMISS_MS);
    this.timers.set(toast.id, handle);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
    const handle = this.timers.get(id);
    if (handle) {
      clearTimeout(handle);
      this.timers.delete(id);
    }
  }

  clear(): void {
    this.toasts.set([]);
    this.timers.forEach((h) => clearTimeout(h));
    this.timers.clear();
  }
}
