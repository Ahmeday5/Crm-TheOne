import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
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

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly campaigns = signal<CampaignDropdownItem[]>([]);
  readonly servicesList = signal<AppService[]>([]);
  readonly salesTeam = signal<SalesPerson[]>([]);
  readonly selectedServiceIds = signal<Set<number>>(new Set());

  /** When true, shows the sales person picker modal. */
  readonly showSalesModal = signal(false);
  selectedSalesPersonId = '';

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required]],
    email: [''],
    companyName: [''],
    notes: [''],
    campaignId: [null as number | null],
  });

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

  serviceName(svc: AppService): string {
    return this.language.isRtl() ? svc.nameAr : svc.nameEn;
  }

  // ─────────── save only ───────────

  saveOnly(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitCustomer(false, null);
  }

  // ─────────── save & assign ───────────

  openSalesModal(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // Load sales team if not loaded
    if (this.salesTeam().length === 0) {
      this.customers.salesTeam().subscribe({
        next: (team) => this.salesTeam.set(team),
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
      serviceIds: Array.from(this.selectedServiceIds()),
      assignToSalesTeam: assignToSales,
      salesPersonId: assignToSales ? salesPersonId : 'null',
    };

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.customers.create(payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(this.t('customers.messages.created'));
        this.goBack();
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.message ?? null);
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/leads/marketing-leadsCustomer']);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
