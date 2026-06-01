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
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  takeUntil,
} from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import {
  ARTICLE_TYPES,
  Article,
  ArticleListQuery,
  ArticleTypeName,
  FormMode,
  articleStatusBadgeClass,
  articleTypeBadgeClass,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ArticleDetailsDialogComponent } from '../../components/article-details-dialog/article-details-dialog.component';
import { ArticleFormDialogComponent } from '../../components/article-form-dialog/article-form-dialog.component';
import { ArticlesService } from '../../services/articles.service';

const DEFAULT_PAGE_SIZE = 10;

/** Left-accent colour per article type — mirrors the badge palette. */
const TYPE_ACCENT: Record<string, string> = {
  Guide: '#2563eb',
  Procedure: '#0ea5e9',
  ProblemSolving: '#f59e0b',
  BestPractices: '#16a34a',
  TechnicalReference: '#7c3aed',
};

@Component({
  selector: 'app-knowledge-base',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    EmptyStateComponent,
    LoadErrorComponent,
    PaginationComponent,
    ArticleFormDialogComponent,
    ArticleDetailsDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './knowledge-base.component.html',
  styleUrl: './knowledge-base.component.scss',
})
export class KnowledgeBaseComponent implements OnInit, OnDestroy {
  private readonly service = inject(ArticlesService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(DialogService);
  protected readonly language = inject(LanguageService);

  readonly types = ARTICLE_TYPES;

  // ── list state ──
  readonly rows = signal<Article[]>([]);
  readonly count = signal(0);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  // ── filters ──
  searchTerm = '';
  private readonly searchInput$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  readonly searchSignal = signal('');
  readonly typeFilter = signal<ArticleTypeName | null>(null);

  // ── dialog state ──
  readonly dialogMode = signal<FormMode | null>(null);
  readonly editing = signal<Article | null>(null);
  readonly viewingId = signal<number | null>(null);
  readonly busyId = signal<number | null>(null);

  readonly typeBadge = articleTypeBadgeClass;
  readonly statusBadge = articleStatusBadgeClass;

  // ── KPI strip (totals are exact; the breakdown reflects the loaded page) ──
  readonly kpiTotal = computed(() => this.count());
  readonly kpiPublished = computed(
    () => this.rows().filter((a) => a.status === 'Published').length,
  );
  readonly kpiDrafts = computed(
    () => this.rows().filter((a) => a.status === 'Draft').length,
  );
  readonly kpiWithAttachments = computed(
    () => this.rows().filter((a) => a.attachments.length > 0).length,
  );

  readonly hasActiveFilters = computed(
    () => !!this.searchSignal() || !!this.typeFilter(),
  );

  ngOnInit(): void {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => {
        this.searchSignal.set(term);
        this.pageIndex.set(1);
        this.reload();
      });
    this.reload();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─────────── data ───────────

  private buildQuery(): ArticleListQuery {
    const type = this.typeFilter();
    return {
      PageIndex: this.pageIndex(),
      PageSize: this.pageSize(),
      Search: this.searchSignal().trim() || undefined,
      Type: type ? this.types.find((t) => t.name === type)?.api : undefined,
    };
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.list(this.buildQuery()).subscribe({
      next: (page) => {
        this.rows.set(page.data ?? []);
        this.count.set(page.count ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(this.t('kb.messages.loadFailed'));
      },
    });
  }

  // ─────────── filters / pagination ───────────

  onSearchInput(value: string): void {
    this.searchTerm = value;
    this.searchInput$.next(value);
  }

  onTypeFilter(value: ArticleTypeName | null): void {
    this.typeFilter.set(value ?? null);
    this.pageIndex.set(1);
    this.reload();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.searchSignal.set('');
    this.typeFilter.set(null);
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

  // ─────────── create / edit ───────────

  openAdd(): void {
    this.editing.set(null);
    this.dialogMode.set('create');
  }

  openEdit(article: Article): void {
    this.editing.set(article);
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

  // ─────────── view ───────────

  openDetails(article: Article): void {
    this.viewingId.set(article.id);
  }

  closeDetails(): void {
    this.viewingId.set(null);
  }

  // ─────────── delete ───────────

  async confirmDelete(article: Article): Promise<void> {
    const ok = await this.dialog.confirm({
      title: this.t('kb.deleteDialog.title'),
      message: this.t('kb.deleteDialog.message'),
      confirmText: this.t('kb.deleteDialog.confirm'),
      cancelText: this.t('kb.deleteDialog.cancel'),
      type: 'danger',
    });
    if (!ok) return;

    this.busyId.set(article.id);
    this.service.delete(article.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(this.t('kb.messages.deleted'));
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

  typeAccent(type: string): string {
    return TYPE_ACCENT[type] ?? '#6b7280';
  }

  keywordList(keywords: string | null): string[] {
    if (!keywords) return [];
    return keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(
      this.language.lang() === 'ar' ? 'ar-EG' : 'en-GB',
      { year: 'numeric', month: 'short', day: 'numeric' },
    );
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
