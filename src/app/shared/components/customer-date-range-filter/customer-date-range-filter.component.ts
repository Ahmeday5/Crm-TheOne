import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { cairoToday } from '../../../core/utils/cairo-time.util';
import {
  DEFAULT_DATE_RANGE_PRESETS,
  DateRangePreset,
  isDateRangeActive,
  isDateRangeInverted,
  matchDateRangePreset,
  normalizeDateRange,
  presetDateRange,
  sameDateRange,
} from '../../../core/utils/date-range.util';
import { CustomerDateFilter } from '../../models';
import { TranslatePipe } from '../../pipes/translate.pipe';

let nextId = 0;

/**
 * "Date added" range filter — the single From / To control every customer
 * screen uses (lists, buyers, Kanban, map, dashboard widget).
 *
 *   <app-customer-date-range-filter
 *     [value]="dateFilter()"
 *     (valueChange)="onDateFilterChange($event)" />
 *
 * Contract:
 *  - emits `CustomerDateFilter` with `yyyy-MM-dd` bounds; a cleared bound is
 *    omitted (never `''`), so the value can be spread straight into a query;
 *  - never emits an inverted range — "To" can't be picked before "From", and
 *    a hand-typed inverted pair is held back with an inline error instead of
 *    being sent to the API (which would answer 400);
 *  - emits only on a real change, so hosts can reset paging unconditionally.
 *
 * The inputs keep their own draft so an invalid edit stays visible (with its
 * error) without overwriting the last valid value the host is showing.
 */
@Component({
  selector: 'app-customer-date-range-filter',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-date-range-filter.component.html',
  styleUrl: './customer-date-range-filter.component.scss',
})
export class CustomerDateRangeFilterComponent {
  /** Two-way: `[(value)]`, or `[value]` + `(valueChange)`. */
  readonly value = model<CustomerDateFilter>({});
  /** i18n key of the caption. */
  readonly labelKey = input('dateFilter.createdAt');
  readonly presets = input<readonly DateRangePreset[]>(DEFAULT_DATE_RANGE_PRESETS);
  /** `sm` for dense toolbars (Kanban, map, dashboard card). */
  readonly size = input<'sm' | 'md'>('md');
  readonly disabled = input(false);

  protected readonly labelId = `drf-label-${++nextId}`;
  protected readonly errorId = `drf-error-${nextId}`;
  /** Customers can't be added in the future — cap both pickers at today (Cairo). */
  protected readonly today = cairoToday();

  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly invalid = signal(false);

  protected readonly active = computed(() => isDateRangeActive(this.value()));
  protected readonly activePreset = computed(() =>
    matchDateRangePreset(this.value(), this.presets(), this.today),
  );

  constructor() {
    // Mirror external changes (clear chip, reset, URL) into the drafts.
    effect(
      () => {
        const v = normalizeDateRange(this.value());
        untracked(() => {
          this.from.set(v.from ?? '');
          this.to.set(v.to ?? '');
          this.invalid.set(false);
        });
      },
      { allowSignalWrites: true },
    );
  }

  protected setFrom(day: string | null): void {
    this.from.set(day ?? '');
    this.commit();
  }

  protected setTo(day: string | null): void {
    this.to.set(day ?? '');
    this.commit();
  }

  /** Clicking the highlighted preset again clears the filter. */
  protected applyPreset(preset: DateRangePreset): void {
    if (this.activePreset() === preset) {
      this.clear();
      return;
    }
    this.publish(presetDateRange(preset, this.today));
  }

  protected clear(): void {
    this.publish({});
  }

  private commit(): void {
    const range = normalizeDateRange({ from: this.from() || undefined, to: this.to() || undefined });
    if (isDateRangeInverted(range)) {
      this.invalid.set(true);
      return;
    }
    this.invalid.set(false);
    this.publish(range);
  }

  private publish(range: CustomerDateFilter): void {
    const next = normalizeDateRange(range);
    if (sameDateRange(next, this.value())) return;
    this.value.set(next);
  }
}
