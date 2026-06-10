import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface MultiSelectOption<T = number | string> {
  id: T;
  name: string;
}

/**
 * Themed, accessible multi-select for picking from a static dropdown list.
 *
 *   <app-multi-select
 *     [options]="countries()"
 *     [(ngModel)]="form.controls.countries"
 *     placeholder="اختر الدول"
 *     emptyText="لا توجد دول مطابقة">
 *   </app-multi-select>
 *
 * - Implements `ControlValueAccessor` so it works with both template-driven
 *   `[(ngModel)]` and reactive `formControl` / `formControlName` bindings.
 * - Click-outside closes the dropdown; ESC also closes.
 * - All styling is driven by `--surface-*` / `--text-*` / `--border` CSS vars
 *   so dark/light/brand themes are picked up automatically.
 */
@Component({
  selector: 'app-multi-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './multi-select.component.html',
  styleUrl: './multi-select.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MultiSelectComponent),
      multi: true,
    },
  ],
})
export class MultiSelectComponent implements ControlValueAccessor {
  // ─────────── inputs ───────────
  readonly options = input<MultiSelectOption[]>([]);
  readonly placeholder = input<string>('Select…');
  readonly emptyText = input<string>('No options');
  readonly searchPlaceholder = input<string>('Search…');
  readonly disabled = input<boolean>(false);
  readonly maxVisibleChips = input<number>(3);
  readonly loading = input<boolean>(false);
  /** When true, shows a "Select all" / "Clear" pair above the list. */
  readonly showBulkActions = input<boolean>(true);
  readonly selectAllLabel = input<string>('Select all');
  readonly clearLabel = input<string>('Clear');
  readonly loadingLabel = input<string>('Loading…');
  readonly selectedSuffix = input<string>('selected');

  // ─────────── state ───────────
  readonly open = signal(false);
  readonly query = signal('');
  /** Selected IDs — single source of truth driving the visible chips/checkmarks. */
  readonly selectedIds = signal<Array<number | string>>([]);
  readonly disabledSig = signal(false);

  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);

  // CVA callbacks
  private onChange: (value: Array<number | string>) => void = () => {};
  private onTouched: () => void = () => {};

  // ─────────── derived ───────────

  readonly selectedSet = computed(() => new Set(this.selectedIds()));

  readonly filteredOptions = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.options();
    return this.options().filter((o) => o.name.toLowerCase().includes(q));
  });

  readonly selectedOptions = computed(() => {
    const set = this.selectedSet();
    return this.options().filter((o) => set.has(o.id));
  });

  readonly visibleChips = computed(() => {
    const max = this.maxVisibleChips();
    const all = this.selectedOptions();
    if (all.length <= max) return all;
    return all.slice(0, max);
  });

  readonly extraCount = computed(() => {
    const max = this.maxVisibleChips();
    const total = this.selectedOptions().length;
    return total > max ? total - max : 0;
  });

  constructor() {
    // Reflect the bound `disabled` input into the writable signal used by
    // the template; CVA also writes to `disabledSig` via `setDisabledState`.
    effect(
      () => {
        this.disabledSig.set(this.disabled());
      },
      { allowSignalWrites: true },
    );
  }

  // ─────────── ControlValueAccessor ───────────

  writeValue(value: Array<number | string> | null | undefined): void {
    this.selectedIds.set(Array.isArray(value) ? [...value] : []);
  }
  registerOnChange(fn: (value: Array<number | string>) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabledSig.set(isDisabled);
  }

  // ─────────── interactions ───────────

  toggleOpen(): void {
    if (this.disabledSig()) return;
    const next = !this.open();
    this.open.set(next);
    if (!next) {
      this.onTouched();
      this.query.set('');
    }
  }

  close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.onTouched();
    this.query.set('');
  }

  toggleOption(id: number | string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.disabledSig()) return;
    const set = new Set(this.selectedIds());
    if (set.has(id)) set.delete(id);
    else set.add(id);
    const next = Array.from(set);
    this.selectedIds.set(next);
    this.onChange(next);
  }

  removeChip(id: number | string, event: Event): void {
    event.stopPropagation();
    if (this.disabledSig()) return;
    const next = this.selectedIds().filter((x) => x !== id);
    this.selectedIds.set(next);
    this.onChange(next);
  }

  selectAll(event: Event): void {
    event.stopPropagation();
    if (this.disabledSig()) return;
    const next = this.filteredOptions().map((o) => o.id);
    // Merge with existing selection so a search-narrowed "select all" only
    // adds matches without dropping previously-picked items.
    const merged = Array.from(new Set([...this.selectedIds(), ...next]));
    this.selectedIds.set(merged);
    this.onChange(merged);
  }

  clearAll(event: Event): void {
    event.stopPropagation();
    if (this.disabledSig()) return;
    this.selectedIds.set([]);
    this.onChange([]);
  }

  onQueryChange(value: string): void {
    this.query.set(value);
  }

  isSelected(id: number | string): boolean {
    return this.selectedSet().has(id);
  }

  // ─────────── outside / ESC handlers ───────────

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (!target) return;
    if (!this.hostRef.nativeElement.contains(target)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.close();
  }
}
