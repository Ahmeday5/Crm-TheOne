import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { LanguageService } from '../../../../core/services/language.service';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { RequestTargetFields } from '../../models/client-portal.models';
import { audienceIcon, platformChipIcon, targetIcon } from '../../utils/request-target.util';

type TargetSource = RequestTargetFields & { targetLabel?: string | null };

/**
 * "What it's about" as one compact chip: icon + the most specific name we
 * have (surface / app name → app audience → target), plus the platform.
 * The same chip everywhere — portal, inbox, workspace — so people learn it once.
 */
@Component({
  selector: 'app-request-target-chip',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="rtc" [class.rtc--sm]="size() === 'sm'" [attr.data-target]="source().target" [title]="label()">
      <i [class]="icon()" aria-hidden="true"></i>
      <span class="rtc__label">{{ label() }}</span>
      @if (source().appPlatform && source().appPlatform !== 'Unknown' && source().target === 'MobileApp') {
        <i class="rtc__platform" [class]="platformIcon()" [attr.aria-label]="'clientRequests.platform.' + source().appPlatform | translate"></i>
      }
    </span>
  `,
  styles: `
    :host { display: inline-flex; min-width: 0; max-width: 100%; }
    .rtc {
      display: inline-flex; align-items: center; gap: 0.35rem; min-width: 0; max-width: 100%;
      padding: 0.2rem 0.6rem; border-radius: var(--radius-pill);
      background: var(--surface-2); color: var(--text-2);
      font-size: var(--fs-xs); font-weight: var(--fw-600); line-height: 1.5;
      border: 1px solid var(--border);
    }
    .rtc[data-target='MobileApp'] { background: var(--brand-soft); color: var(--brand-600); border-color: transparent; }
    .rtc[data-target='Dashboard'] { background: var(--info-soft); color: var(--info); border-color: transparent; }
    .rtc[data-target='Website'] { background: var(--success-soft); color: var(--success); border-color: transparent; }
    .rtc--sm { padding: 0.1rem 0.5rem; font-size: 0.7rem; }
    .rtc__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rtc__platform { opacity: 0.75; }
  `,
})
export class RequestTargetChipComponent {
  private readonly lang = inject(LanguageService);

  readonly source = input.required<TargetSource>();
  readonly size = input<'sm' | 'md'>('md');

  protected readonly icon = computed(() => {
    const s = this.source();
    return s.target === 'MobileApp' ? audienceIcon(s.appAudience) : targetIcon(s.target);
  });

  protected readonly platformIcon = computed(() => platformChipIcon(this.source().appPlatform));

  protected readonly label = computed(() => {
    const s = this.source();
    const dict = TRANSLATIONS[this.lang.lang()];
    if (s.targetLabel) return s.targetLabel;
    if (s.target === 'MobileApp' && s.appAudience) {
      return s.appAudience === 'Other' && s.appName ? s.appName : resolveKey(dict, `clientRequests.audience.${s.appAudience}`);
    }
    return resolveKey(dict, `clientRequests.target.${s.target ?? 'Other'}`);
  });
}
