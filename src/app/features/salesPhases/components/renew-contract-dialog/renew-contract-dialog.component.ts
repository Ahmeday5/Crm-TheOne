import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { cairoToday } from '../../../../core/utils/cairo-time.util';
import { extractCalendarDate } from '../../../../core/utils/calendar-date.util';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { ContractDetail, ContractListItem, RENEWAL_NOTES_MAX, RenewContractResponse } from '../../../../shared/models';
import { MoneyPipe } from '../../../../shared/pipes/money.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ContractsService } from '../../services/contracts.service';
import {
  RenewalError,
  buildRenewRequest,
  defaultRenewalStart,
  formatContractDay,
  monthsBetween,
  quickEndDate,
  validateRenewal,
} from '../../utils/contract-renewal.util';

type RenewableContract = Pick<ContractDetail | ContractListItem, 'id' | 'title' | 'customerName' | 'status' | 'startDate' | 'endDate' | 'price'>;

/**
 * Renew a contract: new end date (required; +6 months / +1 year quick
 * picks), start date (prefilled with the backend default), price (prefilled)
 * and notes. Extends the same contract; the old period goes to history.
 */
@Component({
  selector: 'app-renew-contract-dialog',
  standalone: true,
  imports: [FormsModule, DecimalPipe, TranslatePipe, MoneyPipe, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './renew-contract-dialog.component.html',
  styleUrl: './renew-contract-dialog.component.scss',
})
export class RenewContractDialogComponent implements OnInit {
  private readonly service = inject(ContractsService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly contract = input.required<RenewableContract>();
  readonly renewed = output<RenewContractResponse>();
  readonly cancel = output<void>();

  protected readonly notesMax = RENEWAL_NOTES_MAX;
  protected readonly today = cairoToday();
  protected readonly quickPicks: readonly { months: number; key: string }[] = [
    { months: 6, key: 'sales.renewal.plus6Months' },
    { months: 12, key: 'sales.renewal.plusYear' },
  ];

  protected readonly newEndDate = signal('');
  protected readonly newStartDate = signal('');
  protected readonly newPrice = signal<number | null>(null);
  protected readonly notes = signal('');
  protected readonly submitting = signal(false);
  protected readonly submitAttempted = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly currentEnd = computed(() => extractCalendarDate(this.contract().endDate));
  protected readonly currentStart = computed(() => extractCalendarDate(this.contract().startDate));

  protected readonly draft = computed(() => ({
    newEndDate: this.newEndDate(),
    newStartDate: this.newStartDate(),
    newPrice: this.newPrice(),
    notes: this.notes(),
  }));

  protected readonly errors = computed<RenewalError[]>(() => validateRenewal(this.contract(), this.draft(), this.today));
  protected readonly visibleErrors = computed(() =>
    this.errors().filter((e) => this.submitAttempted() || (e !== 'endRequired' && !!this.newEndDate()) || e === 'cancelled'),
  );

  /** Earliest valid end: the day after today / the current end. */
  protected readonly minEnd = computed(() => {
    const end = this.currentEnd();
    return end && end >= this.today ? end : this.today;
  });

  protected readonly durationMonths = computed(() => {
    const start = this.newStartDate() || defaultRenewalStart(this.contract(), this.today);
    const end = this.newEndDate();
    return end && start <= end ? monthsBetween(start, end) : null;
  });

  protected readonly priceDelta = computed(() => {
    const price = this.newPrice();
    const old = this.contract().price;
    return price === null || !old ? null : Math.round(((price - old) / old) * 1000) / 10;
  });

  ngOnInit(): void {
    const c = this.contract();
    this.newStartDate.set(defaultRenewalStart(c, this.today));
    this.newPrice.set(c.price ?? null);
    this.newEndDate.set(quickEndDate(c, 12, this.today));
  }

  protected pick(months: number): void {
    this.newEndDate.set(quickEndDate(this.contract(), months, this.today));
  }

  protected isPicked(months: number): boolean {
    return this.newEndDate() === quickEndDate(this.contract(), months, this.today);
  }

  protected onPrice(value: string | number | null): void {
    const n = value === '' || value === null ? null : Number(value);
    this.newPrice.set(n === null || Number.isNaN(n) ? null : n);
  }

  protected submit(): void {
    if (this.submitting()) return;
    this.submitAttempted.set(true);
    if (this.errors().length) return;

    const c = this.contract();
    this.submitting.set(true);
    this.serverError.set(null);
    this.service
      .renew(c.id, buildRenewRequest(c, this.draft(), this.today))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.submitting.set(false);
          this.toast.success(this.t('sales.renewal.success'));
          this.renewed.emit(res);
        },
        error: (err: ApiError) => {
          this.submitting.set(false);
          this.serverError.set(err?.message?.trim() || this.t('sales.renewal.failed'));
        },
      });
  }

  protected day(value: string | null): string {
    return formatContractDay(value, this.language.lang()) ?? this.t('sales.renewal.openEnded');
  }

  protected monthsLabel(n: number): string {
    return interpolate(this.t('sales.renewal.months'), { n });
  }

  protected t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
