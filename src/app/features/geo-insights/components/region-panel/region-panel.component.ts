import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CountryFlagComponent } from '../../../../shared/components/country-flag/country-flag.component';
import { SlidePanelComponent } from '../../../../shared/components/slide-panel/slide-panel.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { GeoUnitLabels, MapSelection, StatusCount } from '../../models/geo.models';
import { share } from '../../utils/geo.util';

/**
 * Side panel for a selected region: headline numbers, the status breakdown —
 * and whatever list the page projects (`<ng-content />`, e.g. the customers).
 */
@Component({
  selector: 'app-region-panel',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe, SlidePanelComponent, CountryFlagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './region-panel.component.html',
  styleUrl: './region-panel.component.scss',
})
export class RegionPanelComponent {
  readonly selection = input.required<MapSelection>();
  readonly labels = input.required<GeoUnitLabels>();
  readonly closed = output<void>();

  protected readonly title = computed(() => {
    const s = this.selection();
    switch (s.kind) {
      case 'country': return s.country.name;
      case 'governorate': return s.governorate.name;
      default: return null;
    }
  });

  protected readonly headline = computed(() => {
    const s = this.selection();
    switch (s.kind) {
      case 'country':
        return { count: s.country.count, percentage: s.country.percentage as number | null, inferred: s.country.inferredCount, byStatus: s.country.byStatus };
      case 'governorate':
        return { count: s.governorate.count, percentage: s.governorate.percentage as number | null, inferred: 0, byStatus: s.governorate.byStatus };
      case 'unknown':
        return { count: s.count, percentage: null, inferred: 0, byStatus: s.byStatus };
      case 'egyptNoGovernorate':
        return { count: s.count, percentage: null, inferred: 0, byStatus: [] as StatusCount[] };
    }
  });

  protected readonly statusRows = computed(() => {
    const { count, byStatus } = this.headline();
    const top = Math.max(1, ...byStatus.map((s) => s.count));
    const label = this.labels().statusLabel;
    return byStatus.map((s) => ({ ...s, label: label(s.status), share: share(s.count, count), width: (s.count / top) * 100 }));
  });
}
