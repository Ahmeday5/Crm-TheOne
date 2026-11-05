import { Injectable, inject } from '@angular/core';
import { Observable, defer, delay, filter, fromEvent, map, of, throwError } from 'rxjs';
import { ApiError } from '../../../core/models/api-response.model';
import { AuthService } from '../../../core/services/auth.service';
import {
  ATTENDANCE_POLICY,
  LEAVE_ENTITLEMENTS,
  PUBLIC_HOLIDAYS,
  PublicHoliday,
} from '../config/attendance.config';
import {
  AttendanceEmployee,
  AttendanceRecord,
  LeaveBalance,
  LeaveDecision,
  LeaveRequest,
  LeaveRequestInput,
} from '../models/attendance.models';
import { toHolidayLookup } from '../utils/attendance-calc.util';
import { cairoDayOf, cairoToday } from '../utils/attendance-date.util';
import {
  compareLeaves,
  computeBalances,
  countLeaveDays,
  validateLeaveRequest,
} from '../utils/leave.util';
import { AttendanceRepository } from './attendance.repository';
import { SeedContext, mockEmployees, seedLeaves, seedRecords } from './mock/attendance-seed';

const STORAGE_KEY = 'crm.attendance.mock.v1';
/** Small artificial latency so loading states are exercised like the real API. */
const LATENCY_MS = 220;
const HOLIDAYS = toHolidayLookup(PUBLIC_HOLIDAYS);

/** Only what users actually did — seeded history is regenerated on read. */
interface MockState {
  /** Real punches, one per (userId, date). They win over seeded ones. */
  records: AttendanceRecord[];
  /** Requests filed in this browser. */
  leaves: LeaveRequest[];
  /** Status changes applied to any request (seeded or filed) by id. */
  overrides: Record<string, Partial<LeaveRequest>>;
}

const EMPTY_STATE: MockState = { records: [], leaves: [], overrides: {} };

/**
 * TEMPORARY adapter until `/api/Attendance` exists on the backend.
 *
 * History of the signed-in user and eight colleagues is generated from a
 * seeded PRNG (stable across reloads); everything users do is persisted in
 * `localStorage`. Mirrors the server contract — server-side clock, admin-only
 * team endpoints, leave validation — so swapping in
 * `HttpAttendanceRepository` needs no UI change.
 */
@Injectable({ providedIn: 'root' })
export class MockAttendanceRepository extends AttendanceRepository {
  private readonly auth = inject(AuthService);

  /** Another tab wrote to the same storage key. */
  readonly externalChanges$: Observable<void> = fromEvent<StorageEvent>(window, 'storage').pipe(
    filter((e) => e.key === STORAGE_KEY),
    map(() => undefined),
  );

  holidays(): Observable<PublicHoliday[]> {
    return of([...PUBLIC_HOLIDAYS]);
  }

  // ─────────── my attendance ───────────

  myRecords(from: string, to: string): Observable<AttendanceRecord[]> {
    return this.respond(() => {
      const me = this.me();
      if (!me) return this.fail(401, 'unauthorized', 'Not signed in.');
      return of(this.recordsFor(me, from, to));
    });
  }

  checkIn(): Observable<AttendanceRecord> {
    return this.respond(() => {
      const me = this.me();
      if (!me) return this.fail(401, 'unauthorized', 'Not signed in.');
      const now = new Date();
      const today = cairoDayOf(now);
      if (this.recordsFor(me, today, today).length) {
        return this.fail(409, 'alreadyCheckedIn', 'Already checked in today.');
      }
      const record: AttendanceRecord = {
        id: `${me.id}|${today}`,
        userId: me.id,
        date: today,
        checkIn: now.toISOString(),
        checkOut: null,
      };
      this.update((s) => ({ ...s, records: [...s.records, record] }));
      return of(record);
    });
  }

  checkOut(): Observable<AttendanceRecord> {
    return this.respond(() => {
      const me = this.me();
      if (!me) return this.fail(401, 'unauthorized', 'Not signed in.');
      const now = new Date();
      const today = cairoDayOf(now);
      const open = this.recordsFor(me, today, today)[0];
      if (!open) return this.fail(409, 'notCheckedIn', 'You have not checked in today.');
      if (open.checkOut) return this.fail(409, 'alreadyCheckedOut', 'Already checked out today.');
      const closed: AttendanceRecord = { ...open, checkOut: now.toISOString() };
      this.update((s) => ({
        ...s,
        records: [...s.records.filter((r) => r.id !== closed.id), closed],
      }));
      return of(closed);
    });
  }

