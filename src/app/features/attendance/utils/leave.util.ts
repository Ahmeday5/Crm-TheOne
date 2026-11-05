import {
  LEAVE_TYPES,
  LeaveBalance,
  LeaveRequest,
  LeaveRequestInput,
  LeaveStatus,
  LeaveType,
  LeaveValidationError,
} from '../models/attendance.models';
import { AttendancePolicy, HolidayLookup, isWorkday } from './attendance-calc.util';
import { addDays, eachDay, rangesOverlap } from './attendance-date.util';

/**
 * Pure leave rules — no Angular, no I/O. Shared by the request form (instant
 * feedback), the mock repository (server-side validation) and the admin
 * inbox (balance next to each request).
 */

/** Requests that hold days: approved ones are spent, pending ones are reserved. */
export function isActiveLeave(status: LeaveStatus): boolean {
  return status === 'pending' || status === 'approved';
}

/** Working days a request charges (weekends and holidays are free). */
export function countLeaveDays(
  from: string,
  to: string,
  halfDay: boolean,
  policy: Pick<AttendancePolicy, 'weekendDays'>,
  holidays: HolidayLookup,
): number {
  if (!from || !to || to < from) return 0;
  const working = eachDay(from, to).filter((d) => isWorkday(d, policy, holidays)).length;
  if (halfDay) return working > 0 ? 0.5 : 0;
  return working;
}

/** Per-type balance for one employee in one calendar year. */
export function computeBalances(
  requests: ReadonlyArray<LeaveRequest>,
  year: number,
  entitlements: Readonly<Record<LeaveType, number>>,
): LeaveBalance[] {
  const prefix = String(year);
  return LEAVE_TYPES.map((type) => {
    const mine = requests.filter((r) => r.type === type && r.from.startsWith(prefix));
    const used = mine.filter((r) => r.status === 'approved').reduce((s, r) => s + r.days, 0);
    const pending = mine.filter((r) => r.status === 'pending').reduce((s, r) => s + r.days, 0);
    const entitled = entitlements[type];
    return { type, entitled, used, pending, available: Math.max(0, entitled - used - pending) };
  });
}

export interface LeaveValidationContext {
  today: string;
  policy: Pick<AttendancePolicy, 'weekendDays'> & { sickBackdateDays: number };
  holidays: HolidayLookup;
  /** The employee's existing requests. */
  existing: ReadonlyArray<LeaveRequest>;
  balances: ReadonlyArray<LeaveBalance>;
}

/** Earliest allowed start for a leave type. */
export function earliestStart(type: LeaveType, today: string, sickBackdateDays: number): string {
  return type === 'sick' ? addDays(today, -sickBackdateDays) : today;
}

/** First rule a request breaks, or `null` when it can be submitted. */
export function validateLeaveRequest(
  input: LeaveRequestInput,
  ctx: LeaveValidationContext,
): LeaveValidationError | null {
  if (!input.from || !input.to) return null; // "required" is the form's job
  if (input.to < input.from) return 'endBeforeStart';
  if (input.halfDay && input.from !== input.to) return 'halfDayRange';
  if (input.from < earliestStart(input.type, ctx.today, ctx.policy.sickBackdateDays)) return 'startInPast';

  const days = countLeaveDays(input.from, input.to, input.halfDay, ctx.policy, ctx.holidays);
  if (days === 0) return 'noWorkingDays';

  const clash = ctx.existing.some(
    (r) => isActiveLeave(r.status) && rangesOverlap(input.from, input.to, r.from, r.to),
  );
  if (clash) return 'overlap';

  const balance = ctx.balances.find((b) => b.type === input.type);
  if (balance && days > balance.available) return 'insufficientBalance';
  return null;
}

/** Newest first, pending always on top. */
export function compareLeaves(a: LeaveRequest, b: LeaveRequest): number {
  if ((a.status === 'pending') !== (b.status === 'pending')) return a.status === 'pending' ? -1 : 1;
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
}

export const LEAVE_TYPE_ICON: Record<LeaveType, string> = {
  annual: 'fa-solid fa-umbrella-beach',
  sick: 'fa-solid fa-briefcase-medical',
  casual: 'fa-solid fa-mug-hot',
};

export const LEAVE_STATUS_ICON: Record<LeaveStatus, string> = {
  pending: 'fa-solid fa-hourglass-half',
  approved: 'fa-solid fa-circle-check',
  rejected: 'fa-solid fa-circle-xmark',
  cancelled: 'fa-solid fa-ban',
};
