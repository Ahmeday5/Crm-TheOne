import { InjectionToken, inject } from '@angular/core';
import { AttendanceRepository } from './attendance.repository';
import { MockAttendanceRepository } from './mock-attendance.repository';
// import { HttpAttendanceRepository } from './http-attendance.repository';

/**
 * The single switch between persistence adapters.
 *
 * Today the backend has no `/Attendance` endpoints, so the mock adapter is
 * active. When the API in `docs/api/attendance.md` is deployed, replace the
 * factory body with `inject(HttpAttendanceRepository)` — nothing else in the
 * app changes.
 */
/** Flip together with the factory below — drives the "sample data" notice. */
export const USING_MOCK_ATTENDANCE = true;

export const ATTENDANCE_REPOSITORY = new InjectionToken<AttendanceRepository>(
  'ATTENDANCE_REPOSITORY',
  {
    providedIn: 'root',
    factory: () => inject(MockAttendanceRepository),
  },
);
