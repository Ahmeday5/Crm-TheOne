import { DOCUMENT, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../../core/i18n';
import { BreakpointService } from '../../../../core/services/breakpoint.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  GeoAggregate,
  GeoPointInput,
  GeoUnitLabels,
  MapLevel,
  MapSelection,
  PinScope,
  StatusCount,
} from '../../models/geo.models';
import { GeoBoundariesService, GeoJson } from '../../services/geo-boundaries.service';
import {
  CountBucket,
  bucketIndex,
  countBuckets,
  countryKey,
  egyptOf,
  escapeHtml,
  governorateKey,
  share,
} from '../../utils/geo.util';
import { MapPalette, readMapPalette } from '../../utils/map-palette.util';
import { scatterPoints } from '../../utils/scatter.util';
import { GeoBubbleDatum, GeoMapComponent, GeoPointDatum, GeoRegionDatum } from '../geo-map/geo-map.component';
import { MapRankingComponent, RankRow } from '../map-ranking/map-ranking.component';

/** Largest markets get a pulsing ring. */
const HOTSPOTS = 3;
const UNKNOWN_KEY = '__unknown__';
const NO_GOVERNORATE_KEY = '__no_governorate__';
const EGYPT_ISO2 = 'EG';

/**
 * Everything the customer map and the tickets map share: the World ⇄ Egypt
 * level bar, the real map with its legend, the ranking list, tooltips, and
 * the selected region (two-way `selection` — the page opens its own panel).
 *
 * Phones get the ranking list first, with a toggle to the map.
 */
