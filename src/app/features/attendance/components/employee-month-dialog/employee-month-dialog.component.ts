import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { EmployeeMonthlyAttendance, YearMonth } from '../../models/attendance.models';
import { AttendanceTodayStore } from '../../state/attendance-today.store';
import { buildCalendarDays } from '../../utils/attendance-calendar.util';
import { MonthCalendarComponent } from '../month-calendar/month-calendar.component';
import { MonthRecordsTableComponent } from '../month-records-table/month-records-table.component';
import { MonthSummaryComponent } from '../month-summary/month-summary.component';

/** Admin: one employee's month — the same summary, calendar and table as "my attendance". */
@Component({
  selector: 'app-employee-month-dialog',
  standalone: true,
  imports: [ModalComponent, TranslatePipe, MonthSummaryComponent, MonthCalendarComponent, MonthRecordsTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="true" [title]="employee().fullName" icon="fa-regular fa-calendar-days" iconTone="info"
               size="xl" (closed)="closed.emit()">
      <div class="emd">
        <app-month-summary [month]="employee()" />
        <app-month-calendar [period]="period()" [days]="days()" [navigable]="false"
                            [selected]="selected()" (select)="selected.set($event)" />
        <app-month-records-table [days]="days()" [selected]="selected()" (select)="selected.set($event)" />
      </div>
      <div modal-footer class="btn-row justify-content-end w-100">
        <button type="button" class="btn btn-primary" (click)="closed.emit()">{{ 'attendance.actions.close' | translate }}</button>
      </div>
    </app-modal>
  `,
  styles: [`.emd { display: grid; gap: 1rem; }`],
})
export class EmployeeMonthDialogComponent {
  readonly employee = input.required<EmployeeMonthlyAttendance>();
  readonly period = input.required<YearMonth>();
  readonly closed = output<void>();

  private readonly todayStore = inject(AttendanceTodayStore);
  readonly selected = signal<string | null>(null);

  readonly days = computed(() =>
    buildCalendarDays(this.period(), this.employee().records, this.employee().leaves, this.todayStore.day()),
  );
}
