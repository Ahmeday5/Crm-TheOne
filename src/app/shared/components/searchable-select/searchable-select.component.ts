import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  HostListener,
  OnInit,
  Output,
  ViewChild,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Observable, Subject, catchError, forkJoin, of, switchMap } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

// ─────────── Public types ───────────

/**
 * Parameters passed to a paginated fetch function.
 * Page index is 1-based (matches the backend convention in this project).
 */
export interface SelectFetchParams {
  search: string;
  pageIndex: number;
  pageSize: number;
}

/**
 * Minimal shape a paginated fetch function must return.
 * Matches the project's `PagedResult<T>` with loosely-typed `data`.
 */
export interface SelectPageResult {
  /** Total record count across ALL pages (not just this page). */
  count: number;
  data: Record<string, unknown>[];
}

// ─────────── Component ───────────

/**
 * Production-grade searchable single-select that works as a drop-in
 * replacement for the native `<select class="form-select">` elements used
 * throughout the app.
 *
 * Three data modes:
 *  1. **Static** — pass `[options]="items"` for enum-backed dropdowns.
 *  2. **Simple fetch** — pass `[fetchFn]` for non-paginated endpoints that
 *     return `T[]` directly.
 *  3. **Paginated fetch** — pass `[pagedFetchFn]` for endpoints that return
 *     `{ count, data[] }`.  The component automatically loops through ALL
 *     pages so every record appears in the dropdown, regardless of how many
 *     backend pages exist.
 *
 * Usage:
 * ```html
 * <!-- Static (enums / hardcoded lists) -->
 * <app-searchable-select
 *   [options]="priorities"
 *   labelKey="label"
 *   valueKey="value"
 *   formControlName="priority" />
 *
 * <!-- Simple fetch (returns T[] directly) -->
 * <app-searchable-select
 *   [fetchFn]="service.customersDropdown.bind(service)"
 *   labelKey="fullName"
 *   valueKey="id"
 *   subLabelKey="campanyName"
 *   formControlName="customerId" />
 *
 * <!-- Paginated fetch (all pages loaded automatically) -->
 * <app-searchable-select
 *   [pagedFetchFn]="servicesFetchFn"
 *   labelKey="nameAr"
 *   valueKey="id"
 *   formControlName="serviceId" />
 * ```
 *
 * Implements `ControlValueAccessor` — works with both reactive forms
 * (`formControlName` / `formControl`) and template-driven (`ngModel`).
 */
@Component({
  selector: 'app-searchable-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './searchable-select.component.html',
  styleUrl: './searchable-select.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableSelectComponent),
      multi: true,
    },
  ],
})
export class SearchableSelectComponent implements ControlValueAccessor, OnInit {
  // ─────────── Inputs: data source ───────────

  /** Static list — no HTTP calls, filtered client-side. */
  readonly options = input<Record<string, unknown>[]>([]);

  /**
   * Non-paginated fetch function.  Called once on init (and on retry).
   * Must return an `Observable<Record<string, unknown>[]>`.
   */
  readonly fetchFn = input<(() => Observable<Record<string, unknown>[]>) | null>(null);

  /**
   * Paginated fetch function.  The component calls this once per page and
   * forkJoin-merges the results so every record is visible in the dropdown.
   *
   * When `hasBackendSearch` is true the component re-fetches on every
   * debounced search input, passing the current query in `params.search`.
   */
  readonly pagedFetchFn =
    input<((params: SelectFetchParams) => Observable<SelectPageResult>) | null>(null);

  /**
   * Page size used when fetching pages.  A larger value means fewer
   * round-trips.  Override only when the backend imposes a lower max.
   */
  readonly pageBatchSize = input<number>(100);

  /**
   * When `true` (default) the `pagedFetchFn` supports a `search` query
   * param and the component sends debounced search terms to the backend.
   * When `false` all pages are loaded once and filtering is done client-side.
   */
  readonly hasBackendSearch = input<boolean>(true);

  // ─────────── Inputs: field mapping ───────────

  /** Property name to use as the display label. */
  readonly labelKey = input<string>('name');

  /** Property name to use as the form value. */
  readonly valueKey = input<string>('id');

  /** Optional second-line text (e.g., company name under a customer name). */
  readonly subLabelKey = input<string | null>(null);

  // ─────────── Inputs: UX strings ───────────

  readonly placeholder = input<string>('اختر...');
  readonly searchPlaceholder = input<string>('بحث...');
  readonly emptyText = input<string>('لا توجد نتائج');
  readonly loadingText = input<string>('جارٍ التحميل...');
  readonly errorText = input<string>('فشل التحميل');

  // ─────────── Inputs: behaviour ───────────

  /** Show an × to clear the selected value. */
  readonly allowClear = input<boolean>(true);

  /** Forward the `is-invalid` class from the parent form control. */
  readonly isInvalid = input<boolean>(false);

