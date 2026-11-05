import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AttendanceRecord,
  AttendanceToday,
  ClockNoteInput,
  EmployeeMonthlyAttendance,
  LeaveListQuery,
  LeaveRequest,
  LeaveRequestInput,
  LeaveReviewInput,
  MonthlyAttendance,
  MonthlyQuery,
  TodayAttendanceEntry,
  YearMonth,
} from '../models/attendance.models';
import { HttpAttendanceRepository } from './http-attendance.repository';

/**
 * Persistence port for attendance & leave. The stores depend only on this
 * contract (swap it in tests with `{ provide: AttendanceRepository, useValue }`).
 *
 * The server owns the clock (check-in / out are stamped server-side), every
 * total, overlap / double-check-in validation and the review notifications.
 * Admin methods return 403 / "Unauthorized access." for everyone else.
 */
@Injectable({ providedIn: 'root', useExisting: HttpAttendanceRepository })
export abstract class AttendanceRepository {
  // ─────────── me ───────────
  abstract today(): Observable<AttendanceToday>;
  abstract checkIn(input: ClockNoteInput): Observable<AttendanceRecord | null>;
  abstract checkOut(input: ClockNoteInput): Observable<AttendanceRecord | null>;
  abstract myMonth(period: YearMonth): Observable<MonthlyAttendance>;
  abstract myLeaves(year: number): Observable<LeaveRequest[]>;
  abstract requestLeave(input: LeaveRequestInput): Observable<LeaveRequest | null>;
  /** Only a pending request can be cancelled. */
  abstract cancelLeave(id: number): Observable<void>;

  // ─────────── admin ───────────
  abstract todayAll(): Observable<TodayAttendanceEntry[]>;
  abstract monthly(query: MonthlyQuery): Observable<EmployeeMonthlyAttendance[]>;
  abstract leaves(query: LeaveListQuery): Observable<LeaveRequest[]>;
  abstract reviewLeave(id: number, input: LeaveReviewInput): Observable<LeaveRequest | null>;
}
