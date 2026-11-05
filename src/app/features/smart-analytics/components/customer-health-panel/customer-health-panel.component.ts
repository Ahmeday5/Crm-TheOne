import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { AnimatedNumberDirective } from '../../directives/animated-number.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CustomerHealth, HEALTH_CLASSES, HealthClass } from '../../models/smart-analytics.models';
import { HealthDistribution, healthClass } from '../../utils/customer-health.util';
import { CustomerHealthCardComponent } from '../customer-health-card/customer-health-card.component';
import { HealthRingComponent } from '../health-ring/health-ring.component';

type ClassFilter = 'all' | HealthClass;
type HealthSort = 'worst' | 'best' | 'name';

const PAGE_SIZE = 12;

const CLASS_ICONS: Readonly<Record<HealthClass, string>> = {
  healthy: 'fa-solid fa-heart-circle-check',
  atRisk: 'fa-solid fa-heart-pulse',
  critical: 'fa-solid fa-heart-crack',
};

/**
 * Customer health: average + distribution overview (the class tiles double
 * as filters), formula explainer, search / sort, and a paged card grid.
 */
@Component({
  selector: 'app-customer-health-panel',
  standalone: true,
  imports: [
    DecimalPipe,
    FormsModule,
    TranslatePipe,
    AnimatedNumberDirective,
    EmptyStateComponent,
    HealthRingComponent,
    CustomerHealthCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-health-panel.component.html',
  styleUrl: './customer-health-panel.component.scss',
})
export class CustomerHealthPanelComponent {
  readonly customers = input.required<CustomerHealth[]>();
  readonly distribution = input.required<HealthDistribution>();
  readonly refreshing = input(false);

  readonly classes = HEALTH_CLASSES;
  readonly classIcons = CLASS_ICONS;
  readonly sorts: HealthSort[] = ['worst', 'best', 'name'];

  readonly filter = signal<ClassFilter>('all');
  readonly search = signal('');
  readonly sort = signal<HealthSort>('worst');
  readonly limit = signal(PAGE_SIZE);

  readonly averageClass = computed(() => healthClass(this.distribution().averageScore));

  private readonly filtered = computed(() => {
    const q = normalize(this.search());
    const cls = this.filter();
    const rows = this.customers().filter(
      (c) =>
        (cls === 'all' || c.healthClass === cls) &&
        (!q || normalize(c.customerName).includes(q) || (c.phone ?? '').includes(q)),
    );
    switch (this.sort()) {
      case 'best':
        return [...rows].sort((a, b) => b.score - a.score);
      case 'name':
        return [...rows].sort((a, b) => a.customerName.localeCompare(b.customerName, 'ar'));
      default:
        return [...rows].sort((a, b) => a.score - b.score);
    }
  });

  readonly total = computed(() => this.filtered().length);
  readonly visible = computed(() => this.filtered().slice(0, this.limit()));
  readonly hasFilters = computed(() => this.filter() !== 'all' || !!this.search().trim());

  constructor() {
    // A new filter/search/sort starts again from the first page.
    effect(() => {
      this.filter();
      this.search();
      this.sort();
      untracked(() => this.limit.set(PAGE_SIZE));
    });
  }

  toggleClass(cls: HealthClass): void {
    this.filter.update((f) => (f === cls ? 'all' : cls));
  }

  showMore(): void {
    this.limit.update((n) => n + PAGE_SIZE);
  }

  clearFilters(): void {
    this.filter.set('all');
    this.search.set('');
  }
}

/** Case-, diacritic- and alef/yaa-variant-insensitive Arabic/Latin matching. */
function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}
