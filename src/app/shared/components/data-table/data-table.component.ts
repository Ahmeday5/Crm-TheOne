import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  inject,
  input,
  output,
} from '@angular/core';
import { LanguageService } from '../../../core/services/language.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

export interface TableColumn<T = unknown> {
  /** Dotted path into the row (`'name'` or `'address.city'`). */
  key: string;
  /** Header label. Pass an i18n key plus `i18nLabel: true` to translate. */
  label: string;
  /** When true, treat `label` as a translation key. */
  i18nLabel?: boolean;
  width?: string;
  align?: 'right' | 'left' | 'center' | 'start' | 'end';
  /**
   * Optional cell template. The row is the implicit context:
   *   <ng-template #nameCell let-row>...</ng-template>
   *   { key: 'name', label: '...', cellTemplate: nameCell }
   */
  cellTemplate?: TemplateRef<{ $implicit: T }>;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss',
})
export class DataTableComponent<T extends object = object> {
  readonly columns = input.required<ReadonlyArray<TableColumn<T>>>();
  readonly data = input.required<ReadonlyArray<T>>();

  readonly trackByKey = input<string>('id');
  readonly hasActions = input<boolean>(false);
  readonly rowClickable = input<boolean>(false);
  readonly loading = input<boolean>(false);
  /** TemplateRef for the per-row actions cell. Receives the row as `$implicit`. */
  readonly actionsTemplate = input<TemplateRef<{ $implicit: T }> | null>(null);
  /** Empty-state message; falls back to a translated "no results" otherwise. */
  readonly emptyMessage = input<string>('');

  readonly rowClick = output<T>();

  protected readonly language = inject(LanguageService);

  rowKey(row: T): unknown {
    const key = this.trackByKey();
    return (row as Record<string, unknown>)[key] ?? row;
  }

  getCellValue(row: T, key: string): string {
    const parts = key.split('.');
    let v: unknown = row;
    for (const p of parts) {
      v =
        v && typeof v === 'object'
          ? (v as Record<string, unknown>)[p]
          : undefined;
    }
    if (v === null || v === undefined || v === '') return '—';
    return String(v);
  }

  alignClass(col: TableColumn<T>): string {
    const a = col.align ?? (this.language.isRtl() ? 'right' : 'left');
    return `text-${a}`;
  }

  trackByColumn = (_: number, c: TableColumn<T>) => c.key;
  trackByRow = (_: number, row: T): unknown => this.rowKey(row);
}
