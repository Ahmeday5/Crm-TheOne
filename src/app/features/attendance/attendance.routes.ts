import { Routes } from '@angular/router';

/**
 * Attendance & leave — open to every employee. The team board, monthly
 * matrix and approvals inbox are gated to Admin inside the page (and by the
 * repository / backend).
 *
 * Deep links: `/attendance?tab=mine|leave|team|approvals`.
 */
export const ATTENDANCE_ROUTES: Routes = [
  {
    path: 'attendance',
    title: 'الحضور والإجازات',
    loadComponent: () =>
      import('./pages/attendance/attendance.component').then((m) => m.AttendanceComponent),
  },
];
