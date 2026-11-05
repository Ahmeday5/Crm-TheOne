import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  forwardRef,
  input,
  signal,
  viewChildren,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

interface Row {
  key: number;
  text: string;
}

/**
 * Editable ordered list of short texts (steps, questions, strengths…).
 * A form control whose value is `string[]` — empty rows are kept while
 * editing; the dialog trims them on submit.
 */
@Component({
  selector: 'app-pb-list-field',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './list-field.component.html',
  styleUrl: './list-field.component.scss',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ListFieldComponent), multi: true },
  ],
})
export class ListFieldComponent implements ControlValueAccessor {
  readonly placeholder = input('');
  readonly addLabel = input('');
  readonly maxItems = input(20);
  readonly maxLength = input(400);
  /** `check` shows a tick bullet (questions), `number` a counter (steps), `plus`/`minus` for pros/cons. */
  readonly bullet = input<'number' | 'check' | 'plus' | 'minus'>('number');
  readonly invalid = input(false);

  protected readonly rows = signal<Row[]>([]);
  protected readonly disabled = signal(false);
  private readonly inputs = viewChildren<ElementRef<HTMLTextAreaElement>>('field');
  private seq = 0;
  private onChange: (value: string[]) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string[] | null): void {
    this.rows.set((value ?? []).map((text) => ({ key: this.seq++, text })));
  }
  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected edit(index: number, event: Event): void {
    const text = (event.target as HTMLTextAreaElement).value;
    this.commit(this.rows().map((r, i) => (i === index ? { ...r, text } : r)));
  }

  protected add(): void {
    if (this.rows().length >= this.maxItems()) return;
    this.commit([...this.rows(), { key: this.seq++, text: '' }]);
    queueMicrotask(() => this.inputs().at(-1)?.nativeElement.focus());
  }

  protected remove(index: number): void {
    this.commit(this.rows().filter((_, i) => i !== index));
    this.onTouched();
  }

  protected move(index: number, delta: -1 | 1): void {
    const target = index + delta;
    const rows = [...this.rows()];
    if (target < 0 || target >= rows.length) return;
    [rows[index], rows[target]] = [rows[target], rows[index]];
    this.commit(rows);
  }

  /** Enter in a row adds the next one (Shift+Enter keeps a line break). */
  protected onKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (index === this.rows().length - 1) this.add();
      else this.inputs()[index + 1]?.nativeElement.focus();
    }
  }

  protected blur(): void {
    this.onTouched();
  }

  private commit(rows: Row[]): void {
    this.rows.set(rows);
    this.onChange(rows.map((r) => r.text));
  }
}
