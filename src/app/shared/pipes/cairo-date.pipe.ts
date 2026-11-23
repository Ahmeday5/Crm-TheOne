import { Pipe, PipeTransform, inject } from '@angular/core';
import { APP_TIME_ZONE } from '../../core/constants/time-zone.const';
import { LanguageService } from '../../core/services/language.service';

// Re-exported for existing importers; new code imports it from core.
export { APP_TIME_ZONE };

/** `numeric` = `dd/MM/yyyy` (table cells); `date` = `23 Nov 2026`. */
export type CairoDateFormat = 'date' | 'numeric' | 'datetime' | 'time';

const FORMATS: Record<CairoDateFormat, Intl.DateTimeFormatOptions> = {
  date: { year: 'numeric', month: 'short', day: 'numeric' },
  numeric: { day: '2-digit', month: '2-digit', year: 'numeric' },
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

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(lang: 'ar' | 'en', format: CairoDateFormat): Intl.DateTimeFormat {
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB';
  const key = `${locale}|${format}`;
  let fmt = formatters.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { ...FORMATS[format], timeZone: APP_TIME_ZONE });
    formatters.set(key, fmt);
  }
  return fmt;
}

/**
 * Code-side twin of the pipe (exports, computed labels): a backend UTC
 * timestamp, with or without `Z`, rendered in Cairo time.
 */
export function formatCairoDate(
  value: string | Date | null | undefined,
  lang: 'ar' | 'en',
  format: CairoDateFormat = 'datetime',
  fallback = '—',
): string {
  const date = parseUtc(value);
  return date ? formatterFor(lang, format).format(date) : fallback;
}

/**
 * Formats a UTC timestamp in Cairo time using the active UI language.
 *
 *   {{ entry.contributedAt | cairoDate }}           → "٢١ أكتوبر ٢٠٢٦، ١:١٥ م"
 *   {{ goal.endDate | cairoDate:'date' }}           → "٢١ أكتوبر ٢٠٢٦"
 *   {{ row.createdAt | cairoDate:'numeric' }}       → "23/11/2026"
 *
 * Impure so it follows a language switch; formatters are memoised per
 * locale + format, so re-evaluation is cheap.
 */
@Pipe({ name: 'cairoDate', standalone: true, pure: false })
export class CairoDatePipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(
    value: string | Date | null | undefined,
    format: CairoDateFormat = 'datetime',
    fallback = '—',
  ): string {
    return formatCairoDate(value, this.language.lang(), format, fallback);
  }
}
