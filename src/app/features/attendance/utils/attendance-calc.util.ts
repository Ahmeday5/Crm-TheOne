import {
  AttendanceDay,
  AttendanceEmployee,
  AttendanceRecord,
  ClockState,
  DayStatus,
  LeaveRequest,
  MonthSummary,
  PresenceEntry,
} from '../models/attendance.models';
import { cairoMinutesOf, minutesBetween, weekdayOf } from './attendance-date.util';

/**
 * Pure attendance rules — no Angular, no I/O. Every screen (calendar, day
 * table, team matrix, today's board) resolves days through these functions,
 * so a rule changes in exactly one place. The mock repository uses the same
 * rules to validate, mirroring what the backend will enforce.
 */

export interface AttendancePolicy {
  workStartMinutes: number;
  workEndMinutes: number;
  graceMinutes: number;
  workdayMinutes: number;
  weekendDays: ReadonlyArray<number>;
}

export type HolidayName = { ar: string; en: string };
export type HolidayLookup = ReadonlyMap<string, HolidayName>;

export function toHolidayLookup(list: ReadonlyArray<{ date: string; name: HolidayName }>): HolidayLookup {
  return new Map(list.map((h) => [h.date, h.name]));
}

export function isWeekend(day: string, policy: Pick<AttendancePolicy, 'weekendDays'>): boolean {
  return policy.weekendDays.includes(weekdayOf(day));
}

/** A day people are expected at work. */
export function isWorkday(
  day: string,
  policy: Pick<AttendancePolicy, 'weekendDays'>,
  holidays: HolidayLookup,
): boolean {
  return !isWeekend(day, policy) && !holidays.has(day);
}

/**
 * Minutes late for a check-in. Inside the grace window it is 0; past it,
 * lateness counts from the official start (09:20 → 20 minutes late).
 */
export function lateMinutesFor(
  checkIn: string,
  policy: Pick<AttendancePolicy, 'workStartMinutes' | 'graceMinutes'>,
): number {
  const diff = cairoMinutesOf(checkIn) - policy.workStartMinutes;
  return diff > policy.graceMinutes ? diff : 0;
}

/** Minutes worked; an open record counts up to `now`. */
export function workedMinutes(
  record: Pick<AttendanceRecord, 'checkIn' | 'checkOut'> | null | undefined,
  now: Date,
): number {
  if (!record?.checkIn) return 0;
  return minutesBetween(record.checkIn, record.checkOut ?? now);
}

export function clockStateOf(record: AttendanceRecord | null | undefined): ClockState {
  if (!record) return 'notStarted';
  return record.checkOut ? 'done' : 'working';
}

/** The approved leave covering `day`, if any. */
export function approvedLeaveOn(day: string, leaves: ReadonlyArray<LeaveRequest>): LeaveRequest | null {
  return leaves.find((l) => l.status === 'approved' && l.from <= day && day <= l.to) ?? null;
}

export interface DayContext {
  today: string;
  now: Date;
  policy: AttendancePolicy;
  holidays: HolidayLookup;
  /** The employee's leave requests (any status — only approved ones count). */
  leaves: ReadonlyArray<LeaveRequest>;
}

/** Resolves one calendar day for one employee. */
export function resolveDay(
  day: string,
  record: AttendanceRecord | null | undefined,
  ctx: DayContext,
): AttendanceDay {
  const weekday = weekdayOf(day);
  const holidayName = ctx.holidays.get(day) ?? null;
  const weekend = isWeekend(day, ctx.policy);
  const offDay = weekend || !!holidayName;
  const leave = offDay ? null : approvedLeaveOn(day, ctx.leaves);
  const isToday = day === ctx.today;

  const worked = workedMinutes(record, ctx.now);
  const late = record && !offDay && !leave ? lateMinutesFor(record.checkIn, ctx.policy) : 0;
  const overtime = record
    ? offDay
      ? worked
      : record.checkOut
        ? Math.max(0, worked - ctx.policy.workdayMinutes)
        : 0
    : 0;

  let status: DayStatus;
  if (leave) status = 'leave';
  else if (record) status = offDay ? 'present' : late > 0 ? 'late' : 'present';
  else if (holidayName) status = 'holiday';
  else if (weekend) status = 'weekend';
  else if (day > ctx.today) status = 'upcoming';
  else if (isToday) status = 'pending';
  else status = 'absent';

  return {
    date: day,
    weekday,
    dayOfMonth: Number(day.slice(8, 10)),
    status,
    isToday,
    checkIn: record?.checkIn ?? null,
    checkOut: record?.checkOut ?? null,
    isOpen: !!record && !record.checkOut,
    workedMinutes: worked,
    lateMinutes: late,
    overtimeMinutes: overtime,
    isExtra: !!record && offDay,
    holidayName,
    leave: leave ? { type: leave.type, halfDay: leave.halfDay } : null,
  };
}

