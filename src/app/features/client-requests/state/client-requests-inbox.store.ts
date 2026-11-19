import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, Subscription, filter, map, merge } from 'rxjs';
import { isMocked } from '../../../core/constants/contract-mocks.const';
import { AppHubService } from '../../../core/realtime/app-hub.service';
import { AuthService } from '../../../core/services/auth.service';
import { NavBadgesService } from '../../../core/services/nav-badges.service';
import { NotificationsStore } from '../../../core/services/notifications.store';
import { pollWhileVisible } from '../../../core/utils/poll-while-visible.util';
import { SessionTracker } from '../../../core/utils/session-tracker.util';
import { isClientRequestNotification } from '../../../shared/models/notifications/notification.model';
import { CLIENT_REQUESTS_PATH } from '../client-requests.constants';
import { ClientRequestsMockDb } from '../data/mock/client-requests-mock.db';
import { STAFF_CLIENT_REQUESTS_GATEWAY } from '../data/staff-client-requests.gateway';
import { ClientRequestUpdatedEvent, EMPTY_INBOX_SUMMARY, InboxSummary } from '../models/client-requests.models';

/** Safety net only — the hub / notifications are the primary signal. */
const POLL_MS = 90_000;

/**
 * Client-request signals that matter on every staff page:
 *  - `summary` (Admin): the triage counts → sidebar badge on "طلبات العملاء";
 *  - `changed$`: a request changed somewhere (hub event, notification, another
 *    tab on the mock, poll tick) — open lists / dialogs refetch quietly.
 */
@Injectable({ providedIn: 'root' })
export class ClientRequestsInboxStore {
  private readonly gateway = inject(STAFF_CLIENT_REQUESTS_GATEWAY);
  private readonly auth = inject(AuthService);
  private readonly hub = inject(AppHubService);
  private readonly badges = inject(NavBadgesService);
  private readonly notifications = inject(NotificationsStore);
  private readonly mockDb = inject(ClientRequestsMockDb);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = signal<InboxSummary>(EMPTY_INBOX_SUMMARY);
  private readonly changedSubject = new Subject<number | null>();
  private readonly session = new SessionTracker<string>();
  private started = false;
  private inFlight: Subscription | null = null;

  readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');
  readonly isStaff = computed(() => {
    const role = this.auth.currentRole();
    return role === 'Admin' || role === 'Developer';
  });
  readonly summary = computed(() => (this.isAdmin() ? this.state() : EMPTY_INBOX_SUMMARY));
  /** What waits for the Admin's decision (the badge). */
  readonly decisionCount = computed(() => this.summary().pendingReview);
  /** Project id when known, `null` = refresh whatever is open. */
  readonly changed$: Observable<number | null> = this.changedSubject.asObservable();

  constructor() {
    effect(() => this.badges.set(CLIENT_REQUESTS_PATH, this.decisionCount()), { allowSignalWrites: true });

    effect(() => {
      const key = `${this.auth.currentUser()?.userId ?? ''}|${this.isAdmin()}`;
      untracked(() => {
        if (!this.session.changed(key)) return;
        this.state.set(EMPTY_INBOX_SUMMARY);
        if (this.started) this.refresh();
      });
    });
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.refresh();

    const hub$ = merge(
      this.hub.on<ClientRequestUpdatedEvent>('ClientRequestUpdated').pipe(map((e) => e?.projectId ?? null)),
      this.hub.on<unknown>('ClientRequestsSummaryChanged').pipe(map(() => null)),
    );
    const notifications$ = this.notifications.arrivals$.pipe(
      filter((batch) => batch.some(isClientRequestNotification)),
      map(() => null),
    );
    const mock$ = isMocked('clientRequestsTriage') ? this.mockDb.changes$ : new Subject<number | null>();
    const poll$ = pollWhileVisible(POLL_MS).pipe(
      filter(() => this.isAdmin()),
      map(() => null),
    );

    merge(hub$, notifications$, mock$, poll$)
      .pipe(
        filter(() => this.isStaff()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((projectId) => {
        this.refresh();
        this.changedSubject.next(projectId);
      });
  }

  /** Re-count after a local action or a server hint. */
  refresh(): void {
    if (!this.isAdmin()) return;
    this.inFlight?.unsubscribe();
    this.inFlight = this.gateway.summary().subscribe({
      next: (s) => this.state.set(s),
      // A failed badge count must never surface — keep the last value.
      error: () => undefined,
    });
  }
}
