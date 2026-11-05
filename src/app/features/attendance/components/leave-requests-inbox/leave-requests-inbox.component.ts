import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { ClampTextDirective } from '../../../../shared/directives/clamp-text.directive';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { LeaveRequest } from '../../models/attendance.models';
import { LeaveStatusFilter } from '../../state/team-attendance.store';
import { LEAVE_STATUS_ICON, LEAVE_TYPE_ICON, leaveStatusClass, leaveTypeClass } from '../../utils/leave.util';

export type ReviewDecision = 'approve' | 'reject';

interface StatusTab {
  key: LeaveStatusFilter;
  label: string;
  icon: string;
}

const TABS: ReadonlyArray<StatusTab> = [
  { key: 'Pending', label: 'attendance.leaveStatus.Pending', icon: 'fa-solid fa-hourglass-half' },
  { key: 'Approved', label: 'attendance.leaveStatus.Approved', icon: 'fa-solid fa-circle-check' },
  { key: 'Rejected', label: 'attendance.leaveStatus.Rejected', icon: 'fa-solid fa-circle-xmark' },
  { key: null, label: 'attendance.leaveStatus.all', icon: 'fa-solid fa-layer-group' },
];

/**
 * Admin leave inbox (`GET /Attendance/Leaves`): status tabs (pending first),
 * a year filter, and approve / reject on pending requests. Presentational —
 * the page opens the review dialog.
 */
@Component({
  selector: 'app-leave-requests-inbox',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe, ClampTextDirective, UserAvatarComponent, EmptyStateComponent, LoadErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './leave-requests-inbox.component.html',
  styleUrl: './leave-requests-inbox.component.scss',
})
export class LeaveRequestsInboxComponent {
  readonly requests = input.required<LeaveRequest[]>();
  readonly status = input.required<LeaveStatusFilter>();
  readonly pendingCount = input(0);
  readonly year = input.required<number>();
  readonly years = input.required<ReadonlyArray<number>>();
  readonly ready = input(true);
  readonly loading = input(false);
  readonly error = input<string | null>(null);

  readonly statusChange = output<LeaveStatusFilter>();
  readonly yearChange = output<number>();
  readonly review = output<{ request: LeaveRequest; decision: ReviewDecision }>();
  readonly retry = output<void>();

  readonly tabs = TABS;
  readonly typeIcon = LEAVE_TYPE_ICON;
  readonly statusIcon = LEAVE_STATUS_ICON;
  readonly typeClass = leaveTypeClass;
  readonly statusClass = leaveStatusClass;
}
