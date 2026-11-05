import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { SMART_ANALYTICS_REPOSITORY } from '../data/smart-analytics-repository.provider';
import {
  ANALYTICS_SECTIONS,
  AnalyticsRange,
  AnalyticsSection,
  ContactSlot,
  CustomerTickets,
  MonthKey,
  RepMonthlyPerformance,
  RepReview,
  RepReviewInput,
  SECTION_ACCESS,
  SourceDimension,
  SourceQualityRow,
} from '../models/smart-analytics.models';
import {
  buildHeatmap,
  summarizeContact,
  topContactSlots,
} from '../utils/contact-time.util';
import { healthDistribution, scoreCustomer } from '../utils/customer-health.util';
import { cairoMonth, monthProgress, shiftMonth } from '../utils/month.util';
import { compareReps, teamTotals, toPerformanceViews } from '../utils/rep-performance.util';
import { summarizeSources } from '../utils/source-quality.util';
import { AsyncSlice } from './async-slice';

/** How far back the month picker goes. */
export const PERFORMANCE_HISTORY_MONTHS = 12;

/**
 * Page-scoped state for `/smart-analytics` (provided by the page, so it is
 * created on entry and torn down on leave).
 *
 * Each section is an independent `AsyncSlice`, loaded lazily the first time
 * its tab is opened and reloaded when its own parameters change. All
 * derived figures are `computed` from the raw slices through the pure
 * functions in `utils/`.
 */
@Injectable()
export class SmartAnalyticsStore {
  private readonly repo = inject(SMART_ANALYTICS_REPOSITORY);
  private readonly auth = inject(AuthService);

  readonly isDemo = this.repo.isDemo;
  readonly role = this.auth.currentRole;
  readonly isAdmin = computed(() => this.role() === 'Admin');

  /** Sections this user may open, in display order. */
  readonly sections = computed<AnalyticsSection[]>(() => {
    const role = this.role();
    return ANALYTICS_SECTIONS.filter((s) => !!role && SECTION_ACCESS[s].includes(role));
  });

  // ─────────── parameters ───────────
  readonly range = signal<AnalyticsRange>('90d');
  readonly dimension = signal<SourceDimension>('source');
  readonly month = signal<MonthKey>(cairoMonth());
  readonly maxMonth = cairoMonth();
  readonly minMonth = shiftMonth(this.maxMonth, -(PERFORMANCE_HISTORY_MONTHS - 1));

  // ─────────── raw slices ───────────
  readonly sources = new AsyncSlice<SourceQualityRow[]>();
  readonly contact = new AsyncSlice<ContactSlot[]>();
  readonly health = new AsyncSlice<CustomerTickets[]>();
  readonly performance = new AsyncSlice<RepMonthlyPerformance[]>();

  /** Sections opened at least once — only those reload on parameter changes. */
  private readonly requested = new Set<AnalyticsSection>();
  /** Reference "now" for ticket ages, refreshed with every health load. */
  private readonly healthNow = signal(new Date());

  // ─────────── derived: sources ───────────
  readonly sourceSummary = computed(() => summarizeSources(this.sources.value() ?? []));

  // ─────────── derived: contact times ───────────
  readonly topSlots = computed(() => topContactSlots(this.contact.value() ?? [], 3));
  readonly heatmap = computed(() => buildHeatmap(this.contact.value() ?? [], this.topSlots()));
  readonly contactSummary = computed(() => summarizeContact(this.contact.value() ?? []));

  // ─────────── derived: health ───────────
  readonly customers = computed(() => {
    const now = this.healthNow();
    return (this.health.value() ?? [])
      .map((c) => scoreCustomer(c, now))
      .sort((a, b) => a.score - b.score || a.customerName.localeCompare(b.customerName, 'ar'));
  });
  readonly distribution = computed(() => healthDistribution(this.customers()));

  // ─────────── derived: performance ───────────
  readonly reps = computed(() => toPerformanceViews(this.performance.value() ?? []).sort(compareReps));
  readonly team = computed(() => teamTotals(this.performance.value() ?? []));
  readonly monthInProgress = computed(() => monthProgress(this.month()) < 1);

  /** Parameters each section was last fetched with — avoids duplicate requests. */
  private readonly fetchedWith = new Map<AnalyticsSection, string>();

  constructor() {
    // Parameter changes reload only the sections that depend on them and
    // have actually been opened.
    effect(() => {
      this.dimension();
      this.range();
      untracked(() => {
        this.sync('sources');
        this.sync('timing');
      });
    });
    effect(() => {
      this.month();
      untracked(() => this.sync('performance'));
    });

    inject(DestroyRef).onDestroy(() =>
      [this.sources, this.contact, this.health, this.performance].forEach((s) => s.dispose()),
    );
  }

  /** First visit of a section loads it; later visits keep what's there. */
  open(section: AnalyticsSection): void {
    if (!this.sections().includes(section) || this.requested.has(section)) return;
    this.requested.add(section);
    this.reload(section);
  }

  reload(section: AnalyticsSection): void {
    this.fetchedWith.set(section, this.paramsKey(section));
    switch (section) {
      case 'sources':
        this.sources.load(this.repo.sourceQuality({ dimension: this.dimension(), range: this.range() }));
        break;
      case 'timing':
        this.contact.load(this.repo.contactTimes({ range: this.range() }));
        break;
      case 'health':
        this.healthNow.set(new Date());
        this.health.load(this.repo.customerTickets());
        break;
      case 'performance':
        this.performance.load(this.repo.monthlyPerformance(this.month()));
        break;
    }
  }

  setMonth(month: MonthKey): void {
    if (month < this.minMonth || month > this.maxMonth) return;
    this.month.set(month);
  }

  /** Upserts the admin's review and patches the row in place. */
  saveReview(repId: string, input: RepReviewInput): Observable<RepReview> {
    return this.repo.saveReview(repId, this.month(), input).pipe(
      tap((review) =>
        this.performance.update((rows) =>
          rows.map((r) => (r.repId === repId && review.month === this.month() ? { ...r, review } : r)),
        ),
      ),
    );
  }

  // ─────────── internals ───────────

  /** Reloads `section` if it was opened and its parameters changed since the last fetch. */
  private sync(section: AnalyticsSection): void {
    if (!this.requested.has(section)) return;
    if (this.fetchedWith.get(section) === this.paramsKey(section)) return;
    this.reload(section);
  }

  private paramsKey(section: AnalyticsSection): string {
    switch (section) {
      case 'sources':
        return `${this.dimension()}|${this.range()}`;
      case 'timing':
        return this.range();
      case 'performance':
        return this.month();
      case 'health':
        return '';
    }
  }
}
