import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LanguageService } from '../../../../core/services/language.service';
import { AppService, CampaignDropdownItem, CustomerStatus, SalesPerson } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CustomersService } from '../../../leads/services/customers.service';
import { resolveCustomerStatus } from '../../../leads/utils/customer-status.util';
import { ChannelSourcesService } from '../../../marketing-campaigns/services/channel-sources.service';
import { ServicesService } from '../../../services/services/services.service';
import { toIsoDay } from '../../../geo-insights';
import { CustomerMapQuery } from '../../models/customer-map.models';

/** `custom` = dates typed by hand (no chip highlighted). */
type DatePreset = '30d' | '90d' | 'year' | 'all' | 'custom';

interface Option {
  id: number | string;
  label: string;
}

/**
 * The map's filter row (status, source, campaign, service, sales rep for
 * Admin, creation-date range with quick presets). Emits the full query on
 * every change; the page debounces and fetches. A dropdown that fails to
 * load just stays empty — the map still works without it.
 */
@Component({
  selector: 'app-map-filters',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './map-filters.component.html',
  styleUrl: './map-filters.component.scss',
})
export class MapFiltersComponent implements OnInit {
  private readonly customers = inject(CustomersService);
  private readonly sourcesApi = inject(ChannelSourcesService);
  private readonly servicesApi = inject(ServicesService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  /** Sales-rep picker (Admin only — the backend ignores it for Sales). */
  readonly showSalesPerson = input(false);
  readonly queryChange = output<CustomerMapQuery>();

  protected readonly statuses = signal<Option[]>([]);
  protected readonly sources = signal<Option[]>([]);
  protected readonly campaigns = signal<Option[]>([]);
  protected readonly services = signal<Option[]>([]);
  protected readonly salesTeam = signal<Option[]>([]);

  protected readonly statusId = signal<number | null>(null);
  protected readonly sourceId = signal<number | null>(null);
  protected readonly campaignId = signal<number | null>(null);
  protected readonly serviceId = signal<number | null>(null);
  protected readonly salesPersonId = signal<string | null>(null);
  protected readonly from = signal<string>('');
  protected readonly to = signal<string>('');
  protected readonly preset = signal<DatePreset>('all');

  protected readonly presets: readonly Exclude<DatePreset, 'custom'>[] = ['30d', '90d', 'year', 'all'];
  protected readonly today = toIsoDay(new Date()) ?? '';

  protected readonly activeCount = computed(
    () =>
      [this.statusId(), this.sourceId(), this.campaignId(), this.serviceId(), this.salesPersonId()].filter(
        (v) => v !== null,
      ).length + (this.from() || this.to() ? 1 : 0),
  );

  ngOnInit(): void {
    const keep = <T>(fn: (rows: T) => void) => ({ next: fn, error: () => undefined });
    const lang = this.language.lang();

    this.customers.statuses().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(
      keep((rows: CustomerStatus[]) =>
        this.statuses.set(rows.map((s) => ({ id: s.id, label: resolveCustomerStatus(s.name, lang, s.name) }))),
      ),
    );
    this.sourcesApi.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(
      keep((rows: { id: number; name: string }[]) => this.sources.set(rows.map((s) => ({ id: s.id, label: s.name })))),
    );
    this.customers.campaignsDropdown().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(
      keep((rows: CampaignDropdownItem[]) => this.campaigns.set(rows.map((c) => ({ id: c.id, label: c.name })))),
    );
    this.servicesApi.list({ pageSize: 100 }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(
      keep((page: { data?: AppService[] }) =>
        this.services.set((page.data ?? []).map((s) => ({ id: s.id, label: lang === 'en' ? s.nameEn : s.nameAr }))),
      ),
    );
    if (this.showSalesPerson()) {
      this.customers.salesTeam().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(
        keep((rows: SalesPerson[]) =>
          this.salesTeam.set(
            [...rows].sort((a, b) => a.fullName.localeCompare(b.fullName)).map((p) => ({ id: p.userId, label: p.fullName })),
          ),
        ),
      );
    }
  }

  protected setNumber(target: 'statusId' | 'sourceId' | 'campaignId' | 'serviceId', raw: string): void {
    this[target].set(raw === '' || raw == null ? null : Number(raw));
    this.emit();
  }

  protected setSalesPerson(raw: string): void {
    this.salesPersonId.set(raw || null);
    this.emit();
  }

  protected setDate(which: 'from' | 'to', value: string): void {
    this[which].set(value ?? '');
    this.preset.set(this.from() || this.to() ? 'custom' : 'all');
    this.emit();
  }

  protected applyPreset(preset: DatePreset): void {
    this.preset.set(preset);
    const now = new Date();
    const start =
      preset === '30d'
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)
        : preset === '90d'
          ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89)
          : preset === 'year'
            ? new Date(now.getFullYear(), 0, 1)
            : null;
    this.from.set(start ? toIsoDay(start) ?? '' : '');
    this.to.set(start ? this.today : '');
    this.emit();
  }

  protected reset(): void {
    this.statusId.set(null);
    this.sourceId.set(null);
    this.campaignId.set(null);
    this.serviceId.set(null);
    this.salesPersonId.set(null);
    this.from.set('');
    this.to.set('');
    this.preset.set('all');
    this.emit();
  }

  private emit(): void {
    this.queryChange.emit({
      customerStatusId: this.statusId(),
      sourceId: this.sourceId(),
      campaignId: this.campaignId(),
      serviceId: this.serviceId(),
      salesPersonId: this.showSalesPerson() ? this.salesPersonId() : null,
      from: this.from() || null,
      to: this.to() || null,
    });
  }
}
