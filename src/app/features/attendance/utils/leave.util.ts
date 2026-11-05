import { inclusiveDays } from '../../../core/utils/cairo-time.util';
import { LeaveRequest, LeaveStatus, LeaveType } from '../models/attendance.models';

/** Pure leave helpers — no Angular, no I/O. */

export const LEAVE_TYPE_ICON: Record<LeaveType, string> = {
  Annual: 'fa-solid fa-umbrella-beach',
  Sick: 'fa-solid fa-briefcase-medical',
  Casual: 'fa-solid fa-mug-hot',
  Unpaid: 'fa-solid fa-money-bill-transfer',
  Other: 'fa-solid fa-ellipsis',
};

export const LEAVE_STATUS_ICON: Record<LeaveStatus, string> = {
  Pending: 'fa-solid fa-hourglass-half',
  Approved: 'fa-solid fa-circle-check',
  Rejected: 'fa-solid fa-circle-xmark',
  Cancelled: 'fa-solid fa-ban',
};

/**
 * Days a request would cover, both ends inclusive — the preview shown before
 * submitting. The server's `days` is what is stored and displayed afterwards.
 */
export function requestedDays(startDate: string, endDate: string): number {
  return startDate && endDate ? inclusiveDays(startDate, endDate) : 0;
}

/** Pending first, then the newest submission. */
export function compareLeaves(a: LeaveRequest, b: LeaveRequest): number {
  const ap = a.status === 'Pending';
  const bp = b.status === 'Pending';
  if (ap !== bp) return ap ? -1 : 1;
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.id - a.id;
}

/** CSS modifier (`type-annual`, `status-pending`) for the shared chips. */
export function leaveTypeClass(type: LeaveType): string {
  return `type-${type.toLowerCase()}`;
}

export function leaveStatusClass(status: LeaveStatus): string {
  return `status-${status.toLowerCase()}`;
}
