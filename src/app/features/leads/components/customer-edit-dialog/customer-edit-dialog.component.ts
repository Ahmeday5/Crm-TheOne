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
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import {
  AppService,
  CampaignDropdownItem,
  CustomerDetails,
  PagedResult,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
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

  readonly campaigns = signal<CampaignDropdownItem[]>([]);
  readonly servicesList = signal<AppService[]>([]);
  readonly selectedServiceIds = signal<Set<number>>(new Set());

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required]],
    email: [''],
    companyName: [''],
    notes: [''],
    campaignId: [null as number | null],
  });

  ngOnInit(): void {
    this.loadDropdowns();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('customerId' in changes) {
      this.loadCustomer();
    }
  }

  private loadDropdowns(): void {
    this.customers.campaignsDropdown().subscribe({
      next: (items) => this.campaigns.set(items),
    });
    this.servicesApi.list({ pageSize: 100 }).subscribe({
      next: (result: PagedResult<AppService>) => this.servicesList.set(result.data ?? []),
    });
  }

  private loadCustomer(): void {
    this.loading.set(true);
    this.customers.getById(this.customerId).subscribe({
      next: (c: CustomerDetails) => {
        this.form.patchValue({
          name: c.name ?? '',
          phone: c.phone ?? '',
          email: c.email ?? '',
          companyName: c.companyName ?? '',
          notes: c.notes ?? '',
          campaignId: c.campaignId ?? null,
        });
        this.selectedServiceIds.set(new Set(c.serviceIds ?? []));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggleService(id: number): void {
    this.selectedServiceIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  isServiceSelected(id: number): boolean {
    return this.selectedServiceIds().has(id);
  }

  submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const payload = {
      name: v.name.trim(),
      phone: v.phone.trim(),
      email: v.email.trim(),
      companyName: v.companyName.trim(),
      notes: v.notes.trim(),
      campaignId: v.campaignId,
      serviceIds: Array.from(this.selectedServiceIds()),
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
        this.errorMessage.set(err?.message ?? null);
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
