import { Pipe, PipeTransform, inject } from '@angular/core';
import { TRANSLATIONS, resolveKey } from '../../core/i18n';
import { CompanySettingsService } from '../../core/services/company-settings.service';
import { LanguageService } from '../../core/services/language.service';

/**
 * Formats a money amount with the tenant's default currency (from
 * `CompanySettings`) and the active locale's grouping. When the tenant has
 * no currency configured, the localized default (`common.defaultCurrency`)
 * is used so an amount is never shown as a bare number.
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
    const lang = this.language.lang();
    const formatted = amount.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', {
      maximumFractionDigits: 2,
    });
    const currency =
      (currencyOverride ?? this.settings.currency()).trim() ||
      resolveKey(TRANSLATIONS[lang], 'common.defaultCurrency');
    return `${formatted} ${currency}`;
  }
}
