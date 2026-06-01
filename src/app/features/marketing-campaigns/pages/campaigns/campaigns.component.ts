import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import {
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUS_CODE,
  Campaign,
  CampaignStatus,
  CampaignsStatistics,
  ChannelSource,
} from '../../../../shared/models';
import { MoneyPipe } from '../../../../shared/pipes/money.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CampaignCardComponent } from '../../components/campaign-card/campaign-card.component';
import { CampaignDetailsDialogComponent } from '../../components/campaign-details-dialog/campaign-details-dialog.component';
import { CampaignFormDialogComponent } from '../../components/campaign-form-dialog/campaign-form-dialog.component';
import { CampaignsService } from '../../services/campaigns.service';
import { ChannelSourcesService } from '../../services/channel-sources.service';

type StatusFilter = 'all' | CampaignStatus;
type ChannelFilter = 'all' | number;

const DEFAULT_PAGE_SIZE = 10;

@Component({
  selector: 'app-campaigns',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    MoneyPipe,
    EmptyStateComponent,
    LoadErrorComponent,
    StatCardComponent,
    CampaignCardComponent,
    CampaignFormDialogComponent,
    CampaignDetailsDialogComponent,
    PaginationComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './campaigns.component.html',
  styleUrl: './campaigns.component.scss',
})
export class CampaignsComponent {
  private readonly campaigns = inject(CampaignsService);
  private readonly sources = inject(ChannelSourcesService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(DialogService);
  private readonly language = inject(LanguageService);

  readonly statuses: ReadonlyArray<CampaignStatus> = CAMPAIGN_STATUSES;

  /** Current page rows. */
  readonly all = signal<Campaign[]>([]);
  readonly channelSources = signal<ChannelSource[]>([]);
  readonly stats = signal<CampaignsStatistics | null>(null);
  readonly statsLoading = signal(false);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  /** Per-row spinner — disables card actions while a mutation is in-flight. */
  readonly busyId = signal<number | null>(null);

  // ─── filters (server-side) ───
  searchTerm = '';
  readonly searchSignal = signal('');
  readonly statusFilter = signal<StatusFilter>('all');
  readonly channelFilter = signal<ChannelFilter>('all');

  // ─── pagination ───
  readonly pageIndex = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly totalCount = signal(0);

  readonly formOpen = signal(false);
  /** When set, the form dialog renders in edit mode for this campaign. */
  readonly editTarget = signal<Campaign | null>(null);
  readonly detailsId = signal<number | null>(null);

  /**
   * KPI summary — prefers values from the dashboard statistics endpoint and
   * falls back to client-side aggregation when a field is missing. This keeps
   * the page resilient if the backend trims its response.
   */
  readonly kpis = computed(() => {
    const stats = this.stats();
    const list = this.all();
    const clientTotalBudget = list.reduce((s, c) => s + (c.budget ?? 0), 0);
    const clientActive = list.filter((c) => c.status === 'Active').length;

    const num = (v: number | string | null | undefined): number => {
      const n = typeof v === 'string' ? Number(v) : v;
      return typeof n === 'number' && Number.isFinite(n) ? n : 0;
    };

    return {
      totalBudget: num(stats?.totalBudget) || clientTotalBudget,
      totalSpent: num(stats?.totalSpent),
      activeCampaigns: num(stats?.activeCampaigns) || clientActive,
      totalConversions: num(stats?.totalConversions),
      totalCampaigns: num(stats?.totalCampaigns) || this.totalCount(),
    };
  });

  // Debounced search → server query.
  private readonly searchInput$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => {
        this.searchSignal.set(term);
        this.pageIndex.set(1);
        this.reload();
      });
    this.reload();
    this.loadChannelSources();
    this.loadStats();
  }

  loadStats(): void {
    this.statsLoading.set(true);
    this.campaigns.statistics().subscribe({
      next: (s) => {
        this.stats.set(s);
        this.statsLoading.set(false);
      },
      error: () => this.statsLoading.set(false),
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─────────── data loading ───────────

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);

    const status = this.statusFilter();
    const channel = this.channelFilter();
    this.campaigns
      .list({
        pageIndex: this.pageIndex(),
        pageSize: this.pageSize(),
        search: this.searchSignal().trim() || undefined,
        status: status !== 'all' ? CAMPAIGN_STATUS_CODE[status] : undefined,
        channelSourceId: channel !== 'all' ? Number(channel) : undefined,
      })
      .subscribe({
        next: (res) => {
          this.all.set(res.data ?? []);
          this.totalCount.set(res.count ?? 0);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadError.set(this.t('campaigns.messages.loadFailed'));
        },
      });
  }

  loadChannelSources(): void {
    this.sources.list().subscribe({
      next: (rows) => this.channelSources.set(rows ?? []),
    });
  }

  // ─────────── filters / pagination ───────────

  onSearchInput(value: string): void {
    this.searchTerm = value;
    this.searchInput$.next(value);
  }

  onStatusFilterChange(value: StatusFilter): void {
    this.statusFilter.set(value);
    this.pageIndex.set(1);
    this.reload();
  }

  onChannelFilterChange(value: ChannelFilter | string): void {
    if (value === 'all' || value === '') {
      this.channelFilter.set('all');
    } else {
      const id = Number(value);
      this.channelFilter.set(Number.isFinite(id) ? id : 'all');
    }
    this.pageIndex.set(1);
    this.reload();
  }

  onPageChange(page: number): void {
    this.pageIndex.set(page);
    this.reload();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.pageIndex.set(1);
    this.reload();
  }

  // ─────────── create / edit dialog ───────────

  openCreate(): void {
    this.editTarget.set(null);
    this.formOpen.set(true);
  }

  openEdit(campaign: Campaign): void {
    this.editTarget.set(campaign);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.editTarget.set(null);
  }

  /** Legacy alias kept for the template binding. */
  closeCreate(): void {
    this.closeForm();
  }

  onCreated(): void {
    this.closeForm();
    this.loadChannelSources();
    this.loadStats();
    this.reload();
  }

  onUpdated(): void {
    this.closeForm();
    this.loadStats();
    this.reload();
  }

  // ─────────── details dialog ───────────

  openDetails(campaign: Campaign): void {
    this.detailsId.set(campaign.id);
  }

  closeDetails(): void {
    this.detailsId.set(null);
  }

  // ─────────── row actions ───────────

  async toggleStatus(campaign: Campaign): Promise<void> {
    if (this.busyId() === campaign.id) return;

    const isActive = campaign.status === 'Active';
    const ok = await this.dialog.confirm({
      title: this.t(
        isActive
          ? 'campaigns.toggleDialog.pauseTitle'
          : 'campaigns.toggleDialog.resumeTitle',
      ),
      message: this.t(
        isActive
          ? 'campaigns.toggleDialog.pauseMessage'
          : 'campaigns.toggleDialog.resumeMessage',
      ),
      confirmText: this.t(
        isActive
          ? 'campaigns.toggleDialog.pauseConfirm'
          : 'campaigns.toggleDialog.resumeConfirm',
      ),
      cancelText: this.t('campaigns.toggleDialog.cancel'),
      type: isActive ? 'warning' : 'info',
    });
    if (!ok) return;

    this.busyId.set(campaign.id);
    this.campaigns.toggleStatus(campaign.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(
          isActive
            ? this.t('campaigns.messages.paused')
            : this.t('campaigns.messages.resumed'),
        );
        this.reload();
      },
      error: (err: ApiError) => {
        this.busyId.set(null);
        if (err?.message) this.toast.error(err.message);
      },
    });
  }

  async confirmDelete(campaign: Campaign): Promise<void> {
    const ok = await this.dialog.confirm({
      title: this.t('campaigns.deleteDialog.title'),
      message: this.t('campaigns.deleteDialog.message'),
      confirmText: this.t('campaigns.deleteDialog.confirm'),
      cancelText: this.t('campaigns.deleteDialog.cancel'),
      type: 'danger',
    });
    if (!ok) return;

    this.busyId.set(campaign.id);
    this.campaigns.delete(campaign.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(this.t('campaigns.messages.deleted'));
        // If the page goes empty after a delete, fall back one page.
        if (this.all().length === 1 && this.pageIndex() > 1) {
          this.pageIndex.update((p) => p - 1);
        }
        this.reload();
      },
      error: (err: ApiError) => {
        this.busyId.set(null);
        if (err?.message) this.toast.error(err.message);
      },
    });
  }

  // ─────────── helpers ───────────

  formatNumber(n: number): string {
    return n.toLocaleString(this.language.lang() === 'ar' ? 'ar-EG' : 'en-US');
  }

  trackById = (_: number, c: Campaign) => c.id;

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
