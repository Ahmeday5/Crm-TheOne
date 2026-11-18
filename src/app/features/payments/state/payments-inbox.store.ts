import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, Subscription, filter, map } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NavBadgesService } from '../../../core/services/nav-badges.service';
import { NotificationsStore } from '../../../core/services/notifications.store';
import { pollWhileVisible } from '../../../core/utils/poll-while-visible.util';
import { SessionTracker } from '../../../core/utils/session-tracker.util';
import { isPaymentNotification } from '../../../shared/models/notifications/notification.model';
import { PaymentsService } from '../data/payments.gateway';
import { PAYMENTS_PATH, PAYMENT_ROLES } from '../payments.constants';

/**
 * The backend has no realtime event for payment requests, only notification
 * type 27 ("customer confirmed") — and a fallback poll for everything else
 * (expiry, another employee confirming / cancelling).
 */
const POLL_MS = 60_000;

/**
 * Payment-request signals that matter on every page:
 *  - `reviewCount`: requests the customer marked as paid and staff haven't
 *    confirmed yet → sidebar badge on "Payment requests";
 *  - `changed$`: something may have changed server-side (a type-27
 *    notification, or a poll tick) — open views refetch quietly.
 */
@Injectable({ providedIn: 'root' })
export class PaymentsInboxStore {
  private readonly payments = inject(PaymentsService);
  private readonly auth = inject(AuthService);
  private readonly badges = inject(NavBadgesService);
  private readonly notifications = inject(NotificationsStore);
  private readonly destroyRef = inject(DestroyRef);

  private readonly count = signal(0);
  private readonly changedSubject = new Subject<void>();
  private readonly session = new SessionTracker<string>();
  private started = false;
  private inFlight: Subscription | null = null;

  readonly enabled = computed(() => {
    const role = this.auth.currentRole();
    return !!role && PAYMENT_ROLES.includes(role);
  });
  readonly reviewCount = computed(() => (this.enabled() ? this.count() : 0));
  readonly changed$: Observable<void> = this.changedSubject.asObservable();

  constructor() {
    effect(() => this.badges.set(PAYMENTS_PATH, this.reviewCount()), { allowSignalWrites: true });

    effect(() => {
      const key = `${this.auth.currentUser()?.userId ?? ''}|${this.enabled()}`;
      untracked(() => {
        if (!this.session.changed(key)) return;
        this.count.set(0);
        if (this.started) this.refresh();
      });
    });
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.refresh();

    this.notifications.arrivals$
      .pipe(
        map((batch) => batch.some((n) => isPaymentNotification(n))),
        filter(Boolean),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.signalChange());

    pollWhileVisible(POLL_MS)
      .pipe(
        filter(() => this.enabled()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.signalChange());
  }

  /** Re-count after a local change (mark paid / cancel) or a server hint. */
  refresh(): void {
    if (!this.enabled()) return;
    this.inFlight?.unsubscribe();
    this.inFlight = this.payments.gateway.awaitingReviewCount().subscribe({
      next: (count) => this.count.set(count),
      // A failed badge count must never surface — keep the last value.
      error: () => undefined,
    });
  }

  private signalChange(): void {
    this.refresh();
    this.changedSubject.next();
  }
}