  /**
   * When using static `[options]` driven by a parent-owned signal, pass the
   * parent's loading state here so the trigger shows a spinner while the
   * parent is still fetching.  Not used when `fetchFn` / `pagedFetchFn` is set.
   */
  readonly externalLoading = input<boolean>(false);

  /**
   * Optional function to derive the display label from a raw item.
   * Useful for bilingual labels (e.g. pick nameAr vs nameEn at runtime).
   * When provided, `labelKey` is still used for client-side search matching.
   */
  readonly transformLabel =
    input<((item: Record<string, unknown>) => string) | null>(null);

  // ─────────── Outputs ───────────

  /**
   * Emitted once (and on every retry) when the fetch function finishes.
   * Use with `(itemsLoaded)="onItemsLoaded($event)"` when the parent needs
   * the raw item list (e.g., to resolve the selected customer's services).
   */
  @Output() readonly itemsLoaded = new EventEmitter<Record<string, unknown>[]>();

  // ─────────── State ───────────

  readonly isOpen = signal(false);
  readonly searchQuery = signal('');
  readonly allItems = signal<Record<string, unknown>[]>([]);
  readonly selectedValue = signal<unknown>(null);
  readonly isLoading = signal(false);
  readonly hasError = signal(false);
  readonly highlightedIndex = signal(-1);
  readonly isDisabled = signal(false);

  // ─────────── Internal ───────────

  @ViewChild('searchInput') private searchInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('optionsList') private optionsListRef?: ElementRef<HTMLElement>;

  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchInput$ = new Subject<string>();

  private onChangeFn: (v: unknown) => void = () => {};
  private onTouchedFn: () => void = () => {};

  // ─────────── Computed ───────────

  /**
   * Items shown in the dropdown list.
   * For backend-search mode: `allItems` is already filtered by the server.
   * For client-side mode: apply the local query.
   */
  readonly filteredItems = computed(() => {
    const items = this.allItems();
    const q = this.searchQuery().trim().toLowerCase();
    const lk = this.labelKey();
    const slk = this.subLabelKey();

    if (this.pagedFetchFn() && this.hasBackendSearch()) {
      return items; // backend already filtered
    }

    if (!q) return items;

    return items.filter((item) => {
      const label = this.getItemLabel(item).toLowerCase();
      const fallback = String(item[lk] ?? '').toLowerCase();
      const sub = slk ? String(item[slk] ?? '').toLowerCase() : '';
      return label.includes(q) || fallback.includes(q) || sub.includes(q);
    });
  });

  /** Resolve the display label for an item (custom fn → labelKey fallback). */
  getItemLabel(item: Record<string, unknown>): string {
    const fn = this.transformLabel();
    return fn ? fn(item) : String(item[this.labelKey()] ?? '');
  }

  /** The item object that corresponds to the current CVA value. */
  readonly selectedItem = computed(() => {
    const v = this.selectedValue();
    if (v === null || v === undefined) return null;
    const vk = this.valueKey();
    return this.allItems().find((item) => item[vk] === v) ?? null;
  });

  /** Display label of the currently selected option. */
  readonly selectedLabel = computed(() => {
    const item = this.selectedItem();
    if (!item) return null;
    return this.getItemLabel(item);
  });

  /** Second line of the currently selected option (e.g., company name). */
  readonly selectedSubLabel = computed(() => {
    const item = this.selectedItem();
    const slk = this.subLabelKey();
    if (!item || !slk) return null;
    const v = item[slk];
    return v ? String(v) : null;
  });

  // ─────────── Constructor / init ───────────

