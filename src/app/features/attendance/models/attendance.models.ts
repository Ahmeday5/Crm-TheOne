import { UserRole } from '../../../core/models/auth.model';

// ─────────────────────────── people ───────────────────────────

/** Someone whose attendance is tracked (every role, Admin included). */
export interface AttendanceEmployee {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  imageUrl: string | null;
}

export const ATTENDANCE_ROLES: ReadonlyArray<UserRole> = [
  'Sales',
  'Marketing',
  'Support',
  'Developer',
  'Admin',
];

// ─────────────────────────── attendance ───────────────────────────

/**
 * One check-in / check-out pair for one employee on one Cairo calendar day.
 * Timestamps are UTC ISO-8601; `checkOut` is `null` while still working.
 */
export interface AttendanceRecord {
  id: string;
  userId: string;
  /** `YYYY-MM-DD` (Cairo). */
  date: string;
  checkIn: string;
  checkOut: string | null;
}

/**
 * How a day reads on the calendar.
 *  - `upcoming` → a future workday
 *  - `pending`  → today, not checked in yet (becomes `absent` tomorrow)
 */
export type DayStatus =
  | 'present'
  | 'late'
  | 'absent'
  | 'leave'
  | 'weekend'
  | 'holiday'
  | 'pending'
  | 'upcoming';

export const DAY_STATUSES_LEGEND: ReadonlyArray<DayStatus> = [
  'present',
  'late',
  'absent',
  'leave',
  'weekend',
  'holiday',
];

/** A fully resolved day — what the calendar, table and matrix render. */
export interface AttendanceDay {
  date: string;
  /** `Date#getUTCDay()` of the calendar date. */
  weekday: number;
  dayOfMonth: number;
  status: DayStatus;
  isToday: boolean;
  checkIn: string | null;
  checkOut: string | null;
  /** Still checked in (only possible today). */
  isOpen: boolean;
  workedMinutes: number;
  lateMinutes: number;
  overtimeMinutes: number;
  /** Worked on a weekend / holiday. */
  isExtra: boolean;
  holidayName: { ar: string; en: string } | null;
  leave: { type: LeaveType; halfDay: boolean } | null;
}

export interface MonthSummary {
  /** Workdays elapsed so far in the month (excludes weekends, holidays, future). */
  workdays: number;
  present: number;
  late: number;
  absent: number;
  leaveDays: number;
  totalMinutes: number;
  lateMinutes: number;
  overtimeMinutes: number;
  /** `present / (workdays - leaveDays)` as 0–100. */
  attendanceRate: number;
  /** Average check-in in Cairo minutes after midnight, `null` without data. */
  avgCheckInMinutes: number | null;
}

/** Live state of the time clock for today. */
export type ClockState = 'notStarted' | 'working' | 'done';

// ─────────────────────────── leave ───────────────────────────

export type LeaveType = 'annual' | 'sick' | 'casual';
export const LEAVE_TYPES: ReadonlyArray<LeaveType> = ['annual', 'sick', 'casual'];

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveDecider {
  id: string;
  name: string;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  employeeName: string;
  employeeRole: UserRole;
  employeeImageUrl: string | null;
  type: LeaveType;
  /** `YYYY-MM-DD`, inclusive. */
  from: string;
  /** `YYYY-MM-DD`, inclusive (equals `from` for a half day). */
  to: string;
  halfDay: boolean;
  /** Working days charged to the balance (0.5 for a half day). */
  days: number;
  reason: string;
  status: LeaveStatus;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: LeaveDecider | null;
  rejectionReason: string | null;
}

/** Body of a new leave request. */
export interface LeaveRequestInput {
  type: LeaveType;
  from: string;
  to: string;
  halfDay: boolean;
  reason: string;
}

export interface LeaveDecision {
  approve: boolean;
  /** Required when rejecting. */
  reason?: string;
}

export interface LeaveBalance {
  type: LeaveType;
  entitled: number;
  used: number;
  pending: number;
  /** `entitled - used - pending` — what a new request may consume. */
  available: number;
}

/** Why a leave request can't be submitted (client and server share these codes). */
export type LeaveValidationError =
  | 'endBeforeStart'
  | 'startInPast'
  | 'halfDayRange'
  | 'noWorkingDays'
  | 'overlap'
  | 'insufficientBalance';

// ─────────────────────────── admin board ───────────────────────────

/**
 * Today's situation of one employee.
 *  - `working`   checked in, not out yet
 *  - `done`      checked in and out
 *  - `notYet`    not in, still inside the grace window
 *  - `absent`    not in, grace window passed
 *  - `leave`     approved leave today
 *  - `off`       weekend / holiday
 */
export type PresenceState = 'working' | 'done' | 'notYet' | 'absent' | 'leave' | 'off';

export interface PresenceEntry {
  employee: AttendanceEmployee;
  state: PresenceState;
  isLate: boolean;
  lateMinutes: number;
  checkIn: string | null;
  checkOut: string | null;
  leaveType: LeaveType | null;
}

export interface TeamMatrixRow {
  employee: AttendanceEmployee;
  days: AttendanceDay[];
  summary: MonthSummary;
}

/** A pending request as the admin inbox shows it. */
export interface PendingApproval {
  request: LeaveRequest;
  /** Days the employee still has of that type, before this request. */
  available: number;
  /** Colleagues of the same department already on approved leave in that period. */
  colleaguesAway: number;
}
