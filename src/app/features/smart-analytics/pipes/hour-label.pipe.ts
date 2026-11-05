import { Pipe, PipeTransform, inject } from '@angular/core';
import { TRANSLATIONS, resolveKey } from '../../../core/i18n';
import { LanguageService } from '../../../core/services/language.service';
import { to12Hour } from '../utils/contact-time.util';

/**
 * `13 | hourLabel` → "1 م" / "1 PM".
 * `13 | hourLabel: true` → "1 – 2 م" / "1 – 2 PM" (the whole one-hour bucket).
 */
@Pipe({
  name: 'hourLabel',
  standalone: true,
  pure: false, // language toggles re-render
})
export class HourLabelPipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(hour: number | null | undefined, asRange = false): string {
    if (hour === null || hour === undefined) return '';
    const dict = TRANSLATIONS[this.language.lang()];
    const period = (p: 'am' | 'pm') => resolveKey(dict, `smartAnalytics.timing.${p}`);
    const from = to12Hour(hour);
    if (!asRange) return `${from.hour} ${period(from.period)}`;
    const to = to12Hour(hour + 1);
    return from.period === to.period
      ? `${from.hour} – ${to.hour} ${period(to.period)}`
      : `${from.hour} ${period(from.period)} – ${to.hour} ${period(to.period)}`;
  }
}
