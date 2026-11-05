import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import {
  addDays,
  firstDayOfMonth,
  formatLongDay,
  formatMonthLabel,
  formatWeekday,
  localeFor,
  weekdayOf,
} from '../../../../core/utils/cairo-time.util';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CalendarDay, DAY_STATUS_LEGEND, DayStatus, YearMonth } from '../../models/attendance.models';
import { WEEK_STARTS_ON, formatHours, ymKey } from '../../utils/attendance-calendar.util';

const STATUS_ICON: Record<DayStatus, string> = {
  present: 'fa-solid fa-circle-check',
  working: 'fa-solid fa-circle-play',
  missingOut: 'fa-solid fa-triangle-exclamation',
  leave: 'fa-solid fa-umbrella-beach',
  none: '',
};

/**
 * Month grid of one employee's attendance (mine, or one employee for the
 * admin), colour-coded from server data only:
 * present (green, with hours) · leave (blue) · no check-out (orange).
 * Weeks start on Saturday.
 */
@Component({
  selector: 'app-month-calendar',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe, TipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './month-calendar.component.html',
  styleUrl: './month-calendar.component.scss',
})
export class MonthCalendarComponent {
  readonly period = input.required<YearMonth>();
  readonly days = input.required<CalendarDay[]>();
  readonly ready = input(true);
  readonly loading = input(false);
  /** Hide the month navigator (e.g. inside the admin's employee dialog). */
  readonly navigable = input(true);
  readonly canPrev = input(true);
  readonly canNext = input(true);
  readonly selected = input<string | null>(null);

  readonly prev = output<void>();
  readonly next = output<void>();
  readonly select = output<string>();

  private readonly language = inject(LanguageService);
  private readonly locale = computed(() => localeFor(this.language.lang()));

  readonly legend = DAY_STATUS_LEGEND;
  readonly icons = STATUS_ICON;

  private readonly month = computed(() => ymKey(this.period()));
  readonly monthLabel = computed(() => formatMonthLabel(this.month(), this.locale()));

  /** Empty cells before the 1st. */
  readonly leading = computed(() => (weekdayOf(firstDayOfMonth(this.month())) - WEEK_STARTS_ON + 7) % 7);
  readonly blanks = computed(() => Array.from({ length: this.leading() }, (_, i) => i));

  /** Weekday headers in display order (Saturday first). */
  readonly weekdays = computed(() => {
    const anchor = addDays(firstDayOfMonth(this.month()), -this.leading());
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(anchor, i);
      return { key: d, short: formatWeekday(d, this.locale(), 'short') };
    });
  });

  readonly counts = computed(() => {
    const out: Partial<Record<DayStatus, number>> = {};
    for (const d of this.days()) out[d.status] = (out[d.status] ?? 0) + 1;
    return out;
  });

  hours(day: CalendarDay): string {
    return formatHours(day.record?.workedHours, this.locale());
  }

  tip(day: CalendarDay): string {
    const dict = TRANSLATIONS[this.language.lang()];
    const t = (key: string, params?: Record<string, string | number>) => interpolate(resolveKey(dict, key), params);
    const date = formatLongDay(day.date, this.locale());
    switch (day.status) {
      case 'present':
        return `${date} — ${t('attendance.calendar.tipPresent', { h: this.hours(day) })}`;
      case 'working':
        return `${date} — ${t('attendance.status.working')}`;
      case 'missingOut':
        return `${date} — ${t('attendance.status.missingOut')}`;
      case 'leave':
        return `${date} — ${t('attendance.leaveTypes.' + day.leave!.type)}`;
      default:
        return date;
    }
  }
}
