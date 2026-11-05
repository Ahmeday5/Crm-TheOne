import { Injectable, signal } from '@angular/core';

/**
 * Open/closed state of the notifications dropdown, shared so it can be opened
 * from more than one place (header bell, mobile bottom bar).
 */
@Injectable({ providedIn: 'root' })
export class NotificationsPanelService {
  readonly open = signal(false);

  toggle(): void {
    this.open.update((v) => !v);
  }

  show(): void {
    this.open.set(true);
  }

  close(): void {
    this.open.set(false);
  }
}
