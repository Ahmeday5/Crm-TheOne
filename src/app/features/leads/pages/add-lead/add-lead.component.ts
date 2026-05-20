import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
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
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { AuthService } from '../../../../core/services/auth.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import {
  AppService,
  CampaignDropdownItem,
  PagedResult,
  SalesPerson,
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './add-lead.component.html',
  styleUrl: './add-lead.component.scss',
})
export class AddLeadComponent {
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly customers = inject(CustomersService);
  private readonly servicesApi = inject(ServicesService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly auth = inject(AuthService);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly submitAttempted = signal(false);

  readonly campaigns = signal<CampaignDropdownItem[]>([]);
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
    email: ['', [Validators.required, Validators.email, Validators.maxLength(120)]],
    companyName: ['', [Validators.maxLength(120)]],
    notes: ['', [Validators.maxLength(500)]],
    campaignId: [null as number | null, [Validators.required]],
    serviceIds: this.fb.nonNullable.control<number[]>([], [minSelected(1)]),
  });

  readonly servicesControl = this.form.controls.serviceIds as FormControl<number[]>;

  readonly selectedServiceIds = computed(() => new Set(this.servicesControl.value));

  ngOnInit(): void {
    this.loadDropdowns();
  }

  private loadDropdowns(): void {
    this.customers.campaignsDropdown().subscribe({
      next: (items) => this.campaigns.set(items),
    });
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

  // ─────────── save only ───────────

  saveOnly(): void {
    if (this.submitting()) return;
    this.submitAttempted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning(this.t('customers.messages.validationFailed'));
      return;
    }

    this.submitCustomer(false, null);
  }

  // ─────────── save & assign ───────────

  openSalesModal(): void {
    this.submitAttempted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning(this.t('customers.messages.validationFailed'));
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
    this.submitCustomer(true, this.selectedSalesPersonId);
  }

  // ─────────── submit ───────────

  private submitCustomer(assignToSales: boolean, salesPersonId: string | null): void {
    const v = this.form.getRawValue();
    const payload = {
      fullName: v.fullName.trim(),
      email: v.email.trim(),
      phone: v.phone.trim(),
      companyName: v.companyName.trim(),
      notes: v.notes.trim(),
      campaignId: v.campaignId,
      serviceIds: v.serviceIds,
      assignToSalesTeam: assignToSales,
      salesPersonId: assignToSales ? salesPersonId : 'null',
    };

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.customers.create(payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(
          assignToSales
            ? this.t('customers.messages.assigned')
            : this.t('customers.messages.created'),
        );
        this.goBack();
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
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
