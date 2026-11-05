import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ClampTextDirective } from '../../../../shared/directives/clamp-text.directive';
import { ResponsiveTableDirective } from '../../../../shared/directives/responsive-table.directive';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { LeaveRequest, LeaveStatus } from '../../models/attendance.models';
import { LEAVE_STATUS_ICON, LEAVE_TYPE_ICON } from '../../utils/leave.util';

type StatusFilter = 'all' | LeaveStatus;

/** The signed-in user's leave requests with status chips; pending ones can be cancelled. */
@Component({
  selector: 'app-my-leave-requests',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe, ResponsiveTableDirective, ClampTextDirective, TipDirective, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './my-leave-requests.component.html',
  styleUrl: './my-leave-requests.component.scss',
})
export class MyLeaveRequestsComponent {
  readonly requests = input.required<LeaveRequest[]>();
  readonly loaded = input(true);
  readonly busyId = input<string | null>(null);
  readonly cancelRequest = output<LeaveRequest>();
  readonly create = output<void>();

  readonly filters: StatusFilter[] = ['all', 'pending', 'approved', 'rejected', 'cancelled'];
  readonly filter = signal<StatusFilter>('all');
  readonly typeIcon = LEAVE_TYPE_ICON;
  readonly statusIcon = LEAVE_STATUS_ICON;

  readonly counts = computed(() => {
    const out: Record<StatusFilter, number> = { all: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    for (const r of this.requests()) {
      out.all++;
      out[r.status]++;
    }
    return out;
  });

  readonly rows = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.requests() : this.requests().filter((r) => r.status === f);
  });
}
