import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, merge, tap } from 'rxjs';
import { AttendanceRepository } from '../data/attendance.repository';
import {
  LeaveRequest,
  LeaveRequestInput,
  MonthlyAttendance,
  YearMonth,
} from '../models/attendance.models';
import { buildCalendarDays, compareYm, shiftYm, ymOf } from '../utils/attendance-calendar.util';
import { compareLeaves } from '../utils/leave.util';
import { AttendanceTodayStore } from './attendance-today.store';
import { LeaveInboxStore } from './leave-inbox.store';
import { RemoteState } from './remote-state';

/** How far back the month navigator goes. */
const HISTORY_MONTHS = 24;

const EMPTY_MONTH: MonthlyAttendance = {
  presentDays: 0,
  totalHours: 0,
  leaveDays: 0,
  missingCheckOuts: 0,
  records: [],
  leaves: [],
};

/**
 * The signed-in user's month (`GET /Attendance/My`) and leave requests
 * (`GET /Attendance/Leaves/My`). Provided by the attendance page, so it
 * lives exactly as long as the page.
 *
 * Refetches by itself after a check-in / check-out and when a decision on
 * one of my requests arrives.
 */
@Injectable()
export class MyAttendanceStore {
  private readonly repo = inject(AttendanceRepository);
  private readonly todayStore = inject(AttendanceTodayStore);
  private readonly inbox = inject(LeaveInboxStore);

  private readonly monthState = new RemoteState<MonthlyAttendance>(EMPTY_MONTH);
  private readonly leavesState = new RemoteState<LeaveRequest[]>([]);

  readonly period = signal<YearMonth>(ymOf(this.todayStore.day()));
  readonly leavesYear = signal(ymOf(this.todayStore.day()).year);

  readonly month = this.monthState.value;
  readonly monthLoading = this.monthState.loading;
  readonly monthLoaded = this.monthState.loaded;
  readonly monthError = this.monthState.error;

  readonly leavesLoading = this.leavesState.loading;
  readonly leavesLoaded = this.leavesState.loaded;
  readonly leavesError = this.leavesState.error;
  readonly leaves = computed(() => [...this.leavesState.value()].sort(compareLeaves));

  readonly days = computed(() =>
    buildCalendarDays(this.period(), this.month().records, this.month().leaves, this.todayStore.day()),
  );

  private readonly currentYm = computed(() => ymOf(this.todayStore.day()));
  readonly canNext = computed(() => compareYm(this.period(), this.currentYm()) < 0);
  readonly canPrev = computed(() => compareYm(shiftYm(this.currentYm(), -HISTORY_MONTHS), this.period()) < 0);

  constructor() {
    merge(this.todayStore.changed$, this.inbox.reviewed$)
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => {
        this.loadMonth(true);
        this.loadLeaves(true);
      });
  }

  // ─────────── month ───────────

  loadMonth(quiet = false): void {
    this.monthState.load(this.repo.myMonth(this.period()), quiet);
  }

  shiftMonth(delta: number): void {
    const next = shiftYm(this.period(), delta);
    if (delta > 0 && !this.canNext()) return;
    if (delta < 0 && !this.canPrev()) return;
    this.period.set(next);
    this.loadMonth();
  }

  // ─────────── leave ───────────

  loadLeaves(quiet = false): void {
    this.leavesState.load(this.repo.myLeaves(this.leavesYear()), quiet);
  }

  setLeavesYear(year: number): void {
    if (year === this.leavesYear()) return;
    this.leavesYear.set(year);
    this.loadLeaves();
  }

  requestLeave(input: LeaveRequestInput): Observable<LeaveRequest | null> {
    return this.repo.requestLeave(input).pipe(
      tap(() => {
        this.loadLeaves(true);
        this.inbox.refreshPending();
      }),
    );
  }

  cancelLeave(id: number): Observable<void> {
    return this.repo.cancelLeave(id).pipe(
      tap(() => {
        // Reflect it immediately; the refetch confirms the server state.
        this.leavesState.update((list) => list.map((l) => (l.id === id ? { ...l, status: 'Cancelled' as const } : l)));
        this.loadLeaves(true);
        this.inbox.refreshPending();
      }),
    );
  }
}