  // ─────────── my leave ───────────

  myLeaves(): Observable<LeaveRequest[]> {
    return this.respond(() => {
      const me = this.me();
      if (!me) return this.fail(401, 'unauthorized', 'Not signed in.');
      return of(this.leavesFor(me).sort(compareLeaves));
    });
  }

  myBalances(year: number): Observable<LeaveBalance[]> {
    return this.respond(() => {
      const me = this.me();
      if (!me) return this.fail(401, 'unauthorized', 'Not signed in.');
      return of(computeBalances(this.leavesFor(me), year, LEAVE_ENTITLEMENTS));
    });
  }

  requestLeave(input: LeaveRequestInput): Observable<LeaveRequest> {
    return this.respond(() => {
      const me = this.me();
      if (!me) return this.fail(401, 'unauthorized', 'Not signed in.');
      const today = cairoToday();
      const existing = this.leavesFor(me);
      const error = validateLeaveRequest(input, {
        today,
        policy: ATTENDANCE_POLICY,
        holidays: HOLIDAYS,
        existing,
        balances: computeBalances(existing, Number(input.from.slice(0, 4)), LEAVE_ENTITLEMENTS),
      });
      if (error) return this.fail(400, error, `Leave request rejected: ${error}.`);

      const request: LeaveRequest = {
        id: this.newId(),
        userId: me.id,
        employeeName: me.name,
        employeeRole: me.role,
        employeeImageUrl: me.imageUrl,
        type: input.type,
        from: input.from,
        to: input.halfDay ? input.from : input.to,
        halfDay: input.halfDay,
        days: countLeaveDays(input.from, input.to, input.halfDay, ATTENDANCE_POLICY, HOLIDAYS),
        reason: input.reason.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
        decidedAt: null,
        decidedBy: null,
        rejectionReason: null,
      };
      this.update((s) => ({ ...s, leaves: [request, ...s.leaves] }));
      return of(request);
    });
  }

  cancelLeave(id: string): Observable<LeaveRequest> {
    return this.respond(() => {
      const me = this.me();
      if (!me) return this.fail(401, 'unauthorized', 'Not signed in.');
      const target = this.leavesFor(me).find((l) => l.id === id);
      if (!target) return this.fail(404, 'notFound', 'Leave request not found.');
      if (target.status !== 'pending') return this.fail(409, 'notPending', 'Only pending requests can be cancelled.');
      return of(this.override(target, { status: 'cancelled', decidedAt: new Date().toISOString() }));
    });
  }

  // ─────────── admin ───────────

  employees(): Observable<AttendanceEmployee[]> {
    return this.respond(() => (this.isAdmin() ? of(this.directory()) : this.forbidden()));
  }

  teamRecords(from: string, to: string): Observable<AttendanceRecord[]> {
    return this.respond(() => {
      if (!this.isAdmin()) return this.forbidden();
      return of(this.directory().flatMap((e) => this.recordsFor(e, from, to)));
    });
  }

  teamLeaves(): Observable<LeaveRequest[]> {
    return this.respond(() => {
      if (!this.isAdmin()) return this.forbidden();
      return of(this.directory().flatMap((e) => this.leavesFor(e)).sort(compareLeaves));
    });
  }

  decideLeave(id: string, decision: LeaveDecision): Observable<LeaveRequest> {
    return this.respond(() => {
      if (!this.isAdmin()) return this.forbidden();
      const reason = decision.reason?.trim() ?? '';
      if (!decision.approve && !reason) {
        return this.fail(400, 'reasonRequired', 'A reason is required to reject a request.');
      }
      const target = this.directory()
        .flatMap((e) => this.leavesFor(e))
        .find((l) => l.id === id);
      if (!target) return this.fail(404, 'notFound', 'Leave request not found.');
      if (target.status !== 'pending') return this.fail(409, 'notPending', 'This request was already handled.');

      const admin = this.auth.currentUser();
      return of(
        this.override(target, {
          status: decision.approve ? 'approved' : 'rejected',
          decidedAt: new Date().toISOString(),
          decidedBy: { id: admin?.userId ?? '', name: admin?.fullName || admin?.email || '' },
          rejectionReason: decision.approve ? null : reason,
        }),
      );
    });
  }

