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
import {
  DataTableComponent,
  TableColumn,
} from '../../../../shared/components/data-table/data-table.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { AppService, FormMode } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ServiceFormDialogComponent } from '../../components/service-form-dialog/service-form-dialog.component';
import { ServicesService } from '../../services/services.service';

const DEFAULT_PAGE_SIZE = 10;

@Component({
  selector: 'app-services-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    DataTableComponent,
    LoadErrorComponent,
    PaginationComponent,
    StatCardComponent,
    ServiceFormDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './services-list.component.html',
  styleUrl: './services-list.component.scss',
})
export class ServicesListComponent {
  private readonly services = inject(ServicesService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(DialogService);
  private readonly language = inject(LanguageService);

  /** Reactive search input — debounced before hitting the API. */
  searchTerm = '';
  private readonly searchInput$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  readonly rows = signal<AppService[]>([]);
  readonly count = signal(0);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly searchSignal = signal('');

  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  /** Form-dialog state — `null` ⇒ closed. */
  readonly dialogMode = signal<FormMode | null>(null);
  readonly editing = signal<AppService | null>(null);

  /** Per-row spinner key. */
  readonly busyId = signal<number | null>(null);

  readonly columns: ReadonlyArray<TableColumn<AppService>> = [
    { key: 'id', label: 'services.table.id', i18nLabel: true, width: '90px' },
    { key: 'nameAr', label: 'services.table.nameAr', i18nLabel: true },
    { key: 'nameEn', label: 'services.table.nameEn', i18nLabel: true },
  ];

  /** Lightweight KPIs derived from the current page. */
  readonly kpis = computed(() => ({
    total: this.count(),
    visible: this.rows().length,
    page: this.pageIndex(),
    pageSize: this.pageSize(),
  }));

  ngOnInit(): void {
    this.searchInput$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe((term) => {
        this.searchSignal.set(term);
        this.pageIndex.set(1); // reset to first page on new query
        this.reload();
      });
    this.reload();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─────────── data loading ───────────

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.services
      .list({
        pageIndex: this.pageIndex(),
        pageSize: this.pageSize(),
        search: this.searchSignal().trim() || undefined,
      })
      .subscribe({
        next: (page) => {
          this.rows.set(page.data ?? []);
          this.count.set(page.count ?? 0);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadError.set(this.t('services.messages.loadFailed'));
        },
      });
  }

  // ─────────── search / pagination ───────────

  onSearchInput(value: string): void {
    this.searchTerm = value;
    this.searchInput$.next(value);
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

  // ─────────── add / edit ───────────

  openAdd(): void {
    this.editing.set(null);
    this.dialogMode.set('create');
  }

  openEdit(row: AppService): void {
    this.editing.set(row);
    this.dialogMode.set('edit');
  }

  closeDialog(): void {
    this.dialogMode.set(null);
    this.editing.set(null);
  }

  onSaved(): void {
    this.closeDialog();
    this.reload();
  }

  // ─────────── delete ───────────

  async confirmDelete(row: AppService): Promise<void> {
    const ok = await this.dialog.confirm({
      title: this.t('services.deleteDialog.title'),
      message: this.t('services.deleteDialog.message'),
      confirmText: this.t('services.deleteDialog.confirm'),
      cancelText: this.t('services.deleteDialog.cancel'),
      type: 'danger',
    });
    if (!ok) return;

    this.busyId.set(row.id);
    this.services.delete(row.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(this.t('services.messages.deleted'));
        // If this page becomes empty after deletion, fall back one page.
        if (this.rows().length === 1 && this.pageIndex() > 1) {
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

  displayName(row: AppService): string {
    return this.language.isRtl() ? row.nameAr : row.nameEn;
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
