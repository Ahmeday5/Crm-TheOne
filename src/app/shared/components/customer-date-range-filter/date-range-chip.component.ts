import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../core/i18n';
import { LanguageService } from '../../../core/services/language.service';
import { localeFor } from '../../../core/utils/cairo-time.util';
import { normalizeDateRange } from '../../../core/utils/date-range.util';
import { CustomerDateFilter } from '../../models';
import { TranslatePipe } from '../../pipes/translate.pipe';

const formatters = new Map<string, Intl.DateTimeFormat>();

/** `yyyy-MM-dd` → "5 Nov 2026" / "٥ نوفمبر ٢٠٢٦" — a calendar day, so read in UTC. */
function formatDay(day: string, locale: string): string {
  let fmt = formatters.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
    formatters.set(locale, fmt);
  }
  return fmt.format(new Date(`${day}T00:00:00Z`));
}

/**
 * Removable "active filter" chip for the date-added range — sits next to the
 * result count so the user always sees what the list is scoped to.
 * Renders nothing while no range is set.
 */
@Component({
  selector: 'app-date-range-chip',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (text(); as label) {
      <span class="drc">
        <i class="fa-regular fa-calendar" aria-hidden="true"></i>
        <span class="drc__text">{{ labelKey() | translate }}: <bdi>{{ label }}</bdi></span>
        <button type="button" class="drc__x" [attr.aria-label]="'dateFilter.removeChip' | translate" (click)="removed.emit()">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </span>
    }
  `,
  styles: [
    `
      :host { display: inline-flex; min-width: 0; }
      .drc {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        max-width: 100%;
        padding: 0.15rem 0.3rem 0.15rem 0.6rem;
        border-radius: var(--radius-pill);
        background: var(--brand-50, var(--surface-1));
        border: 1px solid var(--brand-200, var(--border));
        color: var(--brand-600, var(--brand-500));
        font-size: var(--fs-xs);
        font-weight: var(--fw-600);
        animation: drc-pop 180ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
      }
      :host-context([dir='rtl']) .drc { padding: 0.15rem 0.6rem 0.15rem 0.3rem; }
      .drc__text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .drc__x {
        display: inline-grid;
        place-items: center;
        width: 1.25rem;
        height: 1.25rem;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: inherit;
        flex-shrink: 0;
      }
      .drc__x:hover { background: var(--brand-500); color: #fff; }
      .drc__x:focus-visible { outline: 2px solid var(--brand-500); outline-offset: 1px; }
      @keyframes drc-pop { from { opacity: 0; transform: scale(0.92); } }
      @media (prefers-reduced-motion: reduce) { .drc { animation: none; } }
    `,
  ],
})
export class DateRangeChipComponent {
  readonly range = input<CustomerDateFilter>({});
  readonly labelKey = input('dateFilter.createdAt');
  readonly removed = output<void>();

  private readonly language = inject(LanguageService);

  protected readonly text = computed<string | null>(() => {
    const { from, to } = normalizeDateRange(this.range());
    if (!from && !to) return null;
    const lang = this.language.lang();
    const dict = TRANSLATIONS[lang];
    const locale = localeFor(lang);
    if (from && to) {
      if (from === to) return formatDay(from, locale);
      return interpolate(resolveKey(dict, 'dateFilter.between'), {
        from: formatDay(from, locale),
        to: formatDay(to, locale),
      });
    }
    return from
      ? interpolate(resolveKey(dict, 'dateFilter.since'), { from: formatDay(from, locale) })
      : interpolate(resolveKey(dict, 'dateFilter.until'), { to: formatDay(to!, locale) });
  });
}
