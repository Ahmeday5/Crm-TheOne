import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import {
  NotificationToast,
  NotificationToastService,
} from '../../../core/services/notification-toast.service';
import { NotificationsStore } from '../../../core/services/notifications.store';
import {
  notificationIcon,
  notificationRoute,
  notificationTone,
} from '../../models/notifications/notification-ui.util';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * Live notification toast stack (bottom-right).
 *
 * Distinct from the generic `ToastService` — these are real-time arrivals
 * surfaced by the notifications store. Each auto-dismisses after ~35s, can be
 * closed, and on click marks the notification read and jumps to its entity.
 */
@Component({
  selector: 'app-notification-toasts',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-toasts.component.html',
  styleUrl: './notification-toasts.component.scss',
})
export class NotificationToastsComponent {
  private readonly toastService = inject(NotificationToastService);
  private readonly store = inject(NotificationsStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly toasts = this.toastService.toasts;

  icon(t: NotificationToast): string {
    return notificationIcon(t.type);
  }
  tone(t: NotificationToast): string {
    return notificationTone(t.type);
  }

  open(t: NotificationToast): void {
    this.store.markRead(t.id);
    this.toastService.dismiss(t.id);
    const route = notificationRoute(t.relatedEntityType, this.auth.currentRole(), t.type);
    if (route) this.router.navigate(route);
  }

  dismiss(t: NotificationToast, event: Event): void {
    event.stopPropagation();
    this.toastService.dismiss(t.id);
  }

  trackId = (_: number, t: NotificationToast) => t.id;
}
