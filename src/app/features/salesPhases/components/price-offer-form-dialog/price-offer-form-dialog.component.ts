import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import {
  AppService,
  CustomerDropdownItem,
  PriceQuotationRequest,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ServicesService } from '../../../services/services/services.service';
import { PriceQuotationsService } from '../../services/price-quotations.service';

interface ItemSeed {
  serviceId: number;
  serviceName: string;
  unitPrice: number;
  quantity: number;
}

/**
 * Create / edit a price quotation — shared modal dialog (no route).
 *
 * The host owns visibility (`@if`) and reacts to `created` / `updated`.
 * Picking a customer seeds the line-items grid from that customer's
 * services; the operator can additionally append any service from the full
 * catalogue (services the customer isn't linked to yet) and price it into
 * this quotation. Only `serviceId` / `unitPrice` / `quantity` are sent.
 */
@Component({
  selector: 'app-price-offer-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslatePipe,
    ModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './price-offer-form-dialog.component.html',
  styleUrl: './price-offer-form-dialog.component.scss',
})
export class PriceOfferFormDialogComponent implements OnInit {
  /** When set, the dialog loads + updates that quotation (edit mode). */
  @Input() quotationId: number | null = null;

  @Output() created = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly service = inject(PriceQuotationsService);
  private readonly servicesApi = inject(ServicesService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly customers = signal<CustomerDropdownItem[]>([]);
  readonly catalogue = signal<AppService[]>([]);
  readonly loadingCustomers = signal(false);
  readonly loadingQuote = signal(false);
  readonly submitting = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  /** Service selected in the "add another service" picker. */
  readonly extraServiceId = signal<number | null>(null);

  /** Live form snapshot — drives derived totals under OnPush. */
  private readonly snapshot = signal(0);
  private rebuildSuppressed = false;

  readonly form = this.fb.nonNullable.group({
    customerId: this.fb.nonNullable.control<number | null>(
      null,
      Validators.required,
    ),
    discount: this.fb.nonNullable.control<number>(0, [Validators.min(0)]),
    notes: this.fb.nonNullable.control<string>(''),
    items: this.fb.nonNullable.array<FormGroup>([]),
  });

  get items(): FormArray<FormGroup> {
    return this.form.controls.items;
  }

  get isEditMode(): boolean {
    return this.quotationId !== null;
  }

  /** Catalogue services not already in the grid — the picker's options. */
  readonly availableExtras = computed(() => {
    this.snapshot();
    const used = new Set(
      this.items.controls.map((g) => Number(g.get('serviceId')?.value)),
    );
    return this.catalogue().filter((s) => !used.has(s.id));
  });

  readonly subTotal = computed(() => {
    this.snapshot();
    return this.items.controls.reduce((sum, g) => {
      const price = Number(g.get('unitPrice')?.value) || 0;
      const qty = Number(g.get('quantity')?.value) || 0;
      return sum + price * qty;
    }, 0);
  });

  readonly netTotal = computed(() => {
    const discount = Number(this.form.controls.discount.value) || 0;
    return Math.max(0, this.subTotal() - discount);
  });

  ngOnInit(): void {
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.snapshot.update((n) => n + 1));

    this.form.controls.customerId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => {
        if (this.rebuildSuppressed) return;
        this.rebuildItemsFor(id == null ? null : Number(id));
      });

    this.loadCustomers();
    this.loadCatalogue();

