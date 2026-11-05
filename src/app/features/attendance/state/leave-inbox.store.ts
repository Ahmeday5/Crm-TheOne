import { DestroyRef, Injectable, computed, effect, inject, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, filter, map } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NavBadgesService } from '../../../core/services/nav-badges.service';
import { NotificationsStore } from '../../../core/services/notifications.store';
import { SessionTracker } from '../../../core/utils/session-tracker.util';
import { AttendanceRepository } from '../data/attendance.repository';
import { LeaveRequest } from '../models/attendance.models';
import { RemoteState } from './remote-state';

export const ATTENDANCE_PATH = '/attendance';

/**
 * Leave-request signals that matter on every page:
 *
 *  - Admin: the number of pending requests → sidebar badge on
 *    "Attendance"; refreshed when a `LeaveRequestSubmitted` notification
 *    arrives and after every review.
 *  - Everyone: `reviewed$` when a `LeaveRequestReviewed` notification
 *    arrives, so open views (my requests, calendar, today) refetch.
 */
@Injectable({ providedIn: 'root' })
export class LeaveInboxStore {
  private readonly repo = inject(AttendanceRepository);
  private readonly auth = inject(AuthService);
  private readonly badges = inject(NavBadgesService);
  private readonly notifications = inject(NotificationsStore);
  private readonly destroyRef = inject(DestroyRef);

  private readonly pending = new RemoteState<LeaveRequest[]>([]);
  private readonly reviewedSubject = new Subject<void>();
  private readonly submittedSubject = new Subject<void>();
  private started = false;
  private readonly session = new SessionTracker();

  readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');
  readonly pendingCount = computed(() => (this.isAdmin() ? this.pending.value().length : 0));

  /** A decision on one of *my* requests arrived. */
  readonly reviewed$: Observable<void> = this.reviewedSubject.asObservable();
  /** Admin: a new request arrived. */
  readonly submitted$: Observable<void> = this.submittedSubject.asObservable();

  constructor() {
    effect(() => this.badges.set(ATTENDANCE_PATH, this.pendingCount()), { allowSignalWrites: true });

    effect(() => {
      const admin = this.isAdmin();
      const userId = this.auth.currentUser()?.userId ?? null;
      untracked(() => {
        if (!this.session.changed(`${userId}|${admin}`)) return;
        this.pending.reset();
        if (this.started && admin && userId) this.refreshPending();
      });
    });
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.refreshPending();

    const arrivals = (type: string) =>
      this.notifications.arrivals$.pipe(
        map((batch) => batch.some((n) => String(n.type) === type)),
        filter(Boolean),
        takeUntilDestroyed(this.destroyRef),
      );

    arrivals('LeaveRequestSubmitted').subscribe(() => {
      this.refreshPending();
      this.submittedSubject.next();
    });
    arrivals('LeaveRequestReviewed').subscribe(() => this.reviewedSubject.next());
  }

  refreshPending(): void {
    if (!this.isAdmin()) return;
    this.pending.load(this.repo.leaves({ status: 'Pending' }), true);
  }
}
