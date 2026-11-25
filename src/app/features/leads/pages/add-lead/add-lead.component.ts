import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { AuthService } from '../../../../core/services/auth.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import {
  AppService,
  CustomerResponse,
  PagedResult,
  SalesPerson,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  minSelected,
  noWhitespaceValidator,
  phoneValidator,
} from '../../../../shared/utils/custom-validators.util';
import { CustomerLocationFieldsComponent } from '../../components/customer-location-fields/customer-location-fields.component';
import { CustomersService } from '../../services/customers.service';
import {
  DUPLICATE_PHONE_MESSAGES,
  flagDuplicatePhone,
  isDuplicatePhoneError,
} from '../../utils/duplicate-phone.util';
import { createLocationPayload } from '../../utils/customer-location.util';
import { ServicesService } from '../../../services/services/services.service';

/** Values to pre-fill, e.g. from a WhatsApp / Messenger / Instagram chat. */
export interface AddLeadPrefill {
  fullName?: string | null;
  phone?: string | null;
}

@Component({
  selector: 'app-add-lead',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    TranslatePipe,
    PageHeaderComponent,
    FormErrorComponent,
    ModalComponent,
    SearchableSelectComponent,
    CustomerLocationFieldsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './add-lead.component.html',
  styleUrl: './add-lead.component.scss',
})
export class AddLeadComponent {
  /**
   * Embedded mode: the form lives inside a dialog (e.g. "add customer" from a
   * chat). Hides the page chrome, and emits `created` / `cancelled` instead of
   * navigating to the customers list.
   */
  readonly embedded = input(false);
  readonly prefill = input<AddLeadPrefill | null>(null);
  readonly created = output<CustomerResponse>();
  readonly cancelled = output<void>();

  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly customers = inject(CustomersService);
  private readonly servicesApi = inject(ServicesService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly auth = inject(AuthService);

  readonly submitting = signal(false);
  readonly phoneMessages = DUPLICATE_PHONE_MESSAGES;
  readonly errorMessage = signal<string | null>(null);
  readonly submitAttempted = signal(false);

  /** Notes field is hidden for Sales reps — only Marketing and Admin can add notes at creation. */
  readonly showNotesField = computed(() => this.auth.currentRole() !== 'Sales');
  /** A sales rep adding a customer keeps it — "save & assign" skips the picker. */
  readonly isSalesRep = computed(() => this.auth.currentRole() === 'Sales');

  readonly campaignsFetchFn = (): Observable<Record<string, unknown>[]> =>
    this.customers.campaignsDropdown() as unknown as Observable<Record<string, unknown>[]>;

  readonly servicesList = signal<AppService[]>([]);
  readonly salesTeam = signal<SalesPerson[]>([]);
  readonly salesTeamLoading = signal(false);

  /** When true, shows the sales person picker modal. */
  readonly showSalesModal = signal(false);
  selectedSalesPersonId = '';

  readonly form = this.fb.nonNullable.group({
    fullName: [
      '',
      [Validators.required, noWhitespaceValidator(), Validators.minLength(2), Validators.maxLength(80)],
    ],
    phone: ['', [Validators.required, phoneValidator()]],
    /** Optional — chat customers often have no email. */
    email: ['', [Validators.email, Validators.maxLength(120)]],
    companyName: ['', [Validators.maxLength(120)]],
    address: ['', [Validators.maxLength(200)]],
    notes: ['', [Validators.maxLength(500)]],
    campaignId: [null as number | null, [Validators.required]],
    serviceIds: this.fb.nonNullable.control<number[]>([], [minSelected(1)]),
    /** Optional — empty lets the backend infer it from the phone's dial code. */
    countryId: [null as number | null],
    governorateId: [null as number | null],
  });

  readonly servicesControl = this.form.controls.serviceIds as FormControl<number[]>;

  readonly selectedServiceIds = computed(() => new Set(this.servicesControl.value));

  ngOnInit(): void {
    const pre = this.prefill();
    if (pre) {
      this.form.patchValue({
        fullName: pre.fullName?.trim() ?? '',
        phone: pre.phone?.trim() ?? '',
      });
    }
    this.loadDropdowns();
  }

  private loadDropdowns(): void {
    this.servicesApi.list({ pageSize: 100 }).subscribe({
      next: (result: PagedResult<AppService>) => this.servicesList.set(result.data ?? []),
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
    return this.t('customers.form.servicesCount').replace('{n}', String(this.selectedCount()));
  }

  serviceName(svc: AppService): string {
    return this.language.isRtl() ? svc.nameAr : svc.nameEn;
  }

  // ─────────── save & assign (the only way to save) ───────────

  /**
   * Every new customer is assigned to a sales rep on creation — there is no
   * plain "save". Sales reps get themselves; Admin / Marketing pick a rep.
   */
  openSalesModal(): void {
    if (this.submitting()) return;
    this.submitAttempted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning(this.t('customers.messages.validationFailed'));
      return;
    }

    // Sales rep: assign straight to themselves, no rep picker.
    const myId = this.auth.currentUser()?.userId;
    if (this.isSalesRep() && myId) {
      this.submitCustomer(myId);
      return;
    }

    if (this.salesTeam().length === 0) {
      this.salesTeamLoading.set(true);
      this.customers.salesTeam().subscribe({
        next: (team) => {
          this.salesTeam.set(team);
          this.salesTeamLoading.set(false);
        },
        error: () => this.salesTeamLoading.set(false),
      });
    }
    this.showSalesModal.set(true);
  }

  closeSalesModal(): void {
    this.showSalesModal.set(false);
    this.selectedSalesPersonId = '';
  }

  confirmSalesAssign(): void {
    if (!this.selectedSalesPersonId) return;
    this.showSalesModal.set(false);
    this.submitCustomer(this.selectedSalesPersonId);
  }

  // ─────────── submit ───────────

  private submitCustomer(salesPersonId: string): void {
    const v = this.form.getRawValue();
    const company = v.companyName.trim();
    const payload = {
      fullName: v.fullName.trim(),
      email: v.email.trim(),
      phone: v.phone.trim(),
      companyName: company,
      // The Customers API is inconsistent about the spelling: reads return the
      // misspelled `campanyName`. Send both so the company name persists
      // regardless of which key the create endpoint binds.
      campanyName: company,
      address: v.address.trim(),
      notes: v.notes.trim(),
      campaignId: v.campaignId,
      serviceIds: v.serviceIds,
      assignToSalesTeam: true,
      salesPersonId,
      ...createLocationPayload({ countryId: v.countryId, governorateId: v.governorateId }),
    };

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.customers.create(payload).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.toast.success(this.t('customers.messages.assigned'));
        if (this.embedded()) this.created.emit(res);
        else this.goBack();
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        // Phone already used by another customer: keep the form open with the
        // server message under the phone field instead of a toast.
        if (isDuplicatePhoneError(err)) {
          flagDuplicatePhone(this.form.controls.phone, err.message.trim());
          document.getElementById('add-phone')?.focus();
          return;
        }
        const message =
          err?.message?.trim() || this.t('customers.messages.genericError');
        this.errorMessage.set(message);
        this.toast.error(message);
      },
    });
  }

  /**
   * Returns to the role-appropriate leads list. Sales reps don't have
   * access to the marketing list, so a hard-coded redirect would bounce
   * them off `roleGuard` and back to login.
   */
  cancel(): void {
    if (this.embedded()) this.cancelled.emit();
    else this.goBack();
  }

  goBack(): void {
    const target =
      this.auth.currentRole() === 'Sales'
        ? '/leads/sales-leadsCustomer'
        : '/leads/marketing-leadsCustomer';
    this.router.navigate([target]);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
