import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { ClampTextDirective } from '../../../../shared/directives/clamp-text.directive';
import { ResponsiveTableDirective } from '../../../../shared/directives/responsive-table.directive';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { LeaveRequest, LeaveStatus, PendingApproval } from '../../models/attendance.models';
import { LEAVE_STATUS_ICON, LEAVE_TYPE_ICON } from '../../utils/leave.util';

type HistoryFilter = 'all' | Exclude<LeaveStatus, 'pending'>;

/** Admin inbox of pending leave requests, plus the decision history. */
@Component({
  selector: 'app-leave-approvals',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    CairoDatePipe,
    TipDirective,
    ClampTextDirective,
    ResponsiveTableDirective,
    UserAvatarComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './leave-approvals.component.html',
  styleUrl: './leave-approvals.component.scss',
})
export class LeaveApprovalsComponent {
  readonly pending = input.required<PendingApproval[]>();
  readonly history = input.required<LeaveRequest[]>();
  readonly loaded = input(true);
  readonly busyId = input<string | null>(null);

  readonly approve = output<LeaveRequest>();
  readonly reject = output<LeaveRequest>();

  readonly typeIcon = LEAVE_TYPE_ICON;
  readonly statusIcon = LEAVE_STATUS_ICON;
  readonly historyFilters: HistoryFilter[] = ['all', 'approved', 'rejected', 'cancelled'];

  readonly historyFilter = signal<HistoryFilter>('all');
  readonly search = signal('');

  readonly historyRows = computed(() => {
    const f = this.historyFilter();
    const q = this.search().trim().toLowerCase();
    return this.history()
      .filter((r) => f === 'all' || r.status === f)
      .filter((r) => !q || r.employeeName.toLowerCase().includes(q) || r.reason.toLowerCase().includes(q));
  });
}
