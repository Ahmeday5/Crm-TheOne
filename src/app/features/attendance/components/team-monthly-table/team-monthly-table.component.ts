import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { LanguageService } from '../../../../core/services/language.service';
import { formatMonthLabel, localeFor } from '../../../../core/utils/cairo-time.util';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { ResponsiveTableDirective } from '../../../../shared/directives/responsive-table.directive';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { EmployeeMonthlyAttendance, YearMonth } from '../../models/attendance.models';
import { formatHours, ymKey } from '../../utils/attendance-calendar.util';

/**
 * Admin: everyone's month (`GET /Attendance/Monthly`) — present days, hours,
 * leave days and missing check-outs per employee, with a month navigator and
 * an employee filter. A row opens that employee's calendar.
 */
@Component({
  selector: 'app-team-monthly-table',
  standalone: true,
  imports: [TranslatePipe, TipDirective, UserAvatarComponent, EmptyStateComponent, LoadErrorComponent, ResponsiveTableDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './team-monthly-table.component.html',
  styleUrl: './team-monthly-table.component.scss',
})
export class TeamMonthlyTableComponent {
  readonly rows = input.required<EmployeeMonthlyAttendance[]>();
  readonly period = input.required<YearMonth>();
  readonly employees = input.required<ReadonlyArray<{ userId: string; fullName: string }>>();
  readonly employeeId = input<string | null>(null);
  readonly ready = input(true);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly canPrev = input(true);
  readonly canNext = input(true);

  readonly prev = output<void>();
  readonly next = output<void>();
  readonly employeeChange = output<string | null>();
  readonly open = output<EmployeeMonthlyAttendance>();
  readonly retry = output<void>();

  private readonly language = inject(LanguageService);
  private readonly locale = computed(() => localeFor(this.language.lang()));

  readonly monthLabel = computed(() => formatMonthLabel(ymKey(this.period()), this.locale()));

  readonly totals = computed(() =>
    this.rows().reduce(
      (t, r) => ({
        presentDays: t.presentDays + r.presentDays,
        totalHours: t.totalHours + r.totalHours,
        leaveDays: t.leaveDays + r.leaveDays,
        missingCheckOuts: t.missingCheckOuts + r.missingCheckOuts,
      }),
      { presentDays: 0, totalHours: 0, leaveDays: 0, missingCheckOuts: 0 },
    ),
  );

  hours(value: number): string {
    return formatHours(value, this.locale());
  }

  onEmployee(value: string): void {
    this.employeeChange.emit(value || null);
  }
}