  constructor() {
    // Keep allItems in sync when static options change.
    effect(
      () => {
        const opts = this.options();
        if (!this.fetchFn() && !this.pagedFetchFn()) {
          this.allItems.set(opts as Record<string, unknown>[]);
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    // Debounced backend search stream (only for pagedFetchFn + hasBackendSearch).
    this.searchInput$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          this.isLoading.set(true);
          this.hasError.set(false);
          this.highlightedIndex.set(-1);
          return this.executeSearch(q).pipe(
            catchError(() => {
              this.hasError.set(true);
              this.isLoading.set(false);
              return of([]);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((items) => {
        this.allItems.set(items);
        this.isLoading.set(false);
      });

    // Eagerly load when a remote fetch function is provided.
    if (this.fetchFn() || this.pagedFetchFn()) {
      this.fetchAll('');
    }
  }

  // ─────────── ControlValueAccessor ───────────

  writeValue(value: unknown): void {
    this.selectedValue.set(value ?? null);
  }

  registerOnChange(fn: (v: unknown) => void): void {
    this.onChangeFn = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouchedFn = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  // ─────────── Interactions ───────────

  openPanel(): void {
    if (this.isDisabled()) return;
    this.isOpen.set(true);
    this.highlightedIndex.set(-1);
    // Focus the search box after the panel animates in.
    setTimeout(() => this.searchInputRef?.nativeElement.focus(), 50);
  }

  closePanel(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this.searchQuery.set('');
    this.highlightedIndex.set(-1);
    this.onTouchedFn();

    // Reset backend-search results to the full list.
    if (this.pagedFetchFn() && this.hasBackendSearch()) {
      this.fetchAll('');
    }
  }

  togglePanel(): void {
    this.isOpen() ? this.closePanel() : this.openPanel();
  }

  selectItem(item: Record<string, unknown>): void {
    const value = item[this.valueKey()];
    this.selectedValue.set(value);
    this.onChangeFn(value);
    this.closePanel();
  }

  clearValue(event: Event): void {
    event.stopPropagation();
    if (this.isDisabled()) return;
    this.selectedValue.set(null);
    this.onChangeFn(null);
    this.onTouchedFn();
  }

  onSearchInputChange(query: string): void {
    this.searchQuery.set(query);
    this.highlightedIndex.set(-1);

    if (this.pagedFetchFn() && this.hasBackendSearch()) {
      this.searchInput$.next(query); // backend search (debounced)
    }
    // Otherwise: filteredItems computed handles client-side filtering instantly.
  }

  retryLoad(): void {
    this.fetchAll(this.searchQuery());
  }

  isItemSelected(item: Record<string, unknown>): boolean {
    const v = this.selectedValue();
    return v !== null && v !== undefined && item[this.valueKey()] === v;
  }

  // ─────────── Keyboard navigation ───────────

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen()) return;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.closePanel();
        break;

      case 'ArrowDown':
        event.preventDefault();
        this.moveHighlight(1);
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.moveHighlight(-1);
        break;

      case 'Enter':
        event.preventDefault();
        this.selectHighlighted();
        break;

      case 'Home':
        event.preventDefault();
        this.highlightedIndex.set(0);
        this.scrollHighlightedIntoView();
        break;

      case 'End':
        event.preventDefault();
        this.highlightedIndex.set(this.filteredItems().length - 1);
        this.scrollHighlightedIntoView();
        break;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (target && !this.hostRef.nativeElement.contains(target)) {
      this.closePanel();
    }
  }

  // ─────────── Private helpers ───────────

  private moveHighlight(delta: number): void {
    const len = this.filteredItems().length;
    if (len === 0) return;
    const current = this.highlightedIndex();
    const next = current < 0 ? (delta > 0 ? 0 : len - 1) : (current + delta + len) % len;
    this.highlightedIndex.set(next);
    this.scrollHighlightedIntoView();
  }

  private selectHighlighted(): void {
    const idx = this.highlightedIndex();
    const items = this.filteredItems();
    if (idx >= 0 && idx < items.length) {
      this.selectItem(items[idx]);
    }
  }

  private scrollHighlightedIntoView(): void {
    const list = this.optionsListRef?.nativeElement;
    if (!list) return;
    const idx = this.highlightedIndex();
    const option = list.querySelectorAll<HTMLElement>('[data-option]')[idx];
    option?.scrollIntoView({ block: 'nearest' });
  }

  /**
   * Eagerly fetch all records (with optional search term).
   * Bypasses the debounce — used for initial load and retry.
   */
  private fetchAll(search: string): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    this.executeSearch(search)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.allItems.set(items);
          this.isLoading.set(false);
          this.itemsLoaded.emit(items);
        },
        error: () => {
          this.isLoading.set(false);
          this.hasError.set(true);
        },
      });
  }

  /**
   * Build the correct Observable depending on which fetch mode is active.
   * For paginated mode: fetches page 1, reads `count`, then parallel-fetches
   * all remaining pages via `forkJoin` and merges results.
   */
  private executeSearch(search: string): Observable<Record<string, unknown>[]> {
    const fn = this.fetchFn();
    const pagedFn = this.pagedFetchFn();

    if (fn) {
      return fn();
    }

    if (pagedFn) {
      return this.fetchAllPages(pagedFn, search);
    }

    // Static options — no HTTP involved.
    return of(this.options() as Record<string, unknown>[]);
  }

  /**
   * Auto-paginate: fetch page 1 to discover `count`, then parallel-fetch
   * every remaining page and merge all results into a single flat array.
   */
  private fetchAllPages(
    fn: (params: SelectFetchParams) => Observable<SelectPageResult>,
    search: string,
  ): Observable<Record<string, unknown>[]> {
    const batchSize = this.pageBatchSize();

    return fn({ search, pageIndex: 1, pageSize: batchSize }).pipe(
      switchMap((firstPage) => {
        const total = firstPage.count ?? 0;
        const firstBatch = firstPage.data ?? [];

        if (total <= batchSize) {
          return of(firstBatch);
        }

        const totalPages = Math.ceil(total / batchSize);
        const remainingPages = Array.from(
          { length: totalPages - 1 },
          (_, i) => i + 2,
        );

        return forkJoin(
          remainingPages.map((pageIndex) =>
            fn({ search, pageIndex, pageSize: batchSize }),
          ),
        ).pipe(
          switchMap((pages) =>
            of([...firstBatch, ...pages.flatMap((p) => p.data ?? [])]),
          ),
        );
      }),
    );
  }
}
