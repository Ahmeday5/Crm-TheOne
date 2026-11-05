import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { LeaveBalance, LeaveType } from '../../models/attendance.models';
import { LEAVE_TYPE_ICON } from '../../utils/leave.util';

const TONE: Record<LeaveType, 'primary' | 'danger' | 'warning'> = {
  annual: 'primary',
  sick: 'danger',
  casual: 'warning',
};

/** One card per leave type: available days and a used / pending / free bar. */
@Component({
  selector: 'app-leave-balances',
  standalone: true,
  imports: [TranslatePipe, TipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './leave-balances.component.html',
  styleUrl: './leave-balances.component.scss',
})
export class LeaveBalancesComponent {
  readonly balances = input.required<LeaveBalance[]>();
  readonly loading = input(false);

  readonly cards = computed(() =>
    this.balances().map((b) => {
      const total = Math.max(b.entitled, 0.0001);
      return {
        ...b,
        icon: LEAVE_TYPE_ICON[b.type],
        tone: TONE[b.type],
        usedPct: Math.min(100, (b.used / total) * 100),
        pendingPct: Math.min(100, (b.pending / total) * 100),
      };
    }),
  );
}