/** Resolves a list of days against one employee's records. */
export function buildDays(
  days: ReadonlyArray<string>,
  records: ReadonlyArray<AttendanceRecord>,
  ctx: DayContext,
): AttendanceDay[] {
  const byDate = new Map(records.map((r) => [r.date, r]));
  return days.map((d) => resolveDay(d, byDate.get(d), ctx));
}

/** Totals of a month (or any span) of resolved days. */
export function summarizeDays(days: ReadonlyArray<AttendanceDay>): MonthSummary {
  let workdays = 0;
  let present = 0;
  let late = 0;
  let absent = 0;
  let leaveDays = 0;
  let totalMinutes = 0;
  let lateMinutes = 0;
  let overtimeMinutes = 0;
  let checkInSum = 0;
  let checkInCount = 0;

  for (const d of days) {
    totalMinutes += d.workedMinutes;
    overtimeMinutes += d.overtimeMinutes;
    lateMinutes += d.lateMinutes;
    if (d.checkIn && !d.isExtra) {
      checkInSum += cairoMinutesOf(d.checkIn);
      checkInCount++;
    }
    switch (d.status) {
      case 'present':
        if (!d.isExtra) {
          workdays++;
          present++;
        }
        break;
      case 'late':
        workdays++;
        present++;
        late++;
        break;
      case 'absent':
        workdays++;
        absent++;
        break;
      case 'leave':
        workdays++;
        leaveDays += d.leave?.halfDay ? 0.5 : 1;
        break;
      case 'pending':
        // Today, not checked in yet — not counted against anyone.
        break;
    }
  }

  const expected = workdays - leaveDays;
  return {
    workdays,
    present,
    late,
    absent,
    leaveDays,
    totalMinutes,
    lateMinutes,
    overtimeMinutes,
    attendanceRate: expected > 0 ? Math.min(100, Math.round((present / expected) * 100)) : 0,
    avgCheckInMinutes: checkInCount ? Math.round(checkInSum / checkInCount) : null,
  };
}

/** Where an employee stands right now — feeds the admin's live board. */
export function presenceOf(
  employee: AttendanceEmployee,
  record: AttendanceRecord | null | undefined,
  ctx: DayContext,
): PresenceEntry {
  const day = resolveDay(ctx.today, record, ctx);
  const nowMinutes = cairoMinutesOf(ctx.now);
  const base = {
    employee,
    checkIn: day.checkIn,
    checkOut: day.checkOut,
    isLate: day.lateMinutes > 0,
    lateMinutes: day.lateMinutes,
    leaveType: day.leave?.type ?? null,
  };

  if (day.status === 'leave') return { ...base, state: 'leave' };
  if (record) return { ...base, state: record.checkOut ? 'done' : 'working' };
  if (day.status === 'weekend' || day.status === 'holiday') return { ...base, state: 'off' };
  const graceEnds = ctx.policy.workStartMinutes + ctx.policy.graceMinutes;
  return { ...base, state: nowMinutes > graceEnds ? 'absent' : 'notYet' };
}

/** Progress of the workday, 0–1. */
export function workdayProgress(worked: number, policy: Pick<AttendancePolicy, 'workdayMinutes'>): number {
  return Math.max(0, Math.min(1, worked / policy.workdayMinutes));
}
