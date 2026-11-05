import { Observable } from 'rxjs';
import { PublicHoliday } from '../config/attendance.config';
import {
  AttendanceEmployee,
  AttendanceRecord,
  LeaveBalance,
  LeaveDecision,
  LeaveRequest,
  LeaveRequestInput,
} from '../models/attendance.models';

/**
 * Persistence port for attendance & leave.
 *
 * The store and UI depend only on this contract; the concrete adapter
 * (mock today, HTTP once the backend ships) is chosen in exactly one place:
 * `ATTENDANCE_REPOSITORY` in `attendance-repository.provider.ts`.
 *
 * Contract every adapter honours (see `docs/api/attendance.md`):
 *   - the server stamps check-in / check-out with its own clock — the client
 *     never sends a time;
 *   - `my*` methods act on the signed-in user only;
 *   - team methods and `decideLeave` are Admin-only (others get an error);
 *   - `requestLeave` re-validates overlap, dates and balance server-side.
 */
export abstract class AttendanceRepository {
  /** Official holidays (the calendar paints them and leave skips them). */
  abstract holidays(): Observable<PublicHoliday[]>;

  // ─────────── my attendance ───────────
  /** My records with `date` in `[from, to]` (inclusive `YYYY-MM-DD`). */
  abstract myRecords(from: string, to: string): Observable<AttendanceRecord[]>;
  abstract checkIn(): Observable<AttendanceRecord>;
  abstract checkOut(): Observable<AttendanceRecord>;

  // ─────────── my leave ───────────
  abstract myLeaves(): Observable<LeaveRequest[]>;
  abstract myBalances(year: number): Observable<LeaveBalance[]>;
  abstract requestLeave(input: LeaveRequestInput): Observable<LeaveRequest>;
  /** Only a pending request can be cancelled. */
  abstract cancelLeave(id: string): Observable<LeaveRequest>;

  // ─────────── admin ───────────
  abstract employees(): Observable<AttendanceEmployee[]>;
  abstract teamRecords(from: string, to: string): Observable<AttendanceRecord[]>;
  /** Every request in the company — pending ones and the decision history. */
  abstract teamLeaves(): Observable<LeaveRequest[]>;
  abstract decideLeave(id: string, decision: LeaveDecision): Observable<LeaveRequest>;

  /**
   * Fires when data changed somewhere else (another tab, a push event…) so
   * the store can refetch. Adapters without such a signal return `EMPTY`.
   */
  abstract readonly externalChanges$: Observable<void>;
}
