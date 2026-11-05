import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ResponsiveTableDirective } from '../../../../shared/directives/responsive-table.directive';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AnimatedNumberDirective } from '../../directives/animated-number.directive';
import { SourceChannel, SourceDimension } from '../../models/smart-analytics.models';
import {
  MIN_SOURCE_SAMPLE,
  RankedSource,
  SortDirection,
  SourceQualitySummary,
  SourceSortKey,
  sortSources,
} from '../../utils/source-quality.util';

const CHANNEL_ICONS: Readonly<Record<SourceChannel, string>> = {
  facebook: 'fa-brands fa-facebook-f',
  instagram: 'fa-brands fa-instagram',
  google: 'fa-brands fa-google',
  tiktok: 'fa-brands fa-tiktok',
  whatsapp: 'fa-brands fa-whatsapp',
  website: 'fa-solid fa-globe',
  referral: 'fa-solid fa-user-group',
  walkIn: 'fa-solid fa-store',
  other: 'fa-solid fa-ellipsis',
};

interface SourceRowView extends RankedSource {
  label: string;
  icon: string;
}

/**
 * Source / campaign quality: best-worst-average spotlight + a sortable
 * table with animated conversion bars. Presentational — the dimension is
 * owned by the store; sorting is local view state.
 */
@Component({
  selector: 'app-source-quality-panel',
  standalone: true,
  imports: [
    DecimalPipe,
    TranslatePipe,
    TipDirective,
    ResponsiveTableDirective,
    EmptyStateComponent,
    AnimatedNumberDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './source-quality-panel.component.html',
  styleUrl: './source-quality-panel.component.scss',
})
export class SourceQualityPanelComponent {
  private readonly language = inject(LanguageService);

  readonly summary = input.required<SourceQualitySummary>();
  readonly dimension = input.required<SourceDimension>();
  /** A newer range/dimension is loading over the current rows. */
  readonly refreshing = input(false);
  readonly dimensionChange = output<SourceDimension>();

  readonly dimensions: SourceDimension[] = ['source', 'campaign'];
  readonly minSample = MIN_SOURCE_SAMPLE;

  readonly sortKey = signal<SourceSortKey>('conversionRate');
  readonly sortDir = signal<SortDirection>('desc');

  readonly rows = computed<SourceRowView[]>(() => {
    const lang = this.language.lang();
    const labelled = this.summary().rows.map((r) => ({
      ...r,
      // Fixed channels are translated; campaign names are user content.
      name: this.dimension() === 'source' ? this.channelLabel(r.channel, r.name) : r.name,
    }));
    return sortSources(labelled, this.sortKey(), this.sortDir(), new Intl.Collator(lang)).map((r) => ({
      ...r,
      label: r.name,
      icon: CHANNEL_ICONS[r.channel] ?? CHANNEL_ICONS.other,
    }));
  });

  readonly best = computed(() => this.rows().find((r) => r.tag === 'best') ?? null);
  readonly worst = computed(() => this.rows().find((r) => r.tag === 'worst') ?? null);

  readonly columns: SourceSortKey[] = ['name', 'customers', 'buyers', 'conversionRate'];

  columnLabel(col: SourceSortKey): string {
    switch (col) {
      case 'name':
        return `smartAnalytics.sources.columns.${this.dimension()}`;
      case 'conversionRate':
        return 'smartAnalytics.sources.columns.conversion';
      default:
        return `smartAnalytics.sources.columns.${col}`;
    }
  }

  sortBy(key: SourceSortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDir.set(key === 'name' ? 'asc' : 'desc');
    }
  }

  ariaSort(key: SourceSortKey): 'ascending' | 'descending' | 'none' {
    if (this.sortKey() !== key) return 'none';
    return this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }

  private channelLabel(channel: SourceChannel, fallback: string): string {
    const key = `smartAnalytics.channels.${channel}`;
    const label = resolveKey(TRANSLATIONS[this.language.lang()], key);
    return label === key ? fallback : label;
  }
}
