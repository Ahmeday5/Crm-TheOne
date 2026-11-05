import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, map } from 'rxjs';
import { withInlineHandling, withSkipLoader } from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import { PublicHoliday } from '../config/attendance.config';
import {
  AttendanceEmployee,
  AttendanceRecord,
  LeaveBalance,
  LeaveDecision,
  LeaveRequest,
  LeaveRequestInput,
} from '../models/attendance.models';
import { AttendanceRepository } from './attendance.repository';

/**
 * Endpoints of `docs/api/attendance.md`. Move them into
 * `core/constants/api-endpoints.const.ts` (as `API_ENDPOINTS.attendance`)
 * when the adapter is switched on.
 */
export const ATTENDANCE_ENDPOINTS = {
  holidays: 'Attendance/holidays',
  myRecords: 'Attendance/me',
  checkIn: 'Attendance/check-in',
  checkOut: 'Attendance/check-out',
  myLeaves: 'Attendance/leaves/me',
  myBalances: 'Attendance/leaves/me/balances',
  requestLeave: 'Attendance/leaves',
  cancelLeave: (id: string) => `Attendance/leaves/${encodeURIComponent(id)}/cancel`,
  employees: 'Attendance/employees',
  teamRecords: 'Attendance/team',
  teamLeaves: 'Attendance/leaves',
  decideLeave: (id: string) => `Attendance/leaves/${encodeURIComponent(id)}/decision`,
} as const;

/**
 * Real backend adapter — implements `docs/api/attendance.md`.
 *
 * The server owns the clock (check-in/out are stamped server-side), the
 * leave balances and all validation. Reads skip the global loader because
 * the page refreshes quietly in the background.
 */
@Injectable({ providedIn: 'root' })
export class HttpAttendanceRepository extends AttendanceRepository {
  private readonly api = inject(ApiService);

  readonly externalChanges$: Observable<void> = EMPTY;

  holidays(): Observable<PublicHoliday[]> {
    return this.list<PublicHoliday>(ATTENDANCE_ENDPOINTS.holidays);
  }

  myRecords(from: string, to: string): Observable<AttendanceRecord[]> {
    return this.list<AttendanceRecord>(ATTENDANCE_ENDPOINTS.myRecords, { from, to });
  }

  checkIn(): Observable<AttendanceRecord> {
    return this.api.post<AttendanceRecord>(ATTENDANCE_ENDPOINTS.checkIn, {}, { context: withInlineHandling() });
  }

  checkOut(): Observable<AttendanceRecord> {
    return this.api.post<AttendanceRecord>(ATTENDANCE_ENDPOINTS.checkOut, {}, { context: withInlineHandling() });
  }

  myLeaves(): Observable<LeaveRequest[]> {
    return this.list<LeaveRequest>(ATTENDANCE_ENDPOINTS.myLeaves);
  }

  myBalances(year: number): Observable<LeaveBalance[]> {
    return this.list<LeaveBalance>(ATTENDANCE_ENDPOINTS.myBalances, { year: String(year) });
  }

  requestLeave(input: LeaveRequestInput): Observable<LeaveRequest> {
    return this.api.post<LeaveRequest>(ATTENDANCE_ENDPOINTS.requestLeave, input, {
      context: withInlineHandling(),
    });
  }

  cancelLeave(id: string): Observable<LeaveRequest> {
    return this.api.post<LeaveRequest>(ATTENDANCE_ENDPOINTS.cancelLeave(id), {}, {
      context: withInlineHandling(),
    });
  }

  employees(): Observable<AttendanceEmployee[]> {
    return this.list<AttendanceEmployee>(ATTENDANCE_ENDPOINTS.employees);
  }

  teamRecords(from: string, to: string): Observable<AttendanceRecord[]> {
    return this.list<AttendanceRecord>(ATTENDANCE_ENDPOINTS.teamRecords, { from, to });
  }

  teamLeaves(): Observable<LeaveRequest[]> {
    return this.list<LeaveRequest>(ATTENDANCE_ENDPOINTS.teamLeaves);
  }

  decideLeave(id: string, decision: LeaveDecision): Observable<LeaveRequest> {
    return this.api.post<LeaveRequest>(ATTENDANCE_ENDPOINTS.decideLeave(id), decision, {
      context: withInlineHandling(),
    });
  }

  private list<T>(endpoint: string, query?: Record<string, string>): Observable<T[]> {
    return this.api
      .get<T[]>(endpoint, {
        params: query,
        context: withSkipLoader(withInlineHandling()),
      })
      .pipe(map((rows) => rows ?? []));
  }
}
