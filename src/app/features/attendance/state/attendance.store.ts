import {
  DestroyRef,
  Injectable,
  Signal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  Observable,
  Subject,
  catchError,
  filter,
  forkJoin,
  fromEvent,
  interval,
  map,
  merge,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import {
  ATTENDANCE_POLICY,
  ATTENDANCE_REFRESH_MS,
  LEAVE_ENTITLEMENTS,
  PUBLIC_HOLIDAYS,
  PublicHoliday,
} from '../config/attendance.config';
import { ATTENDANCE_REPOSITORY } from '../data/attendance-repository.provider';
import {
  AttendanceDay,
  AttendanceEmployee,
  AttendanceRecord,
  LeaveBalance,
  LeaveDecision,
  LeaveRequest,
  LeaveRequestInput,
  PendingApproval,
  PresenceEntry,
  TeamMatrixRow,
} from '../models/attendance.models';
import {
  DayContext,
  buildDays,
  clockStateOf,
  presenceOf,
  resolveDay,
  summarizeDays,
  toHolidayLookup,
} from '../utils/attendance-calc.util';
import {
  addMonths,
  cairoToday,
  diffMonths,
  firstDayOfMonth,
  lastDayOfMonth,
  monthDays,
  monthOf,
  rangesOverlap,
} from '../utils/attendance-date.util';
import { compareLeaves, computeBalances } from '../utils/leave.util';

/** How often "now" ticks for statuses that depend on the time of day. */
const NOW_TICK_MS = 30_000;

/** Loading flags of one remote resource. */
class LoadState {
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal(false);

  reset(): void {
    this.loading.set(false);
    this.loaded.set(false);
    this.error.set(false);
  }
}

type Keyed<T> = { key: string; rows: T };

/**
 * State of the attendance page — the signed-in user's clock, monthly log and
 * leave, plus (Admin) the team board, matrix and approvals inbox.
 *
 * Provided by the page component, so polling and timers live exactly as
 * long as the page is open. Every remote resource is keyed by a signal
 * (user, month…): changing the key refetches it, `refresh()` refetches all
 * of them quietly. All rules are delegated to the pure utils.
 */
@Injectable()
export class AttendanceStore {
  private readonly repo = inject(ATTENDANCE_REPOSITORY);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  /** `true` = keep the current data on screen while refetching. */
  private readonly refresh$ = new Subject<boolean>();

  readonly policy = ATTENDANCE_POLICY;

  // ─────────── clock ───────────
  private readonly todaySig = signal(cairoToday());
  private readonly nowSig = signal(new Date());
  readonly today = this.todaySig.asReadonly();
  readonly now = this.nowSig.asReadonly();
  readonly currentMonth = computed(() => monthOf(this.todaySig()));

  // ─────────── identity ───────────
  readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');
  readonly me = computed<AttendanceEmployee | null>(() => {
    const u = this.auth.currentUser();
    return u
      ? { id: u.userId, name: u.fullName || u.email, email: u.email, role: u.role, imageUrl: u.imageUrl ?? null }
      : null;
  });
  private readonly userId = computed(() => this.me()?.id ?? null);

  // ─────────── holidays ───────────
  private readonly holidayList = signal<PublicHoliday[]>([...PUBLIC_HOLIDAYS]);
  readonly holidays = computed(() => toHolidayLookup(this.holidayList()));

  // ─────────── my attendance ───────────
  readonly month = signal(monthOf(cairoToday()));
  private readonly monthRecords = signal<Keyed<AttendanceRecord[]> | null>(null);
  private readonly todayRecordSig = signal<Keyed<AttendanceRecord | null> | null>(null);
  readonly myState = new LoadState();
  readonly todayState = new LoadState();
  readonly clockBusy = signal(false);

  // ─────────── my leave ───────────
  private readonly myLeavesSig = signal<LeaveRequest[]>([]);
  private readonly balancesSig = signal<LeaveBalance[]>([]);
  readonly leaveState = new LoadState();

  // ─────────── team (admin) ───────────
  private readonly teamOn = signal(false);
  readonly teamMonth = signal(monthOf(cairoToday()));
  private readonly employeesSig = signal<AttendanceEmployee[]>([]);
  private readonly teamRecordsSig = signal<Keyed<AttendanceRecord[]> | null>(null);
  private readonly teamTodaySig = signal<Keyed<AttendanceRecord[]> | null>(null);
  private readonly teamLeavesSig = signal<LeaveRequest[]>([]);
  readonly teamState = new LoadState();
  readonly boardState = new LoadState();
  readonly approvalsState = new LoadState();

  constructor() {
    this.connect(
      computed(() => (this.userId() ? 'holidays' : null)),
      () => this.repo.holidays(),
      (rows) => this.holidayList.set(rows),
      new LoadState(),
    );

    this.connect(
      computed(() => (this.userId() ? `${this.userId()}|${this.month()}` : null)),
      (key) => {
        const month = key.split('|')[1];
        return this.repo
          .myRecords(firstDayOfMonth(month), lastDayOfMonth(month))
          .pipe(map((rows) => ({ key, rows })));
      },
      (v) => this.monthRecords.set(v),
      this.myState,
    );

    this.connect(
      computed(() => (this.userId() ? `${this.userId()}|${this.todaySig()}` : null)),
      (key) => {
        const day = key.split('|')[1];
        return this.repo.myRecords(day, day).pipe(map((rows) => ({ key, rows: rows[0] ?? null })));
      },
      (v) => this.todayRecordSig.set(v),
      this.todayState,
    );

    this.connect(
      computed(() => (this.userId() ? `${this.userId()}|${this.todaySig().slice(0, 4)}` : null)),
      (key) =>
        forkJoin({
          leaves: this.repo.myLeaves(),
          balances: this.repo.myBalances(Number(key.split('|')[1])),
        }),
      ({ leaves, balances }) => {
        this.myLeavesSig.set(leaves);
        this.balancesSig.set(balances);
      },
      this.leaveState,
    );

    const teamKey = (suffix: () => string) =>
      computed(() => (this.teamOn() && this.isAdmin() && this.userId() ? `${this.userId()}|${suffix()}` : null));

    this.connect(
      teamKey(() => this.teamMonth()),
      (key) => {
        const month = key.split('|')[1];
        return forkJoin({
          employees: this.repo.employees(),
          records: this.repo.teamRecords(firstDayOfMonth(month), lastDayOfMonth(month)),
        }).pipe(map((v) => ({ ...v, key })));
      },
      ({ employees, records, key }) => {
        this.employeesSig.set(employees);
        this.teamRecordsSig.set({ key, rows: records });
      },
      this.teamState,
    );

    this.connect(
      teamKey(() => this.todaySig()),
      (key) => {
        const day = key.split('|')[1];
        return forkJoin({
          employees: this.repo.employees(),
          records: this.repo.teamRecords(day, day),
        }).pipe(map((v) => ({ ...v, key })));
      },
      ({ employees, records, key }) => {
        this.employeesSig.set(employees);
        this.teamTodaySig.set({ key, rows: records });
      },
      this.boardState,
    );

    this.connect(
      teamKey(() => 'leaves'),
      () => this.repo.teamLeaves(),
      (rows) => this.teamLeavesSig.set(rows),
      this.approvalsState,
    );

    // Clock: statuses ("not yet" → "absent", live elapsed) follow the time.
    interval(NOW_TICK_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.tick());

    merge(
      interval(ATTENDANCE_REFRESH_MS),
      this.repo.externalChanges$,
      fromEvent(document, 'visibilitychange'),
    )
      .pipe(
        filter(() => document.visibilityState === 'visible' && this.auth.isAuthenticated()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.refresh(true));
  }

  // ═══════════════════ derived: me ═══════════════════

  readonly myLeaves = computed(() => [...this.myLeavesSig()].sort(compareLeaves));
  readonly balances = this.balancesSig.asReadonly();
  readonly pendingMine = computed(() => this.myLeavesSig().filter((l) => l.status === 'pending').length);

  readonly todayRecord = computed(() => {
    const v = this.todayRecordSig();
    return v && v.key === `${this.userId()}|${this.todaySig()}` ? v.rows : null;
  });

  readonly clockState = computed(() => clockStateOf(this.todayRecord()));

  private ctxFor(leaves: ReadonlyArray<LeaveRequest>): DayContext {
    return {
      today: this.todaySig(),
      now: this.nowSig(),
      policy: this.policy,
      holidays: this.holidays(),
      leaves,
    };
  }

  readonly todayDay = computed<AttendanceDay>(() =>
    resolveDay(this.todaySig(), this.todayRecord(), this.ctxFor(this.myLeavesSig())),
  );

  /** Are the records on screen those of the selected month? */
  readonly monthReady = computed(() => this.monthRecords()?.key === `${this.userId()}|${this.month()}`);

  readonly myDays = computed<AttendanceDay[]>(() => {
    if (!this.monthReady()) return [];
    const month = this.month();
    const rows = [...(this.monthRecords()?.rows ?? [])];
    const today = this.todayRecord();
    if (today && monthOf(today.date) === month) {
      const i = rows.findIndex((r) => r.date === today.date);
      if (i >= 0) rows[i] = today;
      else rows.push(today);
    }
    return buildDays(monthDays(month), rows, this.ctxFor(this.myLeavesSig()));
  });

  readonly mySummary = computed(() => summarizeDays(this.myDays()));

  readonly canPrevMonth = computed(
    () => diffMonths(this.month(), this.currentMonth()) < this.policy.historyMonths,
  );
  readonly canNextMonth = computed(() => this.month() < this.currentMonth());

  // ═══════════════════ derived: team ═══════════════════

  readonly employees = this.employeesSig.asReadonly();

  private readonly leavesByUser = computed(() => groupBy(this.teamLeavesSig(), (l) => l.userId));

  readonly teamReady = computed(
    () => this.teamRecordsSig()?.key === `${this.userId()}|${this.teamMonth()}`,
  );

  readonly teamRows = computed<TeamMatrixRow[]>(() => {
    if (!this.teamReady()) return [];
    const days = monthDays(this.teamMonth());
    const byUser = groupBy(this.teamRecordsSig()?.rows ?? [], (r) => r.userId);
    const leaves = this.leavesByUser();
    return this.employeesSig().map((employee) => {
      const resolved = buildDays(days, byUser.get(employee.id) ?? [], this.ctxFor(leaves.get(employee.id) ?? []));
      return { employee, days: resolved, summary: summarizeDays(resolved) };
    });
  });

  readonly canPrevTeamMonth = computed(
    () => diffMonths(this.teamMonth(), this.currentMonth()) < this.policy.historyMonths,
  );
  readonly canNextTeamMonth = computed(() => this.teamMonth() < this.currentMonth());

  readonly boardReady = computed(() => this.teamTodaySig()?.key === `${this.userId()}|${this.todaySig()}`);

  readonly presence = computed<PresenceEntry[]>(() => {
    if (!this.boardReady()) return [];
    const byUser = new Map((this.teamTodaySig()?.rows ?? []).map((r) => [r.userId, r]));
    const leaves = this.leavesByUser();
    return this.employeesSig().map((e) =>
      presenceOf(e, byUser.get(e.id), this.ctxFor(leaves.get(e.id) ?? [])),
    );
  });

  /** Oldest first — first come, first served — with the context to decide. */
  readonly pendingApprovals = computed<PendingApproval[]>(() => {
    const all = this.teamLeavesSig();
    return all
      .filter((l) => l.status === 'pending')
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
      .map((request) => {
        const balance = this.balanceOf(request.userId, Number(request.from.slice(0, 4))).find(
          (b) => b.type === request.type,
        );
        const colleaguesAway = new Set(
          all
            .filter(
              (l) =>
                l.status === 'approved' &&
                l.userId !== request.userId &&
                l.employeeRole === request.employeeRole &&
                rangesOverlap(l.from, l.to, request.from, request.to),
            )
            .map((l) => l.userId),
        ).size;
        // `available` already reserves this pending request — add it back.
        return { request, available: (balance?.available ?? 0) + request.days, colleaguesAway };
      });
  });

  readonly decidedLeaves = computed(() =>
    this.teamLeavesSig()
      .filter((l) => l.status !== 'pending')
      .sort((a, b) => ((a.decidedAt ?? a.createdAt) < (b.decidedAt ?? b.createdAt) ? 1 : -1)),
  );

  /** An employee's balance as derived from the requests the admin can see. */
  balanceOf(userId: string, year: number): LeaveBalance[] {
    return computeBalances(this.leavesByUser().get(userId) ?? [], year, LEAVE_ENTITLEMENTS);
  }

  // ═══════════════════ commands ═══════════════════

  /** Loads the admin parts (idempotent). */
  enableTeam(): void {
    if (this.isAdmin()) this.teamOn.set(true);
  }

  refresh(quiet = false): void {
    this.tick();
    this.refresh$.next(quiet);
  }

  shiftMonth(delta: number): void {
    const next = addMonths(this.month(), delta);
    if (next > this.currentMonth() || diffMonths(next, this.currentMonth()) > this.policy.historyMonths) return;
    this.month.set(next);
  }

  shiftTeamMonth(delta: number): void {
    const next = addMonths(this.teamMonth(), delta);
    if (next > this.currentMonth() || diffMonths(next, this.currentMonth()) > this.policy.historyMonths) return;
    this.teamMonth.set(next);
  }

  checkIn(): Observable<AttendanceRecord> {
    return this.punch(this.repo.checkIn());
  }

  checkOut(): Observable<AttendanceRecord> {
    return this.punch(this.repo.checkOut());
  }

  requestLeave(input: LeaveRequestInput): Observable<LeaveRequest> {
    return this.repo.requestLeave(input).pipe(
      tap((saved) => {
        this.myLeavesSig.update((list) => upsert(list, saved));
        if (this.teamOn()) this.teamLeavesSig.update((list) => upsert(list, saved));
        this.reloadBalances();
      }),
    );
  }

  cancelLeave(id: string): Observable<LeaveRequest> {
    return this.repo.cancelLeave(id).pipe(
      tap((saved) => {
        this.myLeavesSig.update((list) => upsert(list, saved));
        if (this.teamOn()) this.teamLeavesSig.update((list) => upsert(list, saved));
        this.reloadBalances();
      }),
    );
  }

  decideLeave(id: string, decision: LeaveDecision): Observable<LeaveRequest> {
    return this.repo.decideLeave(id, decision).pipe(
      tap((saved) => {
        this.teamLeavesSig.update((list) => upsert(list, saved));
        if (saved.userId === this.userId()) {
          this.myLeavesSig.update((list) => upsert(list, saved));
          this.reloadBalances();
        }
      }),
    );
  }

  // ═══════════════════ internals ═══════════════════

  private punch(request$: Observable<AttendanceRecord>): Observable<AttendanceRecord> {
    this.clockBusy.set(true);
    return request$.pipe(
      tap({
        next: (record) => {
          this.clockBusy.set(false);
          this.tick();
          this.todayRecordSig.set({ key: `${record.userId}|${record.date}`, rows: record });
          this.monthRecords.update((v) => (v ? { ...v, rows: upsertRecord(v.rows, record) } : v));
          this.teamTodaySig.update((v) => (v ? { ...v, rows: upsertRecord(v.rows, record) } : v));
          this.teamRecordsSig.update((v) => (v ? { ...v, rows: upsertRecord(v.rows, record) } : v));
        },
        error: () => this.clockBusy.set(false),
      }),
    );
  }

  private reloadBalances(): void {
    this.repo.myBalances(Number(this.todaySig().slice(0, 4))).subscribe({
      next: (rows) => this.balancesSig.set(rows),
      error: () => undefined,
    });
  }

  private tick(): void {
    const now = new Date();
    this.nowSig.set(now);
    const today = cairoToday(now);
    if (today !== this.todaySig()) this.todaySig.set(today);
  }

  /**
   * Binds one remote resource: refetches when `key` changes (with loading
   * flags) or on `refresh$` (quietly when asked), cancelling stale requests.
   */
  private connect<T>(
    key: Signal<string | null>,
    fetch: (key: string) => Observable<T>,
    onData: (value: T) => void,
    state: LoadState,
  ): void {
    merge(
      toObservable(key).pipe(
        tap((k) => {
          if (!k) state.reset();
        }),
        map((k) => ({ k, quiet: false })),
      ),
      this.refresh$.pipe(map((quiet) => ({ k: key(), quiet }))),
    )
      .pipe(
        filter((e): e is { k: string; quiet: boolean } => !!e.k),
        switchMap(({ k, quiet }) => {
          if (!quiet) state.loading.set(true);
          state.error.set(false);
          return fetch(k).pipe(
            map((value) => ({ ok: true as const, value })),
            catchError(() => of({ ok: false as const })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        state.loading.set(false);
        if (result.ok) {
          onData(result.value);
          state.loaded.set(true);
        } else {
          state.error.set(true);
        }
      });
  }
}

function groupBy<T>(rows: ReadonlyArray<T>, key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = map.get(k);
    if (bucket) bucket.push(row);
    else map.set(k, [row]);
  }
  return map;
}

function upsert(list: LeaveRequest[], item: LeaveRequest): LeaveRequest[] {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list];
}

function upsertRecord(list: AttendanceRecord[], record: AttendanceRecord): AttendanceRecord[] {
  const i = list.findIndex((r) => r.userId === record.userId && r.date === record.date);
  if (i < 0) return [...list, record];
  const next = [...list];
  next[i] = record;
  return next;
}
