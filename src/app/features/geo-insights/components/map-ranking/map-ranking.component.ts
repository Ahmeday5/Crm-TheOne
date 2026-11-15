import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CountryFlagComponent } from '../../../../shared/components/country-flag/country-flag.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

/** One ranked region (country, governorate, or a no-shape bucket). */
export interface RankRow {
  key: string;
  name: string;
  /** Country flag; governorates and buckets carry an icon instead. */
  iso2?: string | null;
  icon?: string;
  count: number;
  percentage: number;
  /** Countries only: guessed from the phone number. */
  inferredCount?: number | null;
  /** The region's fill on the map — the swatch ties row ↔ shape. */
  color?: string | null;
  /** Bucket rows (unknown / without governorate) sit apart, muted. */
  bucket?: boolean;
}

/**
 * Ranking next to the map — and the whole view on phones. Sorted by count by
 * the caller. Each row is a button: selecting it opens the same side panel
 * as clicking the region on the map.
 */
@Component({
  selector: 'app-map-ranking',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe, CountryFlagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './map-ranking.component.html',
  styleUrl: './map-ranking.component.scss',
})
export class MapRankingComponent {
  readonly rows = input<RankRow[]>([]);
  readonly selectedKey = input<string | null>(null);
  readonly regionLabelKey = input('geo.ranking.country');
  readonly showInferred = input(true);
  readonly selectRow = output<RankRow>();

  /** Bars scale to the top region, not to 100 %, so small shares stay visible. */
  protected readonly topCount = computed(() => Math.max(1, ...this.rows().filter((r) => !r.bucket).map((r) => r.count)));
}
