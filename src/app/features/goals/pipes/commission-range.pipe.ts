import { Pipe, PipeTransform, inject } from '@angular/core';
import { TRANSLATIONS, resolveKey } from '../../../core/i18n';
import { LanguageService } from '../../../core/services/language.service';
import { CommissionTier } from '../../../shared/models';
import { formatPercent } from '../../../shared/pipes/percent-label.pipe';

const RANGE_KEY: Record<CommissionTier, { withThreshold: string; noThreshold: string }> = {
  BelowThreshold: {
    withThreshold: 'goals.commission.range.below',
    noThreshold: 'goals.commission.range.belowNoThreshold',
  },
  UpToTarget: {
    withThreshold: 'goals.commission.range.upTo',
    noThreshold: 'goals.commission.range.upToNoThreshold',
  },
  AboveTarget: {
    withThreshold: 'goals.commission.range.above',
    noThreshold: 'goals.commission.range.above',
  },
};

/**
 * Human range of a commission bracket for a given threshold:
 *
 *   {{ 'BelowThreshold' | commissionRange: 70 }}   → "أقل من 70% من التارجت"
 *   {{ 'UpToTarget' | commissionRange: 70 }}       → "من 70% إلى 100%"
 *   {{ 'AboveTarget' | commissionRange: 70 }}      → "أكثر من 100%"
 *
 * Impure so the label follows both a language switch and a threshold
 * being typed into the goal form.
 */
@Pipe({ name: 'commissionRange', standalone: true, pure: false })
export class CommissionRangePipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(tier: CommissionTier, thresholdPercent: number | null | undefined): string {
    const lang = this.language.lang();
    const locale = lang === 'ar' ? 'ar-EG' : 'en-US';
    const keys = RANGE_KEY[tier];
    const hasThreshold = thresholdPercent != null;
    const template = resolveKey(TRANSLATIONS[lang], hasThreshold ? keys.withThreshold : keys.noThreshold);
    return template
      .replace('{t}', hasThreshold ? formatPercent(thresholdPercent, locale, 0) : '')
      .replace('{max}', formatPercent(100, locale, 0));
  }
}
