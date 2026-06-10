import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import {
  AppService,
  CustomerDetails,
  PagedResult,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  minSelected,
  noWhitespaceValidator,
  phoneValidator,
} from '../../../../shared/utils/custom-validators.util';
import { CustomersService } from '../../services/customers.service';
import { ServicesService } from '../../../services/services/services.service';

@Component({
  selector: 'app-customer-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    ModalComponent,
    FormErrorComponent,
    LoadErrorComponent,
    SearchableSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-edit-dialog.component.html',
  styleUrl: './customer-edit-dialog.component.scss',
})
export class CustomerEditDialogComponent implements OnInit, OnChanges {
  @Input({ required: true }) customerId!: number;
  @Output() saved = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly customers = inject(CustomersService);
  private readonly servicesApi = inject(ServicesService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly submitAttempted = signal(false);

  readonly campaignsFetchFn = (): Observable<Record<string, unknown>[]> =>
    this.customers.campaignsDropdown() as unknown as Observable<Record<string, unknown>[]>;

  readonly servicesList = signal<AppService[]>([]);

  readonly form = this.fb.nonNullable.group({
    name: [
      '',
      [Validators.required, noWhitespaceValidator(), Validators.minLength(2), Validators.maxLength(80)],
    ],
    phone: ['', [Validators.required, phoneValidator()]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(120)]],
    companyName: ['', [Validators.maxLength(120)]],
    address: ['', [Validators.maxLength(200)]],
    notes: ['', [Validators.maxLength(500)]],
    campaignId: [null as number | null, [Validators.required]],
    serviceIds: this.fb.nonNullable.control<number[]>([], [minSelected(1)]),
  });

  readonly servicesControl = this.form.controls.serviceIds as FormControl<number[]>;

  readonly selectedServiceIds = computed(() => new Set(this.servicesControl.value));

  ngOnInit(): void {
    this.loadDropdowns();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('customerId' in changes) {
      this.reload();
    }
  }

  reload(): void {
    this.loadCustomer();
  }

  private loadDropdowns(): void {
    this.servicesApi.list({ pageSize: 100 }).subscribe({
      next: (result: PagedResult<AppService>) =>
        this.servicesList.set(result.data ?? []),
    });
  }

  private loadCustomer(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.loadError.set(null);
    this.customers.getById(this.customerId).subscribe({
      next: (c: CustomerDetails) => {
        this.form.patchValue({
          name: c.fullName ?? '',
          phone: c.phone ?? '',
          email: c.email ?? '',
          companyName: c.campanyName ?? '',
          address: c.address ?? '',
          notes: c.noteMarketing ?? '',
          campaignId: c.campaignId ?? null,
        });
        this.servicesControl.setValue((c.services ?? []).map((s) => s.id));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(this.t('customers.messages.loadCustomerFailed'));
      },
    });
  }

  toggleService(id: number): void {
    const current = this.servicesControl.value ?? [];
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    this.servicesControl.setValue(next);
    this.servicesControl.markAsDirty();
    this.servicesControl.markAsTouched();
  }

  isServiceSelected(id: number): boolean {
    return this.selectedServiceIds().has(id);
  }

  selectedCount(): number {
    return this.servicesControl.value?.length ?? 0;
  }

  servicesCountLabel(): string {
    const tpl = this.t('customers.form.servicesCount');
    return tpl.replace('{n}', String(this.selectedCount()));
  }

  submit(): void {
    if (this.submitting()) return;

    this.submitAttempted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning(this.t('customers.messages.validationFailed'));
      return;
    }

    const v = this.form.getRawValue();
    const payload = {
      name: v.name.trim(),
      phone: v.phone.trim(),
      email: v.email.trim(),
      companyName: v.companyName.trim(),
      address: v.address.trim(),
      notes: v.notes.trim(),
      campaignId: v.campaignId,
      serviceIds: v.serviceIds,
    };

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.customers.update(this.customerId, payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(this.t('customers.messages.updated'));
        this.saved.emit();
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        const message =
          err?.message?.trim() || this.t('customers.messages.updateFailed');
        this.errorMessage.set(message);
        this.toast.error(message);
      },
    });
  }

  serviceName(svc: AppService): string {
    return this.language.isRtl() ? svc.nameAr : svc.nameEn;
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
