import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, interval, merge, tap } from 'rxjs';
import { AttendanceRepository } from '../data/attendance.repository';
import {
  EmployeeMonthlyAttendance,
  LeaveRequest,
  LeaveReviewInput,
  LeaveStatus,
  TodayAttendanceEntry,
  YearMonth,
} from '../models/attendance.models';
import { compareYm, shiftYm, ymOf } from '../utils/attendance-calendar.util';
import { compareLeaves } from '../utils/leave.util';
import { AttendanceTodayStore } from './attendance-today.store';
import { LeaveInboxStore } from './leave-inbox.store';
import { RemoteState } from './remote-state';

/** Live refresh of "who is in today" while the team tab is open. */
const TODAY_REFRESH_MS = 60_000;
const HISTORY_MONTHS = 24;

/** `null` = every status ("All" tab). */
export type LeaveStatusFilter = LeaveStatus | null;

/**
 * Admin views (the backend returns 403 to anyone else): today's board
 * (`TodayAll`), the monthly summary per employee (`Monthly`) and the leave
 * requests inbox (`Leaves` + `Review`). Page-scoped; each section loads only
 * when its tab is first opened.
 */
@Injectable()
export class TeamAttendanceStore {
  private readonly repo = inject(AttendanceRepository);
  private readonly todayStore = inject(AttendanceTodayStore);
  private readonly inbox = inject(LeaveInboxStore);
  private readonly destroyRef = inject(DestroyRef);

  private readonly todayState = new RemoteState<TodayAttendanceEntry[]>([]);
  private readonly monthlyState = new RemoteState<EmployeeMonthlyAttendance[]>([]);
  private readonly leavesState = new RemoteState<LeaveRequest[]>([]);
  private todayPolling = false;

  // ── today ──
  readonly todayEntries = this.todayState.value;
  readonly todayLoading = this.todayState.loading;
  readonly todayLoaded = this.todayState.loaded;
  readonly todayError = this.todayState.error;

  // ── monthly ──
  readonly period = signal<YearMonth>(ymOf(this.todayStore.day()));
  readonly employeeFilter = signal<string | null>(null);
  readonly monthly = computed(() =>
    [...this.monthlyState.value()].sort((a, b) => a.fullName.localeCompare(b.fullName)),
  );
  readonly monthlyLoading = this.monthlyState.loading;
  readonly monthlyLoaded = this.monthlyState.loaded;
  readonly monthlyError = this.monthlyState.error;
  /** Everyone seen in the unfiltered month — options of the employee filter. */
  readonly employees = signal<ReadonlyArray<{ userId: string; fullName: string }>>([]);

  private readonly currentYm = computed(() => ymOf(this.todayStore.day()));
  readonly canNext = computed(() => compareYm(this.period(), this.currentYm()) < 0);
  readonly canPrev = computed(() => compareYm(shiftYm(this.currentYm(), -HISTORY_MONTHS), this.period()) < 0);

  // ── leave requests ──
  readonly statusFilter = signal<LeaveStatusFilter>('Pending');
  readonly leavesYear = signal(ymOf(this.todayStore.day()).year);
  readonly leaves = computed(() => [...this.leavesState.value()].sort(compareLeaves));
  readonly leavesLoading = this.leavesState.loading;
  readonly leavesLoaded = this.leavesState.loaded;
  readonly leavesError = this.leavesState.error;

  constructor() {
    // A new request elsewhere → refresh the inbox if it is showing pending ones.
    this.inbox.submitted$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.leavesLoaded() && this.statusFilter() !== 'Approved' && this.statusFilter() !== 'Rejected') {
        this.loadLeaves(true);
      }
    });
  }

  // ─────────── today ───────────

  loadToday(quiet = false): void {
    this.todayState.load(this.repo.todayAll(), quiet);
    if (this.todayPolling) return;
    this.todayPolling = true;
    merge(interval(TODAY_REFRESH_MS), this.todayStore.changed$)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (document.visibilityState === 'visible') this.todayState.load(this.repo.todayAll(), true);
      });
  }

  // ─────────── monthly ───────────

  loadMonthly(quiet = false): void {
    const userId = this.employeeFilter();
    this.monthlyState.load(
      this.repo.monthly({ ...this.period(), userId }).pipe(
        tap((rows) => {
          // The unfiltered list doubles as the employee picker's options.
          if (!userId) this.employees.set(rows.map(({ userId: id, fullName }) => ({ userId: id, fullName })));
        }),
      ),
      quiet,
    );
  }

  shiftMonth(delta: number): void {
    if (delta > 0 && !this.canNext()) return;
    if (delta < 0 && !this.canPrev()) return;
    this.period.set(shiftYm(this.period(), delta));
    this.loadMonthly();
  }

  setEmployee(userId: string | null): void {
    if (userId === this.employeeFilter()) return;
    this.employeeFilter.set(userId);
    this.loadMonthly();
  }

  // ─────────── leave requests ───────────

  loadLeaves(quiet = false): void {
    this.leavesState.load(
      this.repo.leaves({ status: this.statusFilter(), year: this.leavesYear() }),
      quiet,
    );
  }

  setStatusFilter(status: LeaveStatusFilter): void {
    if (status === this.statusFilter()) return;
    this.statusFilter.set(status);
    this.loadLeaves();
  }

  setLeavesYear(year: number): void {
    if (year === this.leavesYear()) return;
    this.leavesYear.set(year);
    this.loadLeaves();
  }

  review(id: number, input: LeaveReviewInput): Observable<LeaveRequest | null> {
    return this.repo.reviewLeave(id, input).pipe(
      tap(() => {
        const status: LeaveStatus = input.approve ? 'Approved' : 'Rejected';
        this.leavesState.update((list) =>
          this.statusFilter() === 'Pending'
            ? list.filter((l) => l.id !== id)
            : list.map((l) => (l.id === id ? { ...l, status, reviewNote: input.note } : l)),
        );
        this.loadLeaves(true);
        this.inbox.refreshPending();
        // Approved leave changes the monthly leave days.
        if (input.approve && this.monthlyLoaded()) this.loadMonthly(true);
      }),
    );
  }
}
