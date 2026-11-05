import { eachDay, monthDays } from '../../../core/utils/cairo-time.util';
import {
  AttendanceRecord,
  AttendanceToday,
  CalendarDay,
  ClockState,
  DayStatus,
  LeaveRequest,
  YearMonth,
} from '../models/attendance.models';

/**
 * Pure calendar helpers — no Angular, no I/O. The calendar only paints what
 * the server returned (records + approved leaves); it never invents
 * absences, lateness or holidays.
 */

/** Weeks start on Saturday, as in Egyptian offices. */
export const WEEK_STARTS_ON = 6;

/** `YYYY-MM` key of a period. */
export function ymKey({ year, month }: YearMonth): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function ymOf(day: string): YearMonth {
  const [year, month] = day.split('-').map(Number);
  return { year, month };
}

export function shiftYm({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function compareYm(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

/** Where today stands — drives the time clock and the header chip. */
export function clockStateOf(today: AttendanceToday | null): ClockState {
  if (!today) return 'notStarted';
  if (today.checkedOut) return 'done';
  if (today.checkedIn) return 'working';
  if (today.onLeave) return 'onLeave';
  return 'notStarted';
}

/** Every day of the month with its status. */
export function buildCalendarDays(
  period: YearMonth,
  records: ReadonlyArray<AttendanceRecord>,
  leaves: ReadonlyArray<LeaveRequest>,
  today: string,
): CalendarDay[] {
  const byDay = new Map(records.map((r) => [r.workDate, r]));
  const leaveByDay = new Map<string, LeaveRequest>();
  for (const leave of leaves) {
    if (leave.status !== 'Approved') continue;
    for (const day of eachDay(leave.startDate, leave.endDate)) leaveByDay.set(day, leave);
  }

  return monthDays(ymKey(period)).map((date) => {
    const record = byDay.get(date) ?? null;
    const leave = leaveByDay.get(date) ?? null;
    return {
      date,
      dayOfMonth: Number(date.slice(8, 10)),
      status: dayStatus(record, leave, date === today),
      isToday: date === today,
      isFuture: date > today,
      record,
      leave,
    };
  });
}

function dayStatus(record: AttendanceRecord | null, leave: LeaveRequest | null, isToday: boolean): DayStatus {
  if (record?.checkInAt) {
    if (record.checkOutAt) return 'present';
    return isToday ? 'working' : 'missingOut';
  }
  return leave ? 'leave' : 'none';
}

/** `8.08` → "8.08" with at most two decimals (server hours, localised digits). */
export function formatHours(hours: number | null | undefined, locale: string): string {
  return (hours ?? 0).toLocaleString(locale, { maximumFractionDigits: 2 });
}
