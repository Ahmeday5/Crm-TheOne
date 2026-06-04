import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { withSkipLoader } from '../../../../core/http/http-context.tokens';
import { API_ENDPOINTS } from '../../../../core/constants/api-endpoints.const';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { LanguageService } from '../../../../core/services/language.service';
import { NotificationsService } from '../../../../core/services/notifications.service';
import { NotificationsStore } from '../../../../core/services/notifications.store';
import { ToastService } from '../../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AppNotification, PagedResult } from '../../../../shared/models';
import { AppUser } from '../../../../core/models/user.model';
import {
  notificationIcon,
  notificationRoute,
  notificationTone,
  relativeTime,
} from '../../../../shared/models/notifications/notification-ui.util';
import { Router } from '@angular/router';

type CenterFilter = 'all' | 'unread' | 'read';
const PAGE_SIZE = 20;

@Component({
  selector: 'app-notifications-center',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    PageHeaderComponent,
    EmptyStateComponent,
    ModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notifications-center.component.html',
  styleUrl: './notifications-center.component.scss',
})
export class NotificationsCenterComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly service = inject(NotificationsService);
  private readonly store = inject(NotificationsStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly lang = inject(LanguageService);
  private readonly fb = inject(FormBuilder);

  @ViewChild('sentinel') private sentinel?: ElementRef<HTMLElement>;
  private observer?: IntersectionObserver;

  readonly items = signal<AppNotification[]>([]);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly filter = signal<CenterFilter>('all');
  private readonly pageIndex = signal(1);
  private readonly totalCount = signal(0);

  readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');
  readonly unreadCount = this.store.unreadCount;
  readonly hasMore = computed(() => this.items().length < this.totalCount());

  readonly filtered = computed(() => {
    const f = this.filter();
    if (f === 'unread') return this.items().filter((n) => !n.isRead);
    if (f === 'read') return this.items().filter((n) => n.isRead);
    return this.items();
  });

  readonly filters: CenterFilter[] = ['all', 'unread', 'read'];

  // ─── send dialog (admin) ───
  readonly sendOpen = signal(false);
  readonly sending = signal(false);
  readonly users = signal<AppUser[]>([]);
  readonly generating = signal(false);

  readonly sendForm = this.fb.nonNullable.group({
    userId: ['', [Validators.required]],
    title: ['', [Validators.required, Validators.maxLength(120)]],
    message: ['', [Validators.required, Validators.maxLength(500)]],
  });

  ngOnInit(): void {
    this.loadFirst();
    this.store.loadUnreadCount();
  }

  ngAfterViewInit(): void {
    if (this.sentinel) {
      this.observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) this.loadMore();
        },
        { rootMargin: '120px' },
      );
      this.observer.observe(this.sentinel.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  // ─────────── list ───────────

  loadFirst(): void {
    this.loading.set(true);
    this.pageIndex.set(1);
    this.service.list({ PageIndex: 1, PageSize: PAGE_SIZE }).subscribe({
      next: (res: PagedResult<AppNotification>) => {
        this.items.set(res.data ?? []);
        this.totalCount.set(res.count ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error(this.t('notifications.toasts.loadFailed'));
      },
    });
  }

  loadMore(): void {
    if (this.loadingMore() || this.loading() || !this.hasMore()) return;
    this.loadingMore.set(true);
    const next = this.pageIndex() + 1;
    this.service.list({ PageIndex: next, PageSize: PAGE_SIZE }).subscribe({
      next: (res) => {
        this.pageIndex.set(next);
        const seen = new Set(this.items().map((n) => n.id));
        const fresh = (res.data ?? []).filter((n) => !seen.has(n.id));
        this.items.update((cur) => [...cur, ...fresh]);
        this.totalCount.set(res.count ?? this.totalCount());
        this.loadingMore.set(false);
      },
      error: () => this.loadingMore.set(false),
    });
  }

  setFilter(f: CenterFilter): void {
    this.filter.set(f);
  }

  // ─────────── read actions ───────────

  markRead(n: AppNotification): void {
    if (n.isRead) return;
    // Local list + shared store (which owns the API call + read overlay).
    this.patchItem(n.id, { isRead: true, readAt: new Date().toISOString() });
    this.store.markRead(n.id);
  }

  /** Card click: mark read, then jump to the related entity (when one exists). */
  openNotification(n: AppNotification): void {
    this.markRead(n);
    const route = notificationRoute(n.relatedEntityType, this.auth.currentRole());
    if (route) this.router.navigate(route);
  }

  markAllRead(): void {
    if (this.unreadCount() === 0 && this.items().every((n) => n.isRead)) return;
    this.items.update((list) => list.map((n) => ({ ...n, isRead: true })));
    this.store.markAllRead(); // owns the API call + read overlay (no revert)
    this.toast.success(this.t('notifications.toasts.allRead'));
  }

  // ─────────── admin: generate reminders ───────────

  generateReminders(): void {
    if (this.generating()) return;
    this.generating.set(true);
    this.service.generateFollowupReminders().subscribe({
      next: (res) => {
        this.generating.set(false);
        const created = res?.created ?? 0;
        if (created > 0) {
          this.toast.success(
            this.t('notifications.toasts.remindersGenerated').replace('{n}', String(created)),
          );
          this.loadFirst();
          this.store.loadUnreadCount();
        } else {
          this.toast.info(this.t('notifications.toasts.remindersNone'));
        }
      },
      error: () => this.generating.set(false),
    });
  }

  // ─────────── admin: send notification ───────────

  openSend(): void {
    this.sendForm.reset({ userId: '', title: '', message: '' });
    if (this.users().length === 0) this.loadUsers();
    this.sendOpen.set(true);
  }

  closeSend(): void {
    this.sendOpen.set(false);
  }

  submitSend(): void {
    if (this.sendForm.invalid || this.sending()) {
      this.sendForm.markAllAsTouched();
      return;
    }
    this.sending.set(true);
    this.service.send(this.sendForm.getRawValue()).subscribe({
      next: () => {
        this.sending.set(false);
        this.sendOpen.set(false);
        this.toast.success(this.t('notifications.toasts.sent'));
      },
      error: () => this.sending.set(false),
    });
  }

  private loadUsers(): void {
    this.api
      .get<AppUser[] | PagedResult<AppUser>>(API_ENDPOINTS.users.list, {
        context: withSkipLoader(),
      })
      .subscribe({
        next: (res) => {
          const list = Array.isArray(res) ? res : res?.data ?? [];
          this.users.set(list);
        },
      });
  }

  // ─────────── helpers ───────────

  icon(n: AppNotification): string {
    return notificationIcon(n.type);
  }
  tone(n: AppNotification): string {
    return notificationTone(n.type);
  }
  time(n: AppNotification): string {
    return relativeTime(n.createdAt, this.lang.lang());
  }
  fullDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString(
        this.lang.lang() === 'ar' ? 'ar-EG' : 'en-US',
        { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
      );
    } catch {
      return iso;
    }
  }

  userLabel(u: AppUser): string {
    return u.fullName?.trim() || u.email;
  }

  trackId = (_: number, n: AppNotification) => n.id;

  private patchItem(id: number, patch: Partial<AppNotification>): void {
    this.items.update((list) => list.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.lang.lang()], key);
  }
}