  // ─────────── internals: people ───────────

  /** The signed-in user as an employee. */
  private me(): AttendanceEmployee | null {
    const user = this.auth.currentUser();
    if (!user) return null;
    return {
      id: user.userId,
      name: user.fullName || user.email,
      email: user.email,
      role: user.role,
      imageUrl: user.imageUrl ?? null,
    };
  }

  /** Everyone tracked: the signed-in user first, then the seeded colleagues. */
  private directory(): AttendanceEmployee[] {
    const me = this.me();
    const others = mockEmployees().filter((e) => e.id !== me?.id);
    return me ? [me, ...others] : others;
  }

  private isColleague(e: AttendanceEmployee): boolean {
    return e.id.startsWith('att-emp-');
  }

  // ─────────── internals: data ───────────

  private seedContext(): SeedContext {
    const now = new Date();
    return { now, today: cairoDayOf(now), policy: ATTENDANCE_POLICY, holidays: HOLIDAYS };
  }

  /** Seeded + filed requests of one employee with decisions applied. */
  private leavesFor(employee: AttendanceEmployee): LeaveRequest[] {
    const state = this.read();
    const seeded = seedLeaves(employee, this.seedContext(), { withPending: this.isColleague(employee) });
    const filed = state.leaves.filter((l) => l.userId === employee.id);
    return [...seeded, ...filed].map((l) => {
      const patch = state.overrides[l.id];
      const merged = patch ? { ...l, ...patch } : l;
      // Keep identity fields current (name / avatar may have changed).
      return {
        ...merged,
        employeeName: employee.name,
        employeeRole: employee.role,
        employeeImageUrl: employee.imageUrl,
      };
    });
  }

  /** Seeded history overlaid by real punches, for `[from, to]`. */
  private recordsFor(employee: AttendanceEmployee, from: string, to: string): AttendanceRecord[] {
    const ctx = this.seedContext();
    const colleague = this.isColleague(employee);
    const seeded = seedRecords(employee.id, from, to, this.leavesFor(employee), ctx, {
      // The signed-in user punches today themselves; colleagues "arrive" live.
      includeToday: colleague,
    });
    const real = this.read().records.filter(
      (r) => r.userId === employee.id && r.date >= from && r.date <= to,
    );
    const byDate = new Map(seeded.map((r) => [r.date, r]));
    for (const r of real) byDate.set(r.date, r);
    return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  }

  private override(target: LeaveRequest, changes: Partial<LeaveRequest>): LeaveRequest {
    this.update((s) => ({
      ...s,
      overrides: { ...s.overrides, [target.id]: { ...s.overrides[target.id], ...changes } },
    }));
    return { ...target, ...changes };
  }

  private read(): MockState {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<MockState> | null;
      if (!raw || typeof raw !== 'object') return EMPTY_STATE;
      return {
        records: Array.isArray(raw.records) ? raw.records : [],
        leaves: Array.isArray(raw.leaves) ? raw.leaves : [],
        overrides: raw.overrides && typeof raw.overrides === 'object' ? raw.overrides : {},
      };
    } catch {
      return EMPTY_STATE;
    }
  }

  private update(fn: (state: MockState) => MockState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fn(this.read())));
    } catch {
      /* storage full / blocked — the next read simply won't see the change */
    }
  }

  // ─────────── internals: plumbing ───────────

  private respond<T>(factory: () => Observable<T>): Observable<T> {
    return defer(factory).pipe(delay(LATENCY_MS));
  }

  private isAdmin(): boolean {
    return this.auth.currentRole() === 'Admin';
  }

  private forbidden(): Observable<never> {
    return this.fail(403, 'forbidden', 'Only admins can view the team attendance.');
  }

  private fail(status: number, code: string, message: string): Observable<never> {
    const error: ApiError = { status, code, message };
    return throwError(() => error);
  }

  private newId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
