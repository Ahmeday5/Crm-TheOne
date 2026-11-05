import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { AuthService } from '../../../../core/services/auth.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { ClampTextDirective } from '../../../../shared/directives/clamp-text.directive';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { SalesPerson } from '../../../../shared/models';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ChannelSourcesService } from '../../../marketing-campaigns/services/channel-sources.service';
import { ServicesService } from '../../../services/services/services.service';
import { ChangeStatusDialogComponent } from '../../components/change-status-dialog/change-status-dialog.component';
import {
  CustomerDetailsDialogComponent,
  CustomerDetailsTab,
} from '../../components/customer-details-dialog/customer-details-dialog.component';
import {
  SalesPipeline,
  SalesPipelineCard,
  SalesPipelineColumn,
  SalesPipelineQuery,
  SalesPipelineSort,
} from '../../models/sales-pipeline.model';
import { CustomersService } from '../../services/customers.service';
import { SalesPipelineService } from '../../services/sales-pipeline.service';
import { customerStatusKey, resolveCustomerStatus } from '../../utils/customer-status.util';

/** Cards each column loads per request (first load and every "load more"). */
const PER_COLUMN = 20;

type ColumnTone = 'brand' | 'warning' | 'success' | 'danger' | 'muted';

interface ColumnLook {
  tone: ColumnTone;
  icon: string;
}

interface Option<T> {
  id: T;
  name: string;
}

@Component({
  selector: 'app-sales-pipeline',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslatePipe,
    CairoDatePipe,
    StatCardComponent,
    LoadErrorComponent,
    EmptyStateComponent,
    TipDirective,
    ClampTextDirective,
    ChangeStatusDialogComponent,
    CustomerDetailsDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sales-pipeline.component.html',
  styleUrl: './sales-pipeline.component.scss',
})
export class SalesPipelineComponent implements OnInit, OnDestroy {
  private readonly pipelineApi = inject(SalesPipelineService);
  private readonly customers = inject(CustomersService);
  private readonly channelSources = inject(ChannelSourcesService);
  private readonly servicesApi = inject(ServicesService);
  private readonly language = inject(LanguageService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly sortOptions: SalesPipelineSort[] = ['Newest', 'Oldest', 'StageAge', 'NextFollowUp'];
  /** `null` = let the backend use its own default threshold. */
  readonly staleOptions: (number | null)[] = [null, 3, 7, 14, 30];

  // ─────────── filters ───────────
  searchTerm = '';
  private readonly searchInput$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  private loadSub?: Subscription;

  readonly search = signal('');
  readonly sourceId = signal<number | null>(null);
  readonly serviceId = signal<number | null>(null);
  readonly salesPersonId = signal<string | null>(null);
  readonly overdueOnly = signal(false);
  readonly sort = signal<SalesPipelineSort>('Newest');
  readonly staleDays = signal<number | null>(null);

  // ─────────── dropdown data ───────────
  readonly sources = signal<Option<number>[]>([]);
  readonly services = signal<Option<number>[]>([]);
  readonly salesTeam = signal<Option<string>[]>([]);

  // ─────────── board data ───────────
  readonly board = signal<SalesPipeline | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  /** statusId of the column whose "load more" is in flight. */
  readonly loadingMore = signal<number | null>(null);

  // ─────────── drag & drop ───────────
  readonly dragging = signal<SalesPipelineCard | null>(null);
  readonly dropTarget = signal<number | null>(null);
  /** Card ids whose status change is still being saved. */
  readonly savingIds = signal<ReadonlySet<number>>(new Set());

  // ─────────── dialogs ───────────
  readonly detailsDialog = signal<number | null>(null);
  readonly detailsTab = signal<CustomerDetailsTab>('details');
  /** `preset` = status pre-selected in the dialog (the drop target, or the card's own). */
  readonly changeStatusDialog = signal<{ card: SalesPipelineCard; preset: string } | null>(null);

  /** Only admins see the whole team — a sales rep's board is already theirs. */
  readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');

  readonly stats = computed(() => this.board()?.stats ?? null);
  readonly columns = computed(() => this.board()?.columns ?? []);
  readonly overdueCount = computed(() => this.board()?.overdueFollowUps ?? 0);

  readonly loadedCount = computed(() =>
    this.columns().reduce((sum, c) => sum + c.items.length, 0),
  );
  readonly totalCount = computed(() =>
    this.columns().reduce((sum, c) => sum + c.count, 0),
  );
  readonly isPartial = computed(() => this.columns().some((c) => c.hasMore));

  readonly hasFilters = computed(
    () =>
      !!this.search() ||
      this.sourceId() !== null ||
      this.serviceId() !== null ||
      this.salesPersonId() !== null ||
      this.overdueOnly(),
  );

  ngOnInit(): void {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => {
        this.search.set(term.trim());
        this.reload();
      });

    this.loadFilters();
    this.reload();
  }

