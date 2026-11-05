import { Pipe, PipeTransform, inject } from '@angular/core';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../core/i18n';
import { LanguageService } from '../../../core/services/language.service';

/**
 * Server hours (decimal) → "8.08 ساعة" / "8.08 h", localised digits.
 *
 *   {{ record.workedHours | workHours }}
 *   {{ null | workHours: '—' }}   → "—"
 *
 * The value is shown as the server computed it (max two decimals) — never
 * re-derived from the timestamps. Impure so it follows a language switch.
 */
@Pipe({ name: 'workHours', standalone: true, pure: false })
export class WorkHoursPipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(hours: number | null | undefined, emptyText?: string): string {
    const missing = hours === null || hours === undefined || !Number.isFinite(hours);
    if (missing && emptyText !== undefined) return emptyText;
    const lang = this.language.lang();
    const value = (missing ? 0 : hours).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
      maximumFractionDigits: 2,
    });
    return interpolate(resolveKey(TRANSLATIONS[lang], 'attendance.units.hours'), { h: value });
  }
}
