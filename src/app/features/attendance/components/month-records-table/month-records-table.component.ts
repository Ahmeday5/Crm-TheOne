import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { LanguageService } from '../../../../core/services/language.service';
import { formatShortDay, formatWeekday, localeFor } from '../../../../core/utils/cairo-time.util';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ClampTextDirective } from '../../../../shared/directives/clamp-text.directive';
import { ResponsiveTableDirective } from '../../../../shared/directives/responsive-table.directive';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CalendarDay, DayStatus } from '../../models/attendance.models';
import { WorkHoursPipe } from '../../pipes/work-hours.pipe';

const STATUS_ICON: Record<DayStatus, string> = {
  present: 'fa-solid fa-circle-check',
  working: 'fa-solid fa-circle-play',
  missingOut: 'fa-solid fa-triangle-exclamation',
  leave: 'fa-solid fa-umbrella-beach',
  none: 'fa-regular fa-circle',
};

/**
 * The month as a table — the same server data as the calendar (days with a
 * record or an approved leave), newest first. Cards on phones.
 */
@Component({
  selector: 'app-month-records-table',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe, WorkHoursPipe, EmptyStateComponent, ResponsiveTableDirective, ClampTextDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './month-records-table.component.html',
  styleUrl: './month-records-table.component.scss',
})
export class MonthRecordsTableComponent {
  readonly days = input.required<CalendarDay[]>();
  readonly ready = input(true);
  readonly selected = input<string | null>(null);
  readonly select = output<string>();

  private readonly language = inject(LanguageService);
  private readonly locale = computed(() => localeFor(this.language.lang()));
  readonly icons = STATUS_ICON;

  readonly rows = computed(() =>
    this.days()
      .filter((d) => d.status !== 'none')
      .reverse()
      .map((day) => ({
        day,
        weekday: formatWeekday(day.date, this.locale(), 'long'),
        label: formatShortDay(day.date, this.locale()),
      })),
  );

  constructor() {
    // A day picked on the calendar scrolls its row into view.
    effect(() => {
      const date = this.selected();
      if (!date) return;
      queueMicrotask(() =>
        document.querySelector(`.mrt-row[data-day="${date}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
      );
    });
  }
}
