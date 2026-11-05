import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { LanguageService } from '../../../../core/services/language.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ResponsiveTableDirective } from '../../../../shared/directives/responsive-table.directive';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AttendanceDay, MonthSummary } from '../../models/attendance.models';
import { WorkDurationPipe } from '../../pipes/work-duration.pipe';
import { formatShortDay, formatWeekday, localeFor } from '../../utils/attendance-date.util';
import { DAY_STATUS_ICON } from '../../utils/attendance-view.util';

/** Day-by-day log of the month (latest first) with totals. */
@Component({
  selector: 'app-day-log-table',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe, WorkDurationPipe, ResponsiveTableDirective, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './day-log-table.component.html',
  styleUrl: './day-log-table.component.scss',
})
export class DayLogTableComponent {
  readonly days = input.required<AttendanceDay[]>();
  readonly summary = input.required<MonthSummary>();
  readonly ready = input(true);
  readonly selected = input<string | null>(null);
  readonly select = output<string>();

  private readonly language = inject(LanguageService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly icons = DAY_STATUS_ICON;
  /** Hide weekends / holidays without a punch. */
  readonly workdaysOnly = signal(true);

  readonly rows = computed(() => {
    const locale = localeFor(this.language.lang());
    return this.days()
      .filter((d) => d.status !== 'upcoming')
      .filter((d) => !this.workdaysOnly() || !((d.status === 'weekend' || d.status === 'holiday') && !d.checkIn))
      .map((d) => ({
        day: d,
        weekday: formatWeekday(d.date, locale, 'long'),
        label: formatShortDay(d.date, locale),
      }))
      .reverse();
  });

  constructor() {
    // Clicking a calendar day brings its row into view.
    effect(() => {
      const date = this.selected();
      if (!date) return;
      queueMicrotask(() =>
        this.host.nativeElement
          .querySelector(`[data-day="${date}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
      );
    });
  }

  holidayName(d: AttendanceDay): string {
    return d.holidayName?.[this.language.lang()] ?? '';
  }
}
