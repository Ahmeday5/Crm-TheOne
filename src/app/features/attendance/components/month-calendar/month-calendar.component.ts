import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ATTENDANCE_POLICY } from '../../config/attendance.config';
import { AttendanceDay, DAY_STATUSES_LEGEND, DayStatus } from '../../models/attendance.models';
import {
  addDays,
  firstDayOfMonth,
  formatLongDay,
  formatMonthLabel,
  formatWeekday,
  localeFor,
} from '../../utils/attendance-date.util';
import { DAY_STATUS_ICON, dayTooltip } from '../../utils/attendance-view.util';

/**
 * Month grid of the signed-in user's attendance, colour-coded by status.
 * Weeks start on Saturday; Friday is the weekly day off.
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
  readonly month = input.required<string>();
  readonly days = input.required<AttendanceDay[]>();
  readonly ready = input(true);
  readonly loading = input(false);
  readonly canPrev = input(true);
  readonly canNext = input(true);
  readonly selected = input<string | null>(null);

  readonly prev = output<void>();
  readonly next = output<void>();
  readonly select = output<string>();

  private readonly language = inject(LanguageService);
  private readonly locale = computed(() => localeFor(this.language.lang()));

  readonly legend = DAY_STATUSES_LEGEND;
  readonly icons = DAY_STATUS_ICON;

  readonly monthLabel = computed(() => formatMonthLabel(this.month(), this.locale()));

  /** Weekday headers in display order (Saturday first). */
  readonly weekdays = computed(() => {
    const first = firstDayOfMonth(this.month());
    const offset = this.leading();
    const anchor = addDays(first, -offset); // the Saturday on/before the 1st
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(anchor, i);
      return {
        key: d,
        short: formatWeekday(d, this.locale(), 'short'),
        isWeekend: ATTENDANCE_POLICY.weekendDays.includes(new Date(`${d}T00:00:00Z`).getUTCDay()),
      };
    });
  });

  /** Empty cells before the 1st. */
  readonly leading = computed(() => {
    const weekday = new Date(`${firstDayOfMonth(this.month())}T00:00:00Z`).getUTCDay();
    return (weekday - ATTENDANCE_POLICY.weekStartsOn + 7) % 7;
  });

  readonly blanks = computed(() => Array.from({ length: this.leading() }, (_, i) => i));

  readonly counts = computed(() => {
    const out: Partial<Record<DayStatus, number>> = {};
    for (const d of this.days()) out[d.status] = (out[d.status] ?? 0) + 1;
    return out;
  });

  tip(day: AttendanceDay): string {
    const lang = this.language.lang();
    const dict = TRANSLATIONS[lang];
    const t = (key: string, params?: Record<string, string | number>) => interpolate(resolveKey(dict, key), params);
    return `${formatLongDay(day.date, this.locale())} — ${dayTooltip(day, lang, this.locale(), t)}`;
  }
}
