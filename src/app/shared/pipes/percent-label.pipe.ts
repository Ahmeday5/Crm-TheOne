import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../../core/services/language.service';

/** Locale-aware `"2.5%"` / `"+20%"`; `value` is already on a 0–100 scale. */
export function formatPercent(
  value: number | null | undefined,
  locale: string,
  maxDecimals = 1,
  signed = false,
): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const formatted = n.toLocaleString(locale, { maximumFractionDigits: maxDecimals });
  return `${signed && n > 0 ? '+' : ''}${formatted}%`;
}

/**
 * Formats a percentage figure with the active locale's digits and a
 * trailing `%`, dropping needless decimals.
 *
 *   {{ 2.5 | pct }}       → "2.5%"
 *   {{ 83.333 | pct }}    → "83.3%"
 *   {{ 120 | pct:0 }}     → "120%"
 *   {{ 20 | pct:1:true }} → "+20%"
 *
 * Impure for the same reason as `money`: it must follow a language switch.
 */
@Pipe({ name: 'pct', standalone: true, pure: false })
export class PercentLabelPipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(value: number | null | undefined, maxDecimals = 1, signed = false): string {
    return formatPercent(value, this.language.lang() === 'ar' ? 'ar-EG' : 'en-US', maxDecimals, signed);
  }
}
