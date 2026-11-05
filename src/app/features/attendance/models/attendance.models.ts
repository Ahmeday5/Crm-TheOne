/**
 * Attendance & leave — `docs/api/attendance.md`.
 *
 * `*Dto` types mirror the wire format (Cairo wall-clock timestamps, possibly
 * without a zone). Everything else is the normalised domain the UI uses:
 * calendar days are `YYYY-MM-DD` (Cairo) and instants are UTC ISO strings.
 * All numbers (hours, day counts, totals) are the server's — the client
 * never re-derives them.
 */

// ─────────────────────────── leave enums ───────────────────────────

export type LeaveType = 'Annual' | 'Sick' | 'Casual' | 'Unpaid' | 'Other';
export const LEAVE_TYPES: ReadonlyArray<LeaveType> = ['Annual', 'Sick', 'Casual', 'Unpaid', 'Other'];

export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
export const LEAVE_STATUSES: ReadonlyArray<LeaveStatus> = ['Pending', 'Approved', 'Rejected', 'Cancelled'];

/** Server limit on the leave reason. */
export const LEAVE_REASON_MAX = 1000;

// ─────────────────────────── wire DTOs ───────────────────────────

export interface AttendanceRecordDto {
  workDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  workedHours: number | null;
  checkInNote?: string | null;
  checkOutNote?: string | null;
}

export interface AttendanceTodayDto {
  date: string;
  checkedIn: boolean;
  checkedOut: boolean;
  onLeave: boolean;
  record: AttendanceRecordDto | null;
}

export interface LeaveRequestDto {
  id: number;
  userId?: string | null;
  fullName?: string | null;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: string;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface MonthlyAttendanceDto {
  userId?: string;
  fullName?: string;
  presentDays: number;
  totalHours: number;
  leaveDays: number;
  missingCheckOuts: number;
  records: AttendanceRecordDto[] | null;
  leaves: LeaveRequestDto[] | null;
}

export interface TodayAttendanceEntryDto {
  userId: string;
  fullName: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  workedHours: number | null;
}

// ─────────────────────────── domain ───────────────────────────

export interface AttendanceRecord {
  /** `YYYY-MM-DD` (Cairo). */
  workDate: string;
  /** UTC ISO instants. */
  checkInAt: string | null;
  checkOutAt: string | null;
  /** Server-computed; `null` while still checked in. */
  workedHours: number | null;
  checkInNote: string | null;
  checkOutNote: string | null;
}

/** Where today stands for the signed-in user. */
export type ClockState = 'onLeave' | 'notStarted' | 'working' | 'done';

export interface AttendanceToday {
  date: string;
  checkedIn: boolean;
  checkedOut: boolean;
  onLeave: boolean;
  record: AttendanceRecord | null;
}

export interface LeaveRequest {
  id: number;
  userId: string | null;
  /** Admin lists only. */
  fullName: string | null;
  type: LeaveType;
  /** `YYYY-MM-DD`, inclusive. */
  startDate: string;
  endDate: string;
  /** Server-computed number of days. */
  days: number;
  reason: string;
  status: LeaveStatus;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface MonthlyAttendance {
  presentDays: number;
  totalHours: number;
  leaveDays: number;
  missingCheckOuts: number;
  records: AttendanceRecord[];
  leaves: LeaveRequest[];
}

/** One employee's month (admin "everyone" view). */
export interface EmployeeMonthlyAttendance extends MonthlyAttendance {
  userId: string;
  fullName: string;
}

export interface TodayAttendanceEntry {
  userId: string;
  fullName: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  workedHours: number | null;
}

/** `{ year, month }` with month 1–12. */
export interface YearMonth {
  year: number;
  month: number;
}

// ─────────────────────────── requests ───────────────────────────

export interface ClockNoteInput {
  note: string | null;
}

export interface LeaveRequestInput {
  type: LeaveType;
  /** `YYYY-MM-DD`, inclusive. */
  startDate: string;
  endDate: string;
  reason: string;
}

export interface LeaveReviewInput {
  approve: boolean;
  note: string | null;
}

export interface LeaveListQuery {
  status?: LeaveStatus | null;
  userId?: string | null;
  year?: number | null;
}

export interface MonthlyQuery extends YearMonth {
  userId?: string | null;
}

// ─────────────────────────── calendar view ───────────────────────────

/**
 * How a day reads on the calendar (server data only — no invented rules):
 *  - `present`    checked in and out (green, with hours)
 *  - `working`    today, checked in, not out yet
 *  - `missingOut` a past day with a check-in but no check-out (orange)
 *  - `leave`      inside an approved leave (blue)
 *  - `none`       nothing recorded
 */
export type DayStatus = 'present' | 'working' | 'missingOut' | 'leave' | 'none';

export const DAY_STATUS_LEGEND: ReadonlyArray<DayStatus> = ['present', 'missingOut', 'leave'];

export interface CalendarDay {
  date: string;
  dayOfMonth: number;
  status: DayStatus;
  isToday: boolean;
  isFuture: boolean;
  record: AttendanceRecord | null;
  leave: LeaveRequest | null;
}
