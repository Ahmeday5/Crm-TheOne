import { Routes } from '@angular/router';

const loadPage = () =>
  import('./pages/attendance/attendance.component').then((m) => m.AttendanceComponent);

/**
 * Attendance & leave — open to every employee. Tabs are path segments:
 *
 *   /attendance            my attendance (time clock + month)
 *   /attendance/leaves     my leave requests
 *   /attendance/team       Admin: today + monthly per employee
 *   /attendance/requests   Admin: leave requests inbox
 *
 * Admin tabs fall back to "my attendance" for other roles (and the backend
 * answers 403 anyway). Notifications deep-link to `leaves` / `requests`.
 */
export const ATTENDANCE_ROUTES: Routes = [
  { path: 'attendance', title: 'الحضور والإجازات', loadComponent: loadPage },
  { path: 'attendance/:tab', title: 'الحضور والإجازات', loadComponent: loadPage },
];
