import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../../core/services/language.service';

const UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 86_400],
  ['month', 30 * 86_400],
  ['week', 7 * 86_400],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

/**
 * "منذ ٣ ساعات" / "3 hours ago" in the current language. Impure so it follows
 * a language switch; formatters are cached per locale.
 *
 *   {{ item.updatedAt | timeAgo }}
 */
@Pipe({ name: 'timeAgo', standalone: true, pure: false })
export class TimeAgoPipe implements PipeTransform {
  private static readonly cache = new Map<string, Intl.RelativeTimeFormat>();
  private readonly language = inject(LanguageService);

  transform(value: string | Date | null | undefined, fallback = '—'): string {
    if (!value) return fallback;
    const time = value instanceof Date ? value.getTime() : Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
    if (Number.isNaN(time)) return fallback;
    const diffSec = Math.round((time - Date.now()) / 1000);
    const locale = this.language.lang() === 'ar' ? 'ar-EG' : 'en';
    const fmt = this.formatter(locale);
    if (Math.abs(diffSec) < 45) return fmt.format(0, 'second');
    for (const [unit, seconds] of UNITS) {
      if (Math.abs(diffSec) >= seconds || unit === 'minute') {
        return fmt.format(Math.round(diffSec / seconds), unit);
      }
    }
    return fallback;
  }

  private formatter(locale: string): Intl.RelativeTimeFormat {
    let f = TimeAgoPipe.cache.get(locale);
    if (!f) {
      f = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
      TimeAgoPipe.cache.set(locale, f);
    }
    return f;
  }
}
