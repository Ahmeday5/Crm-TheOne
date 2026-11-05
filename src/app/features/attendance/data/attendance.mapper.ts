import { serverDay, serverInstantToIso } from '../../../core/utils/cairo-time.util';
import {
  AttendanceRecord,
  AttendanceRecordDto,
  AttendanceToday,
  AttendanceTodayDto,
  EmployeeMonthlyAttendance,
  LEAVE_STATUSES,
  LEAVE_TYPES,
  LeaveRequest,
  LeaveRequestDto,
  LeaveStatus,
  LeaveType,
  MonthlyAttendance,
  MonthlyAttendanceDto,
  TodayAttendanceEntry,
  TodayAttendanceEntryDto,
} from '../models/attendance.models';

/**
 * DTO → domain, once, at the HTTP boundary: Cairo wall-clock timestamps
 * become UTC instants, dates become `YYYY-MM-DD`, enums are matched
 * case-insensitively (the API may send names or numbers), and numbers are
 * kept exactly as the server computed them.
 */

export function toRecord(dto: AttendanceRecordDto): AttendanceRecord {
  return {
    workDate: serverDay(dto.workDate) ?? '',
    checkInAt: serverInstantToIso(dto.checkInAt),
    checkOutAt: serverInstantToIso(dto.checkOutAt),
    workedHours: num(dto.workedHours),
    checkInNote: text(dto.checkInNote),
    checkOutNote: text(dto.checkOutNote),
  };
}

export function toToday(dto: AttendanceTodayDto): AttendanceToday {
  return {
    date: serverDay(dto?.date) ?? '',
    checkedIn: !!dto?.checkedIn,
    checkedOut: !!dto?.checkedOut,
    onLeave: !!dto?.onLeave,
    record: dto?.record ? toRecord(dto.record) : null,
  };
}

export function toLeave(dto: LeaveRequestDto): LeaveRequest {
  const startDate = serverDay(dto.startDate) ?? '';
  return {
    id: Number(dto.id),
    userId: dto.userId ? String(dto.userId) : null,
    fullName: text(dto.fullName),
    type: parseEnum(dto.type, LEAVE_TYPES, 'Other') as LeaveType,
    startDate,
    endDate: serverDay(dto.endDate) ?? startDate,
    days: num(dto.days) ?? 0,
    reason: dto.reason ?? '',
    status: parseEnum(dto.status, LEAVE_STATUSES, 'Pending') as LeaveStatus,
    reviewedByName: text(dto.reviewedByName),
    reviewedAt: serverInstantToIso(dto.reviewedAt),
    reviewNote: text(dto.reviewNote),
    createdAt: serverInstantToIso(dto.createdAt) ?? dto.createdAt,
  };
}

export function toMonthly(dto: MonthlyAttendanceDto | null): MonthlyAttendance {
  return {
    presentDays: num(dto?.presentDays) ?? 0,
    totalHours: num(dto?.totalHours) ?? 0,
    leaveDays: num(dto?.leaveDays) ?? 0,
    missingCheckOuts: num(dto?.missingCheckOuts) ?? 0,
    records: (dto?.records ?? []).map(toRecord),
    leaves: (dto?.leaves ?? []).map(toLeave),
  };
}

export function toEmployeeMonthly(dto: MonthlyAttendanceDto): EmployeeMonthlyAttendance {
  return {
    ...toMonthly(dto),
    userId: String(dto.userId ?? ''),
    fullName: dto.fullName ?? '',
  };
}

export function toTodayEntry(dto: TodayAttendanceEntryDto): TodayAttendanceEntry {
  return {
    userId: String(dto.userId ?? ''),
    fullName: dto.fullName ?? '',
    checkInAt: serverInstantToIso(dto.checkInAt),
    checkOutAt: serverInstantToIso(dto.checkOutAt),
    workedHours: num(dto.workedHours),
  };
}

/** Name match (any case) or the enum's 0-based index when sent as a number. */
function parseEnum<T extends string>(raw: unknown, values: ReadonlyArray<T>, fallback: T): T {
  if (typeof raw === 'number' || /^\d+$/.test(String(raw ?? ''))) {
    return values[Number(raw)] ?? fallback;
  }
  const key = String(raw ?? '').trim().toLowerCase();
  return values.find((v) => v.toLowerCase() === key) ?? fallback;
}

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function text(v: string | null | undefined): string | null {
  return v?.trim() || null;
}
