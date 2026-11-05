import { ENVIRONMENT_INITIALIZER, EnvironmentProviders, inject, makeEnvironmentProviders } from '@angular/core';
import { AttendanceTodayStore } from './state/attendance-today.store';
import { LeaveInboxStore } from './state/leave-inbox.store';

/**
 * Boots attendance with the app: today's state powers the header time clock
 * on every page, and the admin's pending-leave badge and notification
 * reactions are live before the attendance page is ever opened. Both stores
 * follow the session by themselves.
 */
export function provideAttendance(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        inject(AttendanceTodayStore).start();
        inject(LeaveInboxStore).start();
      },
    },
  ]);
}
