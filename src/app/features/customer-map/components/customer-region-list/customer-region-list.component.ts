import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, catchError, map, of, switchMap } from 'rxjs';
import { LanguageService } from '../../../../core/services/language.service';
import { CustomerLocationComponent } from '../../../../shared/components/customer-location/customer-location.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { CustomerListItem, CustomerListQuery } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { RegionFilter } from '../../../geo-insights';
import { CustomerDetailsDialogComponent } from '../../../leads/components/customer-details-dialog/customer-details-dialog.component';
import { CustomersService } from '../../../leads/services/customers.service';
import { customerStatusBadgeClass, resolveCustomerStatus } from '../../../leads/utils/customer-status.util';
import { CustomerMapQuery } from '../../models/customer-map.models';

const PAGE_SIZE = 8;

type Load = { ok: true; rows: CustomerListItem[]; count: number } | { ok: false };

/**
 * The selected region's customers (`getSalesCustomers?countryId=&governorateId=`,
 * paged) inside the map's side panel. The list endpoint has no campaign /
 * service / date / rep filters, so it says so instead of silently disagreeing
 * with the map's totals.
 */
@Component({
  selector: 'app-customer-region-list',
  standalone: true,
  imports: [DecimalPipe, RouterLink, TranslatePipe, PaginationComponent, CustomerLocationComponent, CustomerDetailsDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-region-list.component.html',
  styleUrl: './customer-region-list.component.scss',
})
export class CustomerRegionListComponent {
  private readonly customers = inject(CustomersService);
  private readonly language = inject(LanguageService);

  readonly region = input.required<RegionFilter>();
  readonly mapQuery = input<CustomerMapQuery>({});
  /** Country rows show the governorate; others show nothing extra. */
  readonly showGovernorate = input(false);

  protected readonly pageIndex = signal(1);
  protected readonly pageSize = PAGE_SIZE;
  protected readonly rows = signal<CustomerListItem[]>([]);
  protected readonly count = signal(0);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly detailsId = signal<number | null>(null);

  protected readonly unsupportedFilters = computed(() => {
    const q = this.mapQuery();
    return !!(q.campaignId || q.serviceId || q.from || q.to || q.salesPersonId);
  });

  private readonly requests = new Subject<CustomerListQuery>();

  constructor() {
    this.requests
      .pipe(
        switchMap((query) =>
          this.customers.listForSales(query).pipe(
            map((page): Load => ({ ok: true, rows: page.data ?? [], count: page.count ?? 0 })),
            catchError(() => of<Load>({ ok: false })),
          ),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((res) => {
        this.loading.set(false);
        this.failed.set(!res.ok);
        if (res.ok) {
          this.rows.set(res.rows);
          this.count.set(res.count);
        }
      });

    effect(() => {
      this.region();
      this.mapQuery();
      untracked(() => {
        this.pageIndex.set(1);
        this.load();
      });
    });
  }

  protected load(): void {
    const r = this.region();
    const q = this.mapQuery();
    this.loading.set(true);
    this.failed.set(false);
    this.requests.next({
      PageIndex: this.pageIndex(),
      PageSize: PAGE_SIZE,
      CountryId: r.countryId,
      GovernorateId: r.governorateId,
      CustomerStatusId: q.customerStatusId ?? undefined,
      SourceId: q.sourceId ?? undefined,
    });
  }

  protected onPage(page: number): void {
    this.pageIndex.set(page);
    this.load();
  }

  protected statusLabel(raw: string): string {
    return resolveCustomerStatus(raw, this.language.lang(), raw);
  }

  protected statusClass(raw: string): string {
    return customerStatusBadgeClass(raw);
  }
}