@Component({
  selector: 'app-geo-explorer',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe, GeoMapComponent, MapRankingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './geo-explorer.component.html',
  styleUrl: './geo-explorer.component.scss',
})
export class GeoExplorerComponent {
  private readonly language = inject(LanguageService);
  private readonly theme = inject(ThemeService);
  private readonly doc = inject(DOCUMENT);
  private readonly boundariesApi = inject(GeoBoundariesService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly isMobile = inject(BreakpointService).isMobile;

  readonly data = input<GeoAggregate | null>(null);
  readonly loading = input(false);
  readonly labels = input.required<GeoUnitLabels>();
  /** Customers only: the "guessed from the phone" column. */
  readonly showInferred = input(true);
  readonly selection = model<MapSelection | null>(null);
  readonly levelChange = output<MapLevel>();

  /** Records the page wants dropped as pins (already filtered to the active scope). */
  readonly points = input<GeoPointInput[]>([]);
  /** Whether per-record pins are supported for this map at all (customers: yes). */
  readonly enablePins = input(false);
  /** The page is currently fetching the records for the active pin scope. */
  readonly pinsLoading = input(false);
  /** The scope of records the page should load and pass back via `points`. */
  readonly pinScopeChange = output<PinScope | null>();
  /** A pin was clicked — the record's id. */
  readonly pointSelect = output<number>();

  protected readonly level = signal<MapLevel>('world');
  /** Which governorate's pins are shown: an id, `'all'`, or `null` (none). */
  protected readonly pinMode = signal<number | 'all' | null>(null);
  protected readonly mobileView = signal<'list' | 'map'>('list');
  private readonly worldGeo = signal<GeoJson | null | undefined>(undefined);
  private readonly egyptGeo = signal<GeoJson | null | undefined>(undefined);
  protected readonly palette = signal<MapPalette | null>(null);
  protected readonly dark = computed(() => this.theme.mode() === 'dark');
  protected readonly lang = computed(() => this.language.lang() as 'ar' | 'en');

  protected readonly egypt = computed(() => {
    const d = this.data();
    return d ? egyptOf(d) : null;
  });

  protected readonly activeGeo = computed(() => (this.level() === 'world' ? this.worldGeo() : this.egyptGeo()));
  private readonly shapeKeys = computed(() => new Set((this.activeGeo()?.features ?? []).map((f) => f.properties.name)));

  private readonly levelRegions = computed(() => {
    const d = this.data();
    if (!d) return [] as { key: string; count: number; lat: number; lng: number }[];
    return this.level() === 'world'
      ? d.countries.map((c) => ({ key: countryKey(c), count: c.count, lat: c.lat, lng: c.lng }))
      : d.governorates.map((g) => ({ key: governorateKey(g), count: g.count, lat: g.lat, lng: g.lng }));
  });

  protected readonly buckets = computed<CountBucket[]>(() =>
    countBuckets(Math.max(0, ...this.levelRegions().map((r) => r.count))),
  );

  private readonly steps = computed(() => {
    const p = this.palette();
    const n = this.buckets().length;
    if (!p || !n) return [] as string[];
    if (n >= p.steps.length) return p.steps;
    if (n === 1) return [p.steps[p.steps.length - 1]];
    return Array.from({ length: n }, (_, i) => p.steps[Math.round((i * (p.steps.length - 1)) / (n - 1))]);
  });

  protected readonly legend = computed(() =>
    this.buckets().map((b, i) => ({ label: b.min === b.max ? `${b.min}` : `${b.min}–${b.max}`, color: this.steps()[i] })),
  );

  protected readonly geoRegions = computed<GeoRegionDatum[]>(() => {
    const shapes = this.shapeKeys();
    return this.levelRegions()
      .filter((r) => shapes.has(r.key))
      .map((r) => ({ key: r.key, value: r.count, color: this.colorFor(r.count) }));
  });

  /** Shapeless regions as bubbles, plus pulsing rings on the top markets. */
  protected readonly geoBubbles = computed<GeoBubbleDatum[]>(() => {
    const shapes = this.shapeKeys();
    const regions = this.levelRegions();
    const hot = new Set(regions.slice(0, HOTSPOTS).map((r) => r.key));
    return regions
      .filter((r) => (!shapes.has(r.key) || hot.has(r.key)) && Number.isFinite(r.lat) && Number.isFinite(r.lng))
      .map((r) => ({ key: r.key, lng: r.lng, lat: r.lat, value: r.count, color: this.colorFor(r.count), pulse: hot.has(r.key) }));
  });

  /** The page's records, scattered into individual dots around their centroid. */
  protected readonly geoPoints = computed<GeoPointDatum[]>(() => {
    if (this.level() !== 'egypt' || this.pinMode() === null) return [];
    const byId = new Map(this.points().map((p) => [p.id, p]));
    return scatterPoints(this.points().map((p) => ({ id: p.id, lat: p.lat, lng: p.lng }))).map((s) => {
      const src = byId.get(s.id)!;
      return { id: s.id, lat: s.lat, lng: s.lng, label: src.label, sub: src.sub };
    });
  });

  protected readonly rankRows = computed<RankRow[]>(() => {
    const d = this.data();
    if (!d) return [];
    if (this.level() === 'world') {
      const rows: RankRow[] = d.countries.map((c) => ({
        key: countryKey(c),
        name: c.name,
        iso2: c.iso2,
        count: c.count,
        percentage: c.percentage,
        inferredCount: c.inferredCount,
        color: this.colorFor(c.count),
      }));
      if (d.unknown > 0) {
        rows.push({ key: UNKNOWN_KEY, name: this.t('geo.unknownCountry'), icon: 'fa-solid fa-circle-question', count: d.unknown, percentage: share(d.unknown, d.total), bucket: true });
      }
      return rows;
    }
    const egyptCount = this.egypt()?.count ?? 0;
    const rows: RankRow[] = d.governorates.map((g) => ({
      key: governorateKey(g),
      name: this.lang() === 'en' ? g.nameEn || g.name : g.name,
      icon: 'fa-solid fa-location-dot',
      count: g.count,
      percentage: g.percentage,
      color: this.colorFor(g.count),
    }));
    if (d.egyptWithoutGovernorate > 0) {
      rows.push({ key: NO_GOVERNORATE_KEY, name: this.t('geo.noGovernorate'), icon: 'fa-solid fa-circle-question', count: d.egyptWithoutGovernorate, percentage: share(d.egyptWithoutGovernorate, egyptCount), bucket: true });
    }
    return rows;
  });

  protected readonly selectedKey = computed(() => {
    const s = this.selection();
    if (!s) return null;
    switch (s.kind) {
      case 'country': return countryKey(s.country);
      case 'governorate': return governorateKey(s.governorate);
      case 'unknown': return UNKNOWN_KEY;
      case 'egyptNoGovernorate': return NO_GOVERNORATE_KEY;
    }
  });

  /** Scope the page should fetch for pins — derived from the level + pin mode. */
  protected readonly pinScope = computed<PinScope | null>(() => {
    if (this.level() !== 'egypt' || !this.enablePins()) return null;
    const mode = this.pinMode();
    if (mode === null) return null;
    return mode === 'all' ? { kind: 'allEgypt' } : { kind: 'governorate', governorateId: mode };
  });

  protected readonly tooltipFor = (key: string): string => this.tooltipHtml(key);

  protected readonly mapAria = computed(() =>
    interpolate(this.t(this.level() === 'world' ? 'geo.map.worldAria' : 'geo.map.egyptAria'), {
      n: this.levelRegions().length,
      unit: this.t(this.labels().unitKey),
    }),
  );

  constructor() {
    this.boundariesApi.boundaries('world').pipe(takeUntilDestroyed()).subscribe((g) => this.worldGeo.set(g));

    // Theme / brand colour changed → re-read the tokens after the DOM attributes update.
    effect(() => {
      this.theme.mode();
      this.theme.color();
      untracked(() => requestAnimationFrame(() => this.palette.set(readMapPalette(this.doc, 5))));
    });

    // Fresh numbers: keep the open panel in sync (or close it if the region emptied).
    effect(() => {
      const d = this.data();
      if (d) untracked(() => this.refreshSelection(d));
    });

    // Tell the page which records to load for pins whenever the scope changes.
    effect(() => {
      const scope = this.pinScope();
      untracked(() => this.pinScopeChange.emit(scope));
    });
  }

  // ─────────── interaction ───────────

  protected onRegion(key: string): void {
    const d = this.data();
    if (!d) return;
    if (key === UNKNOWN_KEY) {
      this.selection.set({ kind: 'unknown', count: d.unknown, byStatus: d.unknownByStatus });
      return;
    }
    if (key === NO_GOVERNORATE_KEY) {
      this.selection.set({ kind: 'egyptNoGovernorate', count: d.egyptWithoutGovernorate });
      return;
    }
    if (this.level() === 'world') {
      const country = d.countries.find((c) => countryKey(c) === key);
      if (!country) return;
      if (key === EGYPT_ISO2) this.drillIntoEgypt();
      else this.selection.set({ kind: 'country', country });
      return;
    }
    const governorate = d.governorates.find((g) => governorateKey(g) === key);
    if (governorate) {
      this.selection.set({ kind: 'governorate', governorate });
      // Clicking a governorate also drops its customers as pins.
      if (this.enablePins()) this.pinMode.set(governorate.governorateId);
    }
  }

  /** Show every located Egyptian customer as pins (the "all governorates" action). */
  protected showAllPins(): void {
    this.selection.set(null);
    this.pinMode.set('all');
  }

  /** Turn pins off and return to the plain choropleth. */
  protected clearPins(): void {
    this.pinMode.set(null);
  }

  protected drillIntoEgypt(): void {
    this.selection.set(null);
    this.pinMode.set(null);
    this.level.set('egypt');
    this.levelChange.emit('egypt');
    if (this.egyptGeo() === undefined) {
      this.boundariesApi.boundaries('egypt').pipe(takeUntilDestroyed(this.destroyRef)).subscribe((g) => this.egyptGeo.set(g));
    }
  }

  protected backToWorld(): void {
    this.selection.set(null);
    this.pinMode.set(null);
    this.level.set('world');
    this.levelChange.emit('world');
  }

  protected openEgyptPanel(): void {
    const egypt = this.egypt();
    if (egypt) this.selection.set({ kind: 'country', country: egypt });
  }

  protected onPoint(id: number): void {
    this.pointSelect.emit(id);
  }

  protected openUnknown(): void {
    this.onRegion(UNKNOWN_KEY);
  }

  protected openNoGovernorate(): void {
    this.onRegion(NO_GOVERNORATE_KEY);
  }

  // ─────────── helpers ───────────

  private refreshSelection(d: GeoAggregate): void {
    const s = this.selection();
    if (!s) return;
    switch (s.kind) {
      case 'country': {
        const c = d.countries.find((x) => x.countryId === s.country.countryId);
        this.selection.set(c ? { kind: 'country', country: c } : null);
        break;
      }
      case 'governorate': {
        const g = d.governorates.find((x) => x.governorateId === s.governorate.governorateId);
        this.selection.set(g ? { kind: 'governorate', governorate: g } : null);
        break;
      }
      case 'unknown':
        this.selection.set(d.unknown ? { kind: 'unknown', count: d.unknown, byStatus: d.unknownByStatus } : null);
        break;
      case 'egyptNoGovernorate':
        this.selection.set(d.egyptWithoutGovernorate ? { kind: 'egyptNoGovernorate', count: d.egyptWithoutGovernorate } : null);
        break;
    }
  }

  private colorFor(count: number): string {
    const p = this.palette();
    const i = bucketIndex(count, this.buckets());
    return i < 0 || !p ? p?.empty ?? 'transparent' : this.steps()[i] ?? p.steps[p.steps.length - 1];
  }

  private tooltipHtml(key: string): string {
    const d = this.data();
    if (!d) return '';
    const lang = this.lang();
    const fmt = (n: number) => n.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US');
    const dir = this.language.isRtl() ? 'rtl' : 'ltr';
    const labels = this.labels();

    let name = key;
    let count = 0;
    let pct: number | null = null;
    let inferred = 0;
    let byStatus: StatusCount[] = [];

    if (this.level() === 'world') {
      const c = d.countries.find((x) => countryKey(x) === key);
      const feature = this.worldGeo()?.features.find((f) => f.properties.name === key);
      name = c?.name ?? String((lang === 'ar' ? feature?.properties['ar'] : feature?.properties['en']) ?? key);
      if (c) ({ count, percentage: pct, inferredCount: inferred, byStatus } = c);
    } else {
      const g = d.governorates.find((x) => governorateKey(x) === key);
      name = g ? (lang === 'en' ? g.nameEn || g.name : g.name) : key;
      if (g) ({ count, percentage: pct, byStatus } = g);
    }

    const sts = byStatus
      .map((s) => `<div class="gx-tip__st"><span>${escapeHtml(labels.statusLabel(s.status))}</span><b>${fmt(s.count)}</b></div>`)
      .join('');
    const pctLabel = this.t(this.level() === 'world' ? 'geo.tooltip.ofTotal' : 'geo.tooltip.ofEgypt');
    const hint = this.level() === 'world' && key === EGYPT_ISO2 ? 'geo.tooltip.clickEgypt' : 'geo.tooltip.click';
    return `
      <div class="gx-tip" dir="${dir}">
        <div class="gx-tip__name">${escapeHtml(name)}</div>
        <div class="gx-tip__count">${fmt(count)} <span>${escapeHtml(this.t(labels.unitKey))}</span></div>
        ${count && pct !== null ? `<div class="gx-tip__meta">${fmt(pct)}% ${escapeHtml(pctLabel)}</div>` : ''}
        ${inferred ? `<div class="gx-tip__meta">${escapeHtml(interpolate(this.t('geo.tooltip.inferred'), { n: fmt(inferred) }))}</div>` : ''}
        ${sts ? `<div class="gx-tip__sts">${sts}</div>` : ''}
        ${count ? `<div class="gx-tip__hint">${escapeHtml(this.t(hint))}</div>` : ''}
      </div>`;
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