  ngOnDestroy(): void {
    this.loadSub?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─────────── data loading ───────────

  private loadFilters(): void {
    this.channelSources.list().subscribe({
      next: (items: Option<number>[]) => this.sources.set(items ?? []),
    });
    this.servicesApi.list({ pageSize: 100 }).subscribe({
      next: (page) =>
        this.services.set(
          (page.data ?? []).map((s) => ({
            id: s.id,
            name: this.language.lang() === 'ar' ? s.nameAr || s.nameEn : s.nameEn || s.nameAr,
          })),
        ),
    });
    if (this.isAdmin()) {
      this.customers.salesTeam().subscribe({
        next: (team: SalesPerson[]) =>
          this.salesTeam.set((team ?? []).map((p) => ({ id: p.userId, name: p.fullName }))),
      });
    }
  }

  private baseQuery(): SalesPipelineQuery {
    return {
      Search: this.search() || undefined,
      SourceId: this.sourceId() ?? undefined,
      ServiceId: this.serviceId() ?? undefined,
      SalesPersonId: this.salesPersonId() ?? undefined,
      OverdueOnly: this.overdueOnly() || undefined,
      Sort: this.sort(),
      StaleDays: this.staleDays() ?? undefined,
      PerColumn: PER_COLUMN,
    };
  }

  /**
   * Loads the whole board. `quiet` keeps the current cards on screen (used
   * after a drag, so the counts/stats catch up without a spinner flash).
   */
  reload(force = false, quiet = false): void {
    this.loadSub?.unsubscribe();
    if (!quiet) this.loading.set(true);
    this.loadError.set(null);
    this.loadSub = this.pipelineApi.board(this.baseQuery(), force, quiet).subscribe({
      next: (data) => {
        this.board.set(this.normalize(data));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        if (!quiet || !this.board()) this.loadError.set(this.t('pipeline.messages.loadFailed'));
      },
    });
  }

  /** Next page of one column: same filters + `Status` + `Skip`. */
  loadMore(column: SalesPipelineColumn): void {
    if (this.loadingMore() !== null) return;
    this.loadingMore.set(column.statusId);
    this.pipelineApi
      .board(
        { ...this.baseQuery(), Status: column.statusId, Skip: column.items.length },
        false,
        true,
      )
      .subscribe({
        next: (data) => {
          const fresh = data?.columns?.find((c) => c.statusId === column.statusId);
          if (fresh) {
            this.patchColumn(column.statusId, (col) => {
              const known = new Set(col.items.map((i) => i.id));
              const items = [...col.items, ...fresh.items.filter((i) => !known.has(i.id))];
              return { ...col, items, hasMore: fresh.hasMore && items.length < col.count };
            });
          }
          this.loadingMore.set(null);
        },
        error: () => {
          this.loadingMore.set(null);
          this.toast.error(this.t('pipeline.messages.loadFailed'));
        },
      });
  }

  /** Keeps the column order fixed and the payload defensive. */
  private normalize(data: SalesPipeline | null): SalesPipeline | null {
    if (!data) return null;
    const columns = [...(data.columns ?? [])]
      .map((c) => ({ ...c, items: c.items ?? [] }))
      .sort((a, b) => a.statusId - b.statusId);
    return { ...data, columns };
  }

  private patchColumn(
    statusId: number,
    fn: (col: SalesPipelineColumn) => SalesPipelineColumn,
  ): void {
    this.board.update((b) =>
      b ? { ...b, columns: b.columns.map((c) => (c.statusId === statusId ? fn(c) : c)) } : b,
    );
  }

  // ─────────── filter handlers ───────────

  onSearchInput(value: string): void {
    this.searchTerm = value;
    this.searchInput$.next(value);
  }

  onSourceChange(id: string): void {
    this.sourceId.set(id ? Number(id) : null);
    this.reload();
  }

  onServiceChange(id: string): void {
    this.serviceId.set(id ? Number(id) : null);
    this.reload();
  }

  onSalesPersonChange(id: string): void {
    this.salesPersonId.set(id || null);
    this.reload();
  }

  onSortChange(value: SalesPipelineSort): void {
    this.sort.set(value);
    this.reload();
  }

  onStaleDaysChange(value: string): void {
    this.staleDays.set(value ? Number(value) : null);
    this.reload();
  }

  toggleOverdue(): void {
    this.overdueOnly.update((v) => !v);
    this.reload();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.search.set('');
    this.sourceId.set(null);
    this.serviceId.set(null);
    this.salesPersonId.set(null);
    this.overdueOnly.set(false);
    this.reload();
  }

  // ─────────── drag & drop (native HTML5) ───────────

  onDragStart(event: DragEvent, card: SalesPipelineCard): void {
    if (this.savingIds().has(card.id)) {
      event.preventDefault();
      return;
    }
    event.dataTransfer?.setData('text/plain', String(card.id));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    this.dragging.set(card);
  }

  onDragEnd(): void {
    this.dragging.set(null);
    this.dropTarget.set(null);
  }

  onDragOver(event: DragEvent, column: SalesPipelineColumn): void {
    const card = this.dragging();
    if (!card || card.statusId === column.statusId) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dropTarget.set(column.statusId);
  }

  onDragLeave(event: DragEvent, column: SalesPipelineColumn): void {
    const next = event.relatedTarget as Node | null;
    const host = event.currentTarget as HTMLElement;
    if (next && host.contains(next)) return;
    if (this.dropTarget() === column.statusId) this.dropTarget.set(null);
  }

  onDrop(event: DragEvent, column: SalesPipelineColumn): void {
    event.preventDefault();
    const card = this.dragging();
    this.onDragEnd();
    if (!card || card.statusId === column.statusId) return;

    // "Not buyer" needs a reason → let the shared dialog collect it.
    if (customerStatusKey(column.status) === 'notBuyer') {
      this.changeStatusDialog.set({ card, preset: column.status });
      return;
    }
    this.moveCard(card, column);
  }

  /** Optimistic move, then save; on failure the board is reloaded. */
  private moveCard(card: SalesPipelineCard, target: SalesPipelineColumn): void {
    const moved: SalesPipelineCard = {
      ...card,
      statusId: target.statusId,
      status: target.status,
      daysInStage: 0,
      isStale: false,
      stageEnteredAt: new Date().toISOString(),
      notBuyingReason: null,
    };
    this.board.update((b) =>
      b
        ? {
            ...b,
            columns: b.columns.map((c) => {
              if (c.statusId === card.statusId) {
                return { ...c, count: Math.max(0, c.count - 1), items: c.items.filter((i) => i.id !== card.id) };
              }
              if (c.statusId === target.statusId) {
                return { ...c, count: c.count + 1, items: [moved, ...c.items] };
              }
              return c;
            }),
          }
        : b,
    );
    this.setSaving(card.id, true);

    this.customers.changeStatus(card.id, { status: target.status }).subscribe({
      next: () => {
        this.setSaving(card.id, false);
        this.toast.success(
          interpolate(this.t('pipeline.messages.moved'), {
            name: card.fullName,
            stage: this.columnLabel(target.status),
          }),
        );
        this.reload(true, true);
      },
      error: (err: ApiError) => {
        this.setSaving(card.id, false);
        this.toast.error(err?.message?.trim() || this.t('pipeline.messages.moveFailed'));
        this.reload(true, true);
      },
    });
  }

  private setSaving(id: number, on: boolean): void {
    this.savingIds.update((set) => {
      const next = new Set(set);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  // ─────────── dialogs ───────────

  openDetails(card: SalesPipelineCard, tab: CustomerDetailsTab = 'details'): void {
    this.detailsTab.set(tab);
    this.detailsDialog.set(card.id);
  }

  closeDetails(): void {
    this.detailsDialog.set(null);
  }

  openChangeStatus(card: SalesPipelineCard): void {
    this.changeStatusDialog.set({ card, preset: card.status });
  }

  closeChangeStatus(): void {
    this.changeStatusDialog.set(null);
  }

  onStatusChanged(): void {
    this.closeChangeStatus();
    this.reload(true, true);
  }

  // ─────────── view helpers ───────────

  columnLook(status: string): ColumnLook {
    switch (customerStatusKey(status)) {
      case 'new':
        return { tone: 'brand', icon: 'fa-solid fa-user-plus' };
      case 'negotiating':
        return { tone: 'warning', icon: 'fa-solid fa-handshake' };
      case 'buyer':
        return { tone: 'success', icon: 'fa-solid fa-circle-check' };
      case 'notBuyer':
        return { tone: 'danger', icon: 'fa-solid fa-circle-xmark' };
      default:
        return { tone: 'muted', icon: 'fa-solid fa-circle' };
    }
  }

  columnLabel(status: string): string {
    return resolveCustomerStatus(status, this.language.lang(), status);
  }

  daysLabel(card: SalesPipelineCard): string {
    if (card.daysInStage <= 0) return this.t('pipeline.card.enteredToday');
    return interpolate(this.t('pipeline.card.daysInStage'), { days: card.daysInStage });
  }

  sortLabelKey(sort: SalesPipelineSort): string {
    return `pipeline.sort.${sort}`;
  }

  initials(name: string): string {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2);
    return parts[0][0] + parts[parts.length - 1][0];
  }

  /** Strips spaces etc. so the `tel:` link works on phones. */
  telHref(phone: string | null): string | null {
    const clean = (phone ?? '').replace(/[^\d+]/g, '');
    return clean ? `tel:${clean}` : null;
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
