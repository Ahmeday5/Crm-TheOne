import { Pipe, PipeTransform, inject } from '@angular/core';
import { APP_TIME_ZONE } from '../../core/constants/time-zone.const';
import { LanguageService } from '../../core/services/language.service';

// Re-exported for existing importers; new code imports it from core.
export { APP_TIME_ZONE };

export type CairoDateFormat = 'date' | 'datetime' | 'time';

const FORMATS: Record<CairoDateFormat, Intl.DateTimeFormatOptions> = {
  date: { year: 'numeric', month: 'short', day: 'numeric' },
  datetime: {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  },
  time: { hour: 'numeric', minute: '2-digit' },
};

/**
 * Parses a backend timestamp. The API sends UTC (`…Z`); a value without any
 * zone designator is also treated as UTC rather than as device-local time.
 */
export function parseUtc(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const hasZone = /(z|[+-]\d{2}:?\d{2})$/i.test(value.trim());
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
  const date = new Date(hasZone || isDateOnly ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Formats a UTC timestamp in Cairo time using the active UI language.
 *
 *   {{ entry.contributedAt | cairoDate }}           → "٢١ أكتوبر ٢٠٢٦، ١:١٥ م"
 *   {{ goal.endDate | cairoDate:'date' }}           → "٢١ أكتوبر ٢٠٢٦"
 *
 * Impure so it follows a language switch; formatters are memoised per
 * locale + format, so re-evaluation is cheap.
 */
@Pipe({ name: 'cairoDate', standalone: true, pure: false })
export class CairoDatePipe implements PipeTransform {
  private readonly language = inject(LanguageService);
  private static readonly formatters = new Map<string, Intl.DateTimeFormat>();

  transform(
    value: string | Date | null | undefined,
    format: CairoDateFormat = 'datetime',
    fallback = '—',
  ): string {
    const date = parseUtc(value);
    if (!date) return fallback;
    return this.formatter(format).format(date);
  }

  private formatter(format: CairoDateFormat): Intl.DateTimeFormat {
    const locale = this.language.lang() === 'ar' ? 'ar-EG' : 'en-GB';
    const key = `${locale}|${format}`;
    let fmt = CairoDatePipe.formatters.get(key);
    if (!fmt) {
      fmt = new Intl.DateTimeFormat(locale, { ...FORMATS[format], timeZone: APP_TIME_ZONE });
      CairoDatePipe.formatters.set(key, fmt);
    }
    return fmt;
  }
}
