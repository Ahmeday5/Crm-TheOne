import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { timer } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { NotificationsPanelService } from '../../../core/services/notifications-panel.service';
import { NotificationsStore } from '../../../core/services/notifications.store';
import { PushNotificationsService } from '../../../core/services/push-notifications.service';
import { AppNotification } from '../../models';
import {
  notificationIcon,
  notificationRoute,
  notificationTone,
  relativeTime,
} from '../../models/notifications/notification-ui.util';
import { TranslatePipe } from '../../pipes/translate.pipe';

const COUNT_POLL_MS = 45_000;

@Component({
  selector: 'app-notifications-bell',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notifications-bell.component.html',
  styleUrl: './notifications-bell.component.scss',
})
export class NotificationsBellComponent implements OnInit {
  private readonly store = inject(NotificationsStore);
  private readonly push = inject(PushNotificationsService);
  private readonly auth = inject(AuthService);
  private readonly lang = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  private readonly panel = inject(NotificationsPanelService);
  /** Shared so the mobile bottom bar can open the same panel. */
  readonly open = this.panel.open;
  /** The full notification center is an admin tool — others only get the bell. */
  readonly canViewAll = computed(() => this.auth.currentRole() === 'Admin');

  readonly unreadCount = this.store.unreadCount;
  readonly items = this.store.items;
  readonly loading = this.store.loading;
  readonly loadingMore = this.store.loadingMore;
  readonly hasMore = this.store.hasMore;

  ngOnInit(): void {
    this.store.loadUnreadCount();
    // Prime the new-arrival detector with the current latest id (no toasts yet).
    this.store.loadFirst();
    // Real-time push (no-op until Firebase is configured) + a polling fallback.
    void this.push.init();
    timer(COUNT_POLL_MS, COUNT_POLL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.store.loadUnreadCount());
  }

  constructor() {
    // Refresh whenever the panel opens, whoever opened it.
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.store.loadFirst();
        this.store.loadUnreadCount();
      });
    });
  }

  toggle(): void {
    this.panel.toggle();
  }

  close(): void {
    this.panel.close();
  }

  onScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
      this.store.loadMore();
    }
  }

  onItemClick(n: AppNotification): void {
    if (!n.isRead) this.store.markRead(n.id);
    const route = notificationRoute(n, this.auth.currentRole());
    if (route) {
      this.close();
      this.router.navigate(route);
    }
  }

  markAllRead(): void {
    this.store.markAllRead();
  }

  viewAll(): void {
    this.close();
    this.router.navigate(['/notifications']);
  }

  // ─────────── view helpers ───────────

  badge(): string {
    const c = this.unreadCount();
    return c > 99 ? '99+' : String(c);
  }

  icon(n: AppNotification): string {
    return notificationIcon(n.type);
  }
  tone(n: AppNotification): string {
    return notificationTone(n.type);
  }
  time(n: AppNotification): string {
    return relativeTime(n.createdAt, this.lang.lang());
  }

  trackId = (_: number, n: AppNotification) => n.id;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    // Clicks on other openers (e.g. the bottom bar) manage the panel themselves.
    if (target?.closest('[data-notifications-toggle]')) return;
    if (this.open() && !this.host.nativeElement.contains(target)) {
      this.close();
    }
  }
}
