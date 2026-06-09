import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { TRANSLATIONS, resolveKey } from '../../../core/i18n';
import { LanguageService } from '../../../core/services/language.service';
import {
  ExportColumn,
  TableExportService,
} from '../../../core/services/table-export.service';
import { ToastService } from '../../../core/services/toast.service';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';
import { TranslatePipe } from '../../pipes/translate.pipe';

/** Returns every row across all pages (used by the "all pages" actions). */
export type FetchAllRows<T> = () => Promise<T[]>;

/**
 * Export-and-print toolbar shared by every data table.
 *
 * The host describes its columns once (`ExportColumn[]`) and passes the
 * current page's rows. For paginated tables it also passes `fetchAll`, an
 * async accessor that pulls every page — that unlocks the "all pages"
 * actions. Excel goes through {@link TableExportService.toExcel}; print opens
 * a standalone branded report via {@link TableExportService.printTable}.
 *
 *   <app-table-tools
 *     [reportTitle]="'customers.title' | translate"
 *     [columns]="exportColumns"
 *     [rows]="rows()"
 *     [fetchAll]="fetchAllRows"
 *     [disabled]="loading()" />
 */
@Component({
  selector: 'app-table-tools',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ClickOutsideDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './table-tools.component.html',
  styleUrl: './table-tools.component.scss',
})
export class TableToolsComponent {
  /** Heading on the printed report + base name of the Excel file. */
  readonly reportTitle = input.required<string>();
  // `any` keeps call-sites strongly typed (`ExportColumn<MyRow>[]`) while
  // sidestepping function-parameter variance in the template binding.
  readonly columns = input.required<ExportColumn<any>[]>();
  /** Rows of the current page. */
  readonly rows = input<readonly any[]>([]);
  /** Pulls every page; when omitted the "all pages" actions are hidden. */
  readonly fetchAll = input<FetchAllRows<any> | null>(null);
  readonly disabled = input<boolean>(false);
  /** When true, a refresh button is rendered beside the export dropdown. */
  readonly showRefresh = input<boolean>(false);
  /** Emitted when the user clicks the refresh button. */
  @Output() readonly refresh = new EventEmitter<void>();

  private readonly exporter = inject(TableExportService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly open = signal(false);
  readonly busy = signal(false);

  readonly hasFetchAll = computed(() => this.fetchAll() !== null);

  toggle(): void {
    if (this.disabled() || this.busy()) return;
    this.open.update((v) => !v);
  }

  close(): void {
    this.open.set(false);
  }

  // ─────────── current page ───────────

  exportCurrent(): void {
    this.close();
    const rows = this.currentRows();
    if (!this.guard(rows)) return;
    void this.runExcel(rows, this.t('tableTools.scope.current'));
  }

  printCurrent(): void {
    this.close();
    const rows = this.currentRows();
    if (!this.guard(rows)) return;
    this.runPrint(rows, this.t('tableTools.scope.current'));
  }

  // ─────────── all pages ───────────

  async exportAll(): Promise<void> {
    this.close();
    const rows = await this.loadAll();
    if (rows === null) return;
    if (!this.guard(rows)) return;
    await this.runExcel(rows, this.t('tableTools.scope.all'));
  }

  async printAll(): Promise<void> {
    this.close();
    const rows = await this.loadAll();
    if (rows === null) return;
    if (!this.guard(rows)) return;
    this.runPrint(rows, this.t('tableTools.scope.all'));
  }

  // ─────────── internals ───────────

  private currentRows(): any[] {
    return this.rows() as any[];
  }

  /** Returns all rows, or null if the fetch failed / was unavailable. */
  private async loadAll(): Promise<any[] | null> {
    const fetcher = this.fetchAll();
    if (!fetcher) return null;
    this.busy.set(true);
    try {
      const rows = await fetcher();
      return rows ?? [];
    } catch {
      this.toast.error(this.t('tableTools.messages.fetchAllFailed'));
      return null;
    } finally {
      this.busy.set(false);
    }
  }

  private guard(rows: readonly unknown[]): boolean {
    if (!rows || rows.length === 0) {
      this.toast.warning(this.t('tableTools.messages.noData'));
      return false;
    }
    return true;
  }

  private async runExcel(rows: any[], scopeLabel: string): Promise<void> {
    try {
      await this.exporter.toExcel({
        fileName: `${this.reportTitle()} - ${scopeLabel}`,
        sheetName: this.reportTitle(),
        columns: this.columns(),
        rows,
      });
    } catch {
      this.toast.error(this.t('tableTools.messages.exportFailed'));
    }
  }

  private runPrint(rows: any[], scopeLabel: string): void {
    const ok = this.exporter.printTable({
      title: this.reportTitle(),
      subtitle: `${scopeLabel} — ${rows.length}`,
      columns: this.columns(),
      rows,
      dir: this.language.isRtl() ? 'rtl' : 'ltr',
      locale: this.language.lang() === 'ar' ? 'ar-EG' : 'en-US',
      labels: {
        generatedAt: this.t('tableTools.generatedAt'),
        total: this.t('tableTools.total'),
      },
    });
    if (!ok) this.toast.error(this.t('tableTools.messages.popupBlocked'));
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
