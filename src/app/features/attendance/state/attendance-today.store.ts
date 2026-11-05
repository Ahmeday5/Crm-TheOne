import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, filter, finalize, fromEvent, interval, map, merge, tap } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../core/i18n';
import { ApiError } from '../../../core/models/api-response.model';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { ToastService } from '../../../core/services/toast.service';
import { cairoToday } from '../../../core/utils/cairo-time.util';
import { SessionTracker } from '../../../core/utils/session-tracker.util';
import { AttendanceRepository } from '../data/attendance.repository';
import { AttendanceRecord, AttendanceToday, ClockState } from '../models/attendance.models';
import { clockStateOf } from '../utils/attendance-calendar.util';
import { RemoteState } from './remote-state';

/** Re-checks "today" so a new Cairo day resets the clock on its own. */
const CLOCK_MS = 60_000;

export type ClockAction = 'in' | 'out';

/**
 * The signed-in user's attendance today (`GET /Attendance/Today`) and the
 * check-in / check-out actions. Root-scoped: the header chip and the
 * attendance page share it, so they can never disagree.
 *
 * The server stamps the times and rejects invalid actions (checking in
 * twice, checking out before checking in) — its `message` is shown as is.
 */
@Injectable({ providedIn: 'root' })
export class AttendanceTodayStore {
  private readonly repo = inject(AttendanceRepository);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly todayState = new RemoteState<AttendanceToday | null>(null);
  private readonly busySig = signal<ClockAction | null>(null);
  private readonly daySig = signal(cairoToday());
  private readonly changedSubject = new Subject<void>();
  private started = false;
  private readonly session = new SessionTracker();

  readonly today = this.todayState.value;
  readonly loading = this.todayState.loading;
  readonly loaded = this.todayState.loaded;
  readonly error = this.todayState.error;
  readonly busy = this.busySig.asReadonly();
  /** Cairo calendar day (`YYYY-MM-DD`), re-evaluated every minute. */
  readonly day = this.daySig.asReadonly();

  readonly state = computed<ClockState>(() => clockStateOf(this.today()));
  readonly record = computed<AttendanceRecord | null>(() => this.today()?.record ?? null);

  /** Fires after a successful check-in / check-out (month views refetch). */
  readonly changed$: Observable<void> = this.changedSubject.asObservable();

  constructor() {
    effect(() => {
      const userId = this.auth.currentUser()?.userId ?? null;
      untracked(() => {
        if (!this.session.changed(userId)) return;
        this.todayState.reset();
        this.busySig.set(null);
        if (this.started && userId) this.refresh();
      });
    });
  }

  /** Idempotent — loads today and follows the Cairo day / tab visibility. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.refresh();

    merge(
      interval(CLOCK_MS).pipe(map(() => cairoToday())),
      fromEvent(document, 'visibilitychange').pipe(
        filter(() => document.visibilityState === 'visible'),
        tap(() => this.refresh(true)),
        map(() => cairoToday()),
      ),
    )
      .pipe(
        filter((day) => day !== this.daySig()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((day) => {
        this.daySig.set(day);
        this.refresh(true);
      });
  }

  refresh(quiet = false): void {
    if (!this.auth.isAuthenticated()) return;
    this.todayState.load(this.repo.today(), quiet);
  }

  checkIn(note: string | null = null): void {
    this.act('in', () => this.repo.checkIn({ note }), 'attendance.clock.checkedInToast');
  }

  checkOut(note: string | null = null): void {
    this.act('out', () => this.repo.checkOut({ note }), 'attendance.clock.checkedOutToast');
  }

  private act(action: ClockAction, call: () => Observable<unknown>, successKey: string): void {
    if (this.busySig()) return;
    this.busySig.set(action);
    call()
      .pipe(finalize(() => this.busySig.set(null)))
      .subscribe({
        next: () => {
          this.toast.success(this.t(successKey));
          this.refresh(true);
          this.changedSubject.next();
        },
        error: (err: ApiError) => {
          this.toast.error(err?.message?.trim() || this.t('attendance.clock.failed'));
          // The server may know better (e.g. already checked in from another device).
          this.refresh(true);
        },
      });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
