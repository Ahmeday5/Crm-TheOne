import { Pipe, PipeTransform, inject } from '@angular/core';
import { CompanySettingsService } from '../../core/services/company-settings.service';
import { LanguageService } from '../../core/services/language.service';

/**
 * Formats a money amount with the tenant's default currency (from
 * `CompanySettings`) and the active locale's grouping.
 *
 *   {{ project.price | money }}        → "250,000 EGP"
 *   {{ contract.value | money:'USD' }} → override the currency
 *
 * Impure so it reflects a currency/language switch without an input change —
 * money figures on a page are few, so the cost is negligible.
 */
@Pipe({ name: 'money', standalone: true, pure: false })
export class MoneyPipe implements PipeTransform {
  private readonly settings = inject(CompanySettingsService);
  private readonly language = inject(LanguageService);

  transform(value: number | null | undefined, currencyOverride?: string): string {
    const amount =
      typeof value === 'number' && !Number.isNaN(value) ? value : 0;
    const locale = this.language.lang() === 'ar' ? 'ar-EG' : 'en-US';
    const formatted = amount.toLocaleString(locale, {
      maximumFractionDigits: 2,
    });
    const currency = (currencyOverride ?? this.settings.currency()).trim();
    return currency ? `${formatted} ${currency}` : formatted;
  }
}
