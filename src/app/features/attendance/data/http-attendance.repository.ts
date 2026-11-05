import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { withInlineHandling, withSkipLoader } from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import {
  AttendanceRecord,
  AttendanceRecordDto,
  AttendanceToday,
  AttendanceTodayDto,
  ClockNoteInput,
  EmployeeMonthlyAttendance,
  LeaveListQuery,
  LeaveRequest,
  LeaveRequestDto,
  LeaveRequestInput,
  LeaveReviewInput,
  MonthlyAttendance,
  MonthlyAttendanceDto,
  MonthlyQuery,
  TodayAttendanceEntry,
  TodayAttendanceEntryDto,
  YearMonth,
} from '../models/attendance.models';
import {
  toEmployeeMonthly,
  toLeave,
  toMonthly,
  toRecord,
  toToday,
  toTodayEntry,
} from './attendance.mapper';

const EP = API_ENDPOINTS.attendance;

/**
 * `Attendance/*` over HTTP.
 *
 * Reads skip the global loader (widgets refresh quietly in the background).
 * Everything uses inline handling: callers show the server's `message`
 * (e.g. "already checked in today", "overlapping leave") in a toast or
 * next to the form, exactly once.
 */
@Injectable({ providedIn: 'root' })
export class HttpAttendanceRepository {
  private readonly api = inject(ApiService);

  today(): Observable<AttendanceToday> {
    return this.get<AttendanceTodayDto>(EP.today).pipe(map(toToday));
  }

  checkIn(input: ClockNoteInput): Observable<AttendanceRecord | null> {
    return this.api
      .post<AttendanceRecordDto | null>(EP.checkIn, { note: input.note?.trim() || null }, { context: withInlineHandling() })
      .pipe(map(recordOrNull));
  }

  checkOut(input: ClockNoteInput): Observable<AttendanceRecord | null> {
    return this.api
      .post<AttendanceRecordDto | null>(EP.checkOut, { note: input.note?.trim() || null }, { context: withInlineHandling() })
      .pipe(map(recordOrNull));
  }

  myMonth({ year, month }: YearMonth): Observable<MonthlyAttendance> {
    return this.get<MonthlyAttendanceDto>(EP.my, { year, month }).pipe(map(toMonthly));
  }

  myLeaves(year: number): Observable<LeaveRequest[]> {
    return this.get<LeaveRequestDto[]>(EP.myLeaves, { year }).pipe(map((rows) => (rows ?? []).map(toLeave)));
  }

  requestLeave(input: LeaveRequestInput): Observable<LeaveRequest | null> {
    return this.api
      .post<LeaveRequestDto | null>(EP.leaves, input, { context: withInlineHandling() })
      .pipe(map((dto) => (dto && typeof dto === 'object' && 'id' in dto ? toLeave(dto) : null)));
  }

  cancelLeave(id: number): Observable<void> {
    return this.api
      .delete<unknown>(EP.leave(id), { context: withInlineHandling() })
      .pipe(map(() => undefined));
  }

  todayAll(): Observable<TodayAttendanceEntry[]> {
    return this.get<TodayAttendanceEntryDto[]>(EP.todayAll).pipe(map((rows) => (rows ?? []).map(toTodayEntry)));
  }

  monthly({ year, month, userId }: MonthlyQuery): Observable<EmployeeMonthlyAttendance[]> {
    return this.get<MonthlyAttendanceDto[]>(EP.monthly, { year, month, userId }).pipe(
      map((rows) => (rows ?? []).map(toEmployeeMonthly)),
    );
  }

  leaves(query: LeaveListQuery): Observable<LeaveRequest[]> {
    return this.get<LeaveRequestDto[]>(EP.leaves, {
      status: query.status,
      userId: query.userId,
      year: query.year,
    }).pipe(map((rows) => (rows ?? []).map(toLeave)));
  }

  reviewLeave(id: number, input: LeaveReviewInput): Observable<LeaveRequest | null> {
    return this.api
      .put<LeaveRequestDto | null>(
        EP.reviewLeave(id),
        { approve: input.approve, note: input.note?.trim() || null },
        { context: withInlineHandling() },
      )
      .pipe(map((dto) => (dto && typeof dto === 'object' && 'id' in dto ? toLeave(dto) : null)));
  }

  private get<T>(endpoint: string, params?: Record<string, unknown>): Observable<T> {
    return this.api.get<T>(endpoint, { params, context: withSkipLoader(withInlineHandling()) });
  }
}

function recordOrNull(dto: AttendanceRecordDto | null): AttendanceRecord | null {
  return dto && typeof dto === 'object' && 'workDate' in dto ? toRecord(dto) : null;
}
