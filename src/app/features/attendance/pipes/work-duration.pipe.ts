import { Pipe, PipeTransform, inject } from '@angular/core';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../core/i18n';
import { LanguageService } from '../../../core/services/language.service';

/**
 * Minutes → "7س 45د" / "7h 45m".
 *
 *   {{ day.workedMinutes | workDuration }}
 *   {{ 0 | workDuration: '—' }}   → "—" instead of "0د"
 *
 * Impure so it follows a language switch; the work is a couple of lookups.
 */
@Pipe({ name: 'workDuration', standalone: true, pure: false })
export class WorkDurationPipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(minutes: number | null | undefined, zeroText?: string): string {
    const total = Math.max(0, Math.round(minutes ?? 0));
    if (total === 0 && zeroText !== undefined) return zeroText;
    const dict = TRANSLATIONS[this.language.lang()];
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h === 0) return interpolate(resolveKey(dict, 'attendance.units.m'), { m });
    if (m === 0) return interpolate(resolveKey(dict, 'attendance.units.h'), { h });
    return interpolate(resolveKey(dict, 'attendance.units.hm'), { h, m });
  }
}
