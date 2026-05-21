import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { CustomerDetails, CustomerListItem } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CustomersService } from '../../../leads/services/customers.service';
import {
  customerStatusBadgeClass,
  resolveCustomerStatus,
} from '../../../leads/utils/customer-status.util';

/**
 * Support consultation flow (modal, no route).
 *
 * The support agent reviews the customer's profile + the **sales note**, then
 * either:
 *   1. closes without action ("contacted, still needs follow-up"), or
 *   2. returns the customer to their original sales rep via
 *      `POST /Support/{id}/ReturnToSalesPerson` — the rep is resolved
 *      server-side (no picker) and `isConsulted` is flipped to `true`.
 *
 * Company name + the freshest sales note aren't in the list projection, so the
 * dialog loads the full record (`getById`) on open; the passed list row seeds
 * the header instantly while that resolves.
 */
@Component({
  selector: 'app-consultation-dialog',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './consultation-dialog.component.html',
  styleUrl: './consultation-dialog.component.scss',
})
export class ConsultationDialogComponent implements OnInit {
  @Input({ required: true }) customerId!: number;
  /** List row used for instant header display while details load. */
  @Input() customer: CustomerListItem | null = null;

  /** Emitted after a successful ReturnToSalesPerson (host should reload). */
  @Output() assigned = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private readonly customers = inject(CustomersService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly details = signal<CustomerDetails | null>(null);
  readonly loadingDetails = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  /** The sales rep the customer will be returned to (resolved server-side). */
  readonly salesRepName = computed(
    () => this.details()?.salesPersonName || this.customer?.salesPersonName || '',
  );

  // ─────────── derived display values (details first, list row fallback) ───────────

  readonly name = computed(
    () => this.details()?.fullName || this.customer?.fullName || '—',
  );
  readonly phone = computed(
    () => this.details()?.phone || this.customer?.phone || '—',
  );
  readonly company = computed(() => this.details()?.campanyName || '—');
  readonly source = computed(
    () => this.details()?.source || this.customer?.source || '—',
  );
  readonly services = computed(() => {
    const list = this.details()?.services ?? this.customer?.services ?? [];
    return list.map((s) => s.name).join('، ') || '—';
  });
  readonly salesNote = computed(
    () => this.details()?.noteSales || this.customer?.noteSales || '',
  );

  readonly statusRaw = computed(
    () => this.details()?.statusName || this.customer?.status || null,
  );
  readonly statusLabel = computed(() =>
    resolveCustomerStatus(
      this.statusRaw(),
      this.language.lang(),
      this.t('customers.table.unknownStatus'),
    ),
  );
  readonly statusBadge = computed(() =>
    customerStatusBadgeClass(this.statusRaw()),
  );

  ngOnInit(): void {
    this.loadDetails();
  }

  loadDetails(): void {
    this.loadingDetails.set(true);
    this.loadError.set(null);
    this.customers.getById(this.customerId).subscribe({
      next: (d) => {
        this.details.set(d);
        this.loadingDetails.set(false);
      },
      error: () => {
        this.loadingDetails.set(false);
        this.loadError.set(this.t('customers.consultation.loadFailed'));
      },
    });
  }

  /** "Close without returning" — no API call, just close (per spec). */
  saveWithout(): void {
    if (this.submitting()) return;
    this.cancel.emit();
  }

  /** Returns the customer to their original sales rep and ends the consultation. */
  returnToSales(): void {
    if (this.submitting()) return;

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.customers.returnToSalesPerson(this.customerId).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(this.t('customers.consultation.returnedSuccess'));
        this.assigned.emit();
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        const message =
          err?.message?.trim() || this.t('customers.consultation.returnFailed');
        this.errorMessage.set(message);
        this.toast.error(message);
      },
    });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
