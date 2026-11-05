import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, map } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AnalyticsTab, AnalyticsTabsComponent } from '../../components/analytics-tabs/analytics-tabs.component';
import { ContactHeatmapComponent } from '../../components/contact-heatmap/contact-heatmap.component';
import { CustomerHealthPanelComponent } from '../../components/customer-health-panel/customer-health-panel.component';
import { MonthPickerComponent } from '../../components/month-picker/month-picker.component';
import { PerformanceChartComponent } from '../../components/performance-chart/performance-chart.component';
import { RepPerformanceTableComponent } from '../../components/rep-performance-table/rep-performance-table.component';
import { RepReviewDialogComponent } from '../../components/rep-review-dialog/rep-review-dialog.component';
import { SourceQualityPanelComponent } from '../../components/source-quality-panel/source-quality-panel.component';
import { TopContactTimesComponent } from '../../components/top-contact-times/top-contact-times.component';
import {
  ANALYTICS_RANGES,
  AnalyticsSection,
  RepReviewInput,
  SECTION_ACCESS,
} from '../../models/smart-analytics.models';
import { HourLabelPipe } from '../../pipes/hour-label.pipe';
import { SmartAnalyticsStore } from '../../state/smart-analytics.store';
import { monthLabel } from '../../utils/month.util';
import { RepPerformanceView } from '../../utils/rep-performance.util';

const TAB_ICONS: Readonly<Record<AnalyticsSection, string>> = {
  sources: 'fa-solid fa-filter-circle-dollar',
  timing: 'fa-solid fa-clock',
  health: 'fa-solid fa-heart-pulse',
  performance: 'fa-solid fa-ranking-star',
};

/** Sections that follow the shared look-back range. */
const RANGED: ReadonlyArray<AnalyticsSection> = ['sources', 'timing'];

/**
 * `/smart-analytics` — container page.
 *
 * Owns the page-scoped `SmartAnalyticsStore`, keeps the active section in
 * `?tab=` (deep-linkable, survives reloads) and wires store state into the
 * presentational section components. Sections the user can't access never
 * render, and the repository enforces the same rule.
 */
@Component({
  selector: 'app-smart-analytics',
  standalone: true,
  imports: [
    DecimalPipe,
    TranslatePipe,
    HourLabelPipe,
    TipDirective,
    StatCardComponent,
    LoadErrorComponent,
    AnalyticsTabsComponent,
    SourceQualityPanelComponent,
    ContactHeatmapComponent,
    TopContactTimesComponent,
    CustomerHealthPanelComponent,
    MonthPickerComponent,
    PerformanceChartComponent,
    RepPerformanceTableComponent,
    RepReviewDialogComponent,
  ],
  providers: [SmartAnalyticsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './smart-analytics.component.html',
  styleUrl: './smart-analytics.component.scss',
})
export class SmartAnalyticsComponent {
  readonly store = inject(SmartAnalyticsStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly ranges = ANALYTICS_RANGES;

  readonly tabs = computed<AnalyticsTab[]>(() =>
    this.store.sections().map((id) => ({
      id,
      icon: TAB_ICONS[id],
      restricted: !SECTION_ACCESS[id].includes('Sales'),
    })),
  );

  private readonly tabParam = toSignal(this.route.queryParamMap.pipe(map((q) => q.get('tab'))), {
    initialValue: null,
  });

  /** The requested tab if this user may open it, else their first section. */
  readonly active = computed<AnalyticsSection>(() => {
    const allowed = this.store.sections();
    const wanted = this.tabParam() as AnalyticsSection | null;
    return wanted && allowed.includes(wanted) ? wanted : (allowed[0] ?? 'sources');
  });

  readonly showRange = computed(() => RANGED.includes(this.active()));

  /** Loading on top of data already on screen (vs. first load → skeleton). */
  readonly refreshing = computed(() => {
    const slice = this.sliceOf(this.active());
    return slice.loading() && slice.loaded();
  });

  readonly monthText = computed(() =>
    monthLabel(this.store.month(), this.language.lang() === 'ar' ? 'ar-EG' : 'en-GB'),
  );

  // ─────────── review dialog ───────────
  readonly reviewing = signal<RepPerformanceView | null>(null);
  readonly saving = signal(false);

  constructor() {
    // Opening a section (by click, deep link or default) loads it once.
    effect(() => {
      const section = this.active();
      untracked(() => this.store.open(section));
    });
  }

  selectTab(section: AnalyticsSection): void {
    if (section === this.active()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: section },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  refresh(): void {
    this.store.reload(this.active());
  }

  openReview(rep: RepPerformanceView): void {
    this.reviewing.set(rep);
  }

  closeReview(): void {
    if (!this.saving()) this.reviewing.set(null);
  }

  saveReview(input: RepReviewInput): void {
    const rep = this.reviewing();
    if (!rep || this.saving()) return;
    this.saving.set(true);
    this.store
      .saveReview(rep.repId, input)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.reviewing.set(null);
          this.toast.success(this.t('smartAnalytics.performance.saved'));
        },
        error: (err: ApiError) =>
          this.toast.error(err?.message?.trim() || this.t('smartAnalytics.performance.saveFailed')),
      });
  }

  private sliceOf(section: AnalyticsSection) {
    switch (section) {
      case 'sources':
        return this.store.sources;
      case 'timing':
        return this.store.contact;
      case 'health':
        return this.store.health;
      case 'performance':
        return this.store.performance;
    }
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
