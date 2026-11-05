import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LanguageService } from '../../../../core/services/language.service';
import { localeFor } from '../../../../core/utils/cairo-time.util';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { MonthlyAttendance } from '../../models/attendance.models';
import { formatHours } from '../../utils/attendance-calendar.util';

/** The four month KPIs, exactly as the server computed them. */
@Component({
  selector: 'app-month-summary',
  standalone: true,
  imports: [StatCardComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let m = month();
    <div class="row g-3">
      <div class="col-6 col-xl-3">
        <app-stat-card [label]="'attendance.summary.presentDays' | translate" [value]="ready() ? m.presentDays : '—'"
                       icon="fa-solid fa-user-check" tone="success" />
      </div>
      <div class="col-6 col-xl-3">
        <app-stat-card [label]="'attendance.summary.totalHours' | translate" [value]="ready() ? hours() : '—'"
                       icon="fa-solid fa-hourglass-half" tone="info" />
      </div>
      <div class="col-6 col-xl-3">
        <app-stat-card [label]="'attendance.summary.leaveDays' | translate" [value]="ready() ? m.leaveDays : '—'"
                       icon="fa-solid fa-umbrella-beach" tone="purple" />
      </div>
      <div class="col-6 col-xl-3">
        <app-stat-card [label]="'attendance.summary.missingCheckOuts' | translate" [value]="ready() ? m.missingCheckOuts : '—'"
                       icon="fa-solid fa-triangle-exclamation" tone="warning" />
      </div>
    </div>
  `,
})
export class MonthSummaryComponent {
  readonly month = input.required<MonthlyAttendance>();
  readonly ready = input(true);

  private readonly language = inject(LanguageService);
  readonly hours = computed(() => formatHours(this.month().totalHours, localeFor(this.language.lang())));
}