    if (this.quotationId !== null) this.loadQuote(this.quotationId);
  }

  // ─────────── data ───────────

  private loadCustomers(): void {
    this.loadingCustomers.set(true);
    this.service.customersDropdown().subscribe({
      next: (rows) => {
        this.customers.set(rows ?? []);
        this.loadingCustomers.set(false);
      },
      error: () => this.loadingCustomers.set(false),
    });
  }

  private loadCatalogue(): void {
    // One generous page — the catalogue is small and reused as a picker.
    this.servicesApi.list({ pageIndex: 1, pageSize: 500 }).subscribe({
      next: (page) => this.catalogue.set(page.data ?? []),
    });
  }

  private loadQuote(id: number): void {
    this.loadingQuote.set(true);
    this.loadError.set(null);
    this.service.getById(id).subscribe({
      next: (quote) => {
        this.rebuildSuppressed = true;
        this.form.patchValue({
          customerId: quote.customerId,
          discount: quote.discount ?? 0,
          notes: quote.notes ?? '',
        });
        this.rebuildSuppressed = false;
        this.items.clear();
        for (const item of quote.items ?? []) {
          this.items.push(
            this.buildItem({
              serviceId: item.serviceId,
              serviceName: item.serviceName,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
            }),
          );
        }
        this.loadingQuote.set(false);
      },
      error: () => {
        this.loadingQuote.set(false);
        this.loadError.set(this.t('sales.priceOffers.form.loadFailed'));
      },
    });
  }

  retryLoad(): void {
    if (this.quotationId !== null) this.loadQuote(this.quotationId);
  }

  // ─────────── customer → services ───────────

  private rebuildItemsFor(customerId: number | null): void {
    this.items.clear();
    if (customerId === null) return;
    const customer = this.customers().find((c) => c.id === customerId);
    for (const svc of customer?.services ?? []) {
      this.items.push(
        this.buildItem({
          serviceId: svc.id,
          serviceName: svc.name,
          unitPrice: 0,
          quantity: 1,
        }),
      );
    }
  }

  /** Append a catalogue service the customer isn't linked to. */
  addExtraService(): void {
    const id = this.extraServiceId();
    if (id == null) return;
    const svc = this.catalogue().find((s) => s.id === id);
    if (!svc) return;
    const exists = this.items.controls.some(
      (g) => Number(g.get('serviceId')?.value) === id,
    );
    if (exists) return;
    this.items.push(
      this.buildItem({
        serviceId: svc.id,
        serviceName: this.serviceName(svc),
        unitPrice: 0,
        quantity: 1,
      }),
    );
    this.extraServiceId.set(null);
  }

  private buildItem(value: ItemSeed): FormGroup {
    return this.fb.nonNullable.group({
      serviceId: [value.serviceId],
      serviceName: [value.serviceName],
      unitPrice: [value.unitPrice, [Validators.required, Validators.min(0)]],
      quantity: [value.quantity, [Validators.required, Validators.min(1)]],
    });
  }

  removeItem(index: number): void {
    this.items.removeAt(index);
  }

  lineTotal(group: FormGroup): number {
    const price = Number(group.get('unitPrice')?.value) || 0;
    const qty = Number(group.get('quantity')?.value) || 0;
    return price * qty;
  }

  serviceName(svc: AppService): string {
    return this.language.lang() === 'ar'
      ? svc.nameAr || svc.nameEn
      : svc.nameEn || svc.nameAr;
  }

  // ─────────── submit ───────────

  submit(): void {
    if (this.submitting()) return;
    if (this.form.controls.customerId.invalid || this.items.length === 0) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: PriceQuotationRequest = {
      customerId: Number(raw.customerId),
      discount: Number(raw.discount) || 0,
      notes: (raw.notes ?? '').trim(),
      items: this.items.controls.map((g) => ({
        serviceId: Number(g.get('serviceId')?.value),
        unitPrice: Number(g.get('unitPrice')?.value) || 0,
        quantity: Number(g.get('quantity')?.value) || 0,
      })),
    };

    this.submitting.set(true);
    this.errorMessage.set(null);

    const id = this.quotationId;
    const request$ =
      id !== null
        ? this.service.update(id, payload)
        : this.service.create(payload);
    const successKey =
      id !== null
        ? 'sales.priceOffers.messages.updated'
        : 'sales.priceOffers.messages.created';
    const emitter = id !== null ? this.updated : this.created;

    request$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(this.t(successKey));
        emitter.emit();
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.message ?? this.t('common.loadFailed'));
      },
    });
  }

  // ─────────── helpers ───────────

  formatMoney(value: number | null | undefined): string {
    if (value == null) return '0';
    return value.toLocaleString(
      this.language.lang() === 'ar' ? 'ar-EG' : 'en-US',
      { maximumFractionDigits: 2 },
    );
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
