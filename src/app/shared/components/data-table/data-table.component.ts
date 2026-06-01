import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  TemplateRef,
  inject,
  input,
  output,
} from '@angular/core';
import { LanguageService } from '../../../core/services/language.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

export interface TableColumn<T = unknown> {
  key: string;
  label: string;
  i18nLabel?: boolean;
  width?: string;
  align?: 'right' | 'left' | 'center' | 'start' | 'end';
  cellTemplate?: TemplateRef<{ $implicit: T }>;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, TranslatePipe, EmptyStateComponent],
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
  
  readonly actionsTemplate = input<TemplateRef<{ $implicit: T }> | null>(null);
  readonly emptyMessage = input<string>('');
  readonly emptyIcon = input<string>('fa-solid fa-inbox');
  readonly rowClick = output<T>();

  @Output() retry = new EventEmitter<void>();

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
