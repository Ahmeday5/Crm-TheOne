import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CopyButtonComponent } from '../../../../shared/components/copy-button/copy-button.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { ClampTextDirective } from '../../../../shared/directives/clamp-text.directive';
import { ResponsiveTableDirective } from '../../../../shared/directives/responsive-table.directive';
import { PagedResult } from '../../../../shared/models';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { VaultFormDialogComponent } from '../../components/vault-form-dialog/vault-form-dialog.component';
import { VaultSecretComponent } from '../../components/vault-secret/vault-secret.component';
import { VaultAccount, VaultAccountType, VaultListQuery } from '../../models/vault.models';
import { VaultService } from '../../services/vault.service';
import { endpointLabel } from '../../utils/vault-form.util';

type VaultTab = 'all' | VaultAccountType;
type Load = { ok: true; page: PagedResult<VaultAccount> } | { ok: false; message: string | null };

const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50];

/**
 * `/vault` (Admin only) — email and server credentials.
 * Server-paged and searched; every page request supersedes the previous
 * one. Passwords never enter this component — see `VaultSecretComponent`.
 */
@Component({
  selector: 'app-vault-list',
  standalone: true,
  imports: [
    TranslatePipe,
    CairoDatePipe,
    PageHeaderComponent,
    PaginationComponent,
    ResponsiveTableDirective,
    ClampTextDirective,
    CopyButtonComponent,
    VaultSecretComponent,
    VaultFormDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vault-list.component.html',
  styleUrl: './vault-list.component.scss',
})
export class VaultListComponent {
  private readonly vault = inject(VaultService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  protected readonly tabs: readonly { key: VaultTab; icon: string }[] = [
    { key: 'all', icon: 'fa-solid fa-layer-group' },
    { key: 'Email', icon: 'fa-solid fa-envelope' },
    { key: 'Server', icon: 'fa-solid fa-server' },
  ];
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  protected readonly tab = signal<VaultTab>('all');
  protected readonly search = signal('');
  protected readonly pageIndex = signal(1);
  protected readonly pageSize = signal(10);

  protected readonly rows = signal<VaultAccount[]>([]);
  protected readonly count = signal(0);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly busyId = signal<number | null>(null);

  protected readonly formOpen = signal(false);
  protected readonly editId = signal<number | null>(null);

  protected readonly filtered = computed(() => this.tab() !== 'all' || !!this.search());

  private readonly requests = new Subject<VaultListQuery>();
  private readonly searchInput = new Subject<string>();

  constructor() {
    this.requests
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.loadError.set(null);
        }),
        switchMap((query) =>
          this.vault.list(query).pipe(
            map((page): Load => ({ ok: true, page })),
            catchError((err: ApiError) => of<Load>({ ok: false, message: err?.message?.trim() || null })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((res) => this.apply(res));

    this.searchInput.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed()).subscribe((term) => {
      this.search.set(term);
      this.pageIndex.set(1);
      this.load();
    });

    this.load();
  }

  protected load(): void {
    this.requests.next({
      type: this.tab() === 'all' ? null : (this.tab() as VaultAccountType),
      search: this.search() || null,
      pageIndex: this.pageIndex(),
      pageSize: this.pageSize(),
    });
  }

  private apply(res: Load): void {
    this.loading.set(false);
    if (!res.ok) {
      this.loadError.set(res.message ?? this.t('vault.messages.loadFailed'));
      return;
    }
    const lastPage = Math.max(1, Math.ceil(res.page.count / this.pageSize()));
    if (!res.page.data.length && this.pageIndex() > lastPage) {
      this.pageIndex.set(lastPage);
      this.load();
      return;
    }
    this.rows.set(res.page.data);
    this.count.set(res.page.count);
  }

  // ── filters / paging ──

  protected setTab(tab: VaultTab): void {
    if (tab === this.tab()) return;
    this.tab.set(tab);
    this.pageIndex.set(1);
    this.load();
  }

  protected onSearch(value: string): void {
    this.searchInput.next(value.trim());
  }

  protected onPage(page: number): void {
    this.pageIndex.set(page);
    this.load();
  }

  protected onPageSize(size: number): void {
    this.pageSize.set(size);
    this.pageIndex.set(1);
    this.load();
  }

  // ── create / edit / delete ──

  protected openCreate(): void {
    this.editId.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(row: VaultAccount): void {
    this.editId.set(row.id);
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.editId.set(null);
  }

  protected onSaved(account: VaultAccount): void {
    const editing = this.editId() !== null;
    this.closeForm();
    this.toast.success(this.t(editing ? 'vault.messages.updated' : 'vault.messages.created'));
    if (editing) this.rows.update((list) => list.map((r) => (r.id === account.id ? account : r)));
    else this.load();
  }

  protected async confirmDelete(row: VaultAccount): Promise<void> {
    const ok = await this.dialog.confirm({
      title: this.t('vault.delete.title'),
      message: interpolate(this.t('vault.delete.message'), { title: row.title }),
      confirmText: this.t('vault.delete.confirm'),
      cancelText: this.t('common.cancel'),
      type: 'danger',
    });
    if (!ok) return;
    this.busyId.set(row.id);
    this.vault.delete(row.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(this.t('vault.messages.deleted'));
        this.load();
      },
      error: (err: ApiError) => {
        this.busyId.set(null);
        this.toast.error(err?.message?.trim() || this.t('vault.messages.deleteFailed'));
      },
    });
  }

  // ── feedback from cells ──

  protected onCopied(): void {
    this.toast.success(this.t('vault.messages.copied'), { duration: 1800 });
  }

  protected onCopyFailed(): void {
    this.toast.error(this.t('vault.messages.copyFailed'));
  }

  protected onRevealFailed(err: unknown): void {
    this.toast.error((err as ApiError)?.message?.trim() || this.t('vault.messages.revealFailed'));
  }

  // ── helpers ──

  protected endpoint(row: VaultAccount): string | null {
    return endpointLabel(row.host, row.port);
  }

  /** Only http(s) links are opened (validated on save, re-checked here). */
  protected safeUrl(row: VaultAccount): string | null {
    return row.url && /^https?:\/\//i.test(row.url) ? row.url : null;
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
