import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, map, of, switchMap, tap } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { LanguageService } from '../../../../core/services/language.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  GeoAggregate,
  GeoExplorerComponent,
  GeoPointInput,
  GeoUnitLabels,
  MapSelection,
  PinScope,
  RegionPanelComponent,
  regionFilterOf,
  share,
} from '../../../geo-insights';
import { CustomerDetailsDialogComponent } from '../../../leads/components/customer-details-dialog/customer-details-dialog.component';
import { resolveCustomerStatus } from '../../../leads/utils/customer-status.util';
import { CustomerRegionListComponent } from '../../components/customer-region-list/customer-region-list.component';
import { MapFiltersComponent } from '../../components/map-filters/map-filters.component';
import { CustomerMapQuery } from '../../models/customer-map.models';
import { CustomerMapService } from '../../services/customer-map.service';
import { CustomerPinsService } from '../../services/customer-pins.service';

const FILTER_DEBOUNCE_MS = 300;

type Load = { ok: true; data: GeoAggregate } | { ok: false };

/**
 * `/customers/map` (Admin, Sales — Sales sees only their own customers).
 * Filters → `GET /Customers/map` (debounced; each request supersedes the
 * previous one) → KPIs + the shared geo explorer → a region's panel lists
 * its customers.
 */
@Component({
  selector: 'app-customer-map',
  standalone: true,
  imports: [
    DecimalPipe,
    TranslatePipe,
    PageHeaderComponent,
    StatCardComponent,
    MapFiltersComponent,
    GeoExplorerComponent,
    RegionPanelComponent,
    CustomerRegionListComponent,
    CustomerDetailsDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-map.component.html',
  styleUrl: './customer-map.component.scss',
})
export class CustomerMapComponent {
  private readonly service = inject(CustomerMapService);
  private readonly pinsService = inject(CustomerPinsService);
  private readonly auth = inject(AuthService);
  private readonly language = inject(LanguageService);

  protected readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');

  protected readonly query = signal<CustomerMapQuery>({});
  protected readonly data = signal<GeoAggregate | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly selection = signal<MapSelection | null>(null);
  private readonly fetch$ = new Subject<{ query: CustomerMapQuery; debounce: boolean }>();

  /** Customer pins for the current scope + whether they're still loading. */
  protected readonly pins = signal<GeoPointInput[]>([]);
  protected readonly pinsLoading = signal(false);
  /** Customer opened from a pin (details dialog). */
  protected readonly pinCustomerId = signal<number | null>(null);
  private readonly pinScope$ = new Subject<PinScope | null>();
  private lastPinScope: PinScope | null = null;

  /** Governorate id → centroid, for projecting customers onto the map. */
  private readonly centroids = computed(() => {
    const map = new Map<number, { lat: number; lng: number; name: string; nameEn: string }>();
    for (const g of this.data()?.governorates ?? []) {
      map.set(g.governorateId, { lat: g.lat, lng: g.lng, name: g.name, nameEn: g.nameEn });
    }
    return map;
  });

  protected readonly labels: GeoUnitLabels = {
    unitKey: 'customerMap.unit',
    statusLabel: (status) => resolveCustomerStatus(status, this.language.lang(), status),
  };

  protected readonly kpis = computed(() => {
    const d = this.data();
    return {
      total: d?.total ?? 0,
      countries: d?.countriesCount ?? 0,
      unknown: d?.unknown ?? 0,
      located: d ? share(d.located, d.total) : 0,
    };
  });

  protected readonly regionFilter = computed(() => {
    const s = this.selection();
    return s ? regionFilterOf(s) : null;
  });

  constructor() {
    // Filter changes wait 300 ms (a newer change cancels the wait and any
    // request in flight); the first load and Retry go out immediately.
    this.fetch$
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(({ query, debounce }) =>
          (debounce ? of(query).pipe(debounceTime(FILTER_DEBOUNCE_MS)) : of(query)).pipe(
            switchMap((q) =>
              this.service.load(q).pipe(
                map((data): Load => ({ ok: true, data })),
                catchError(() => of<Load>({ ok: false })),
              ),
            ),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((res) => {
        this.loading.set(false);
        this.failed.set(!res.ok);
        if (res.ok) this.data.set(res.data);
      });

    // Pin scope changed → load every customer in it (latest scope wins).
    this.pinScope$
      .pipe(
        tap((scope) => {
          if (!scope) this.pins.set([]);
          this.pinsLoading.set(!!scope);
        }),
        switchMap((scope) => {
          if (!scope) return of<GeoPointInput[]>([]);
          const gid = scope.kind === 'governorate' ? scope.governorateId : null;
          return this.pinsService.load(gid, this.centroids(), this.query()).pipe(
            catchError(() => of<GeoPointInput[]>([])),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((points) => {
        this.pinsLoading.set(false);
        this.pins.set(points);
      });

    this.fetch$.next({ query: this.query(), debounce: false });
  }

  protected onPinScope(scope: PinScope | null): void {
    this.lastPinScope = scope;
    this.pinScope$.next(scope);
  }

  protected onPinSelect(id: number): void {
    this.pinCustomerId.set(id);
  }

  protected onFilters(query: CustomerMapQuery): void {
    this.query.set(query);
    this.fetch$.next({ query, debounce: true });
    // Keep active pins consistent with the new filters.
    if (this.lastPinScope) this.pinScope$.next(this.lastPinScope);
  }

  protected retry(): void {
    this.fetch$.next({ query: this.query(), debounce: false });
  }

  protected openUnknown(): void {
    const d = this.data();
    if (d?.unknown) this.selection.set({ kind: 'unknown', count: d.unknown, byStatus: d.unknownByStatus });
  }
}
