/**
 * Public surface of the attendance feature — the shell imports from here,
 * never from the feature's internals.
 */
export { ATTENDANCE_ROUTES } from './attendance.routes';
export { provideAttendance } from './attendance.providers';
export { AttendanceClockChipComponent } from './components/attendance-clock-chip/attendance-clock-chip.component';
