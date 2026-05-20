import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  CONTRACT_STATUSES,
  ContractStatusCode,
  CreateContractRequest,
  CustomerDropdownItem,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ContractsService } from '../../services/contracts.service';

@Component({
  selector: 'app-contracts',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './contracts.component.html',
  styleUrl: './contracts.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContractsComponent implements OnInit {
  @Output() created = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ContractsService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly statuses = CONTRACT_STATUSES;

  readonly customers = signal<CustomerDropdownItem[]>([]);
  readonly loadingCustomers = signal(false);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2)]],

    description: [''],

    customerId: this.fb.control<number | null>(
      null,
      Validators.required,
    ),

    status: [ContractStatusCode.Active as number, Validators.required],

    price: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0),
    ]),

    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
  });

  ngOnInit(): void {
    this.loadCustomers();
  }

  private loadCustomers(): void {
    this.loadingCustomers.set(true);

    this.service.customersDropdown().subscribe({
      next: (rows) => {
        this.customers.set(rows ?? []);
        this.loadingCustomers.set(false);
      },
      error: () => {
        this.loadingCustomers.set(false);
      },
    });
  }

  submit(): void {
    if (this.submitting()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();

    const payload: CreateContractRequest = {
      title: (v.title ?? '').trim(),
      description: (v.description ?? '').trim(),
      customerId: Number(v.customerId),
      status: Number(v.status) as ContractStatusCode,
      price: Number(v.price) || 0,
      startDate: this.toIso(v.startDate),
      endDate: this.toIso(v.endDate),
    };

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.service.create(payload).subscribe({
      next: () => {
        this.submitting.set(false);

        this.toast.success(
          this.t('sales.contractsMgmt.messages.created'),
        );

        this.form.reset({
          title: '',
          description: '',
          customerId: null,
          status: ContractStatusCode.Active,
          price: null,
          startDate: '',
          endDate: '',
        });

        this.created.emit();
      },
      error: (err: ApiError) => {
        this.submitting.set(false);

        this.errorMessage.set(
          err?.message ??
            this.t('common.loadFailed'),
        );
      },
    });
  }

  isInvalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }

  private toIso(date: string): string {
    if (!date) return new Date().toISOString();
    return new Date(`${date}T00:00:00`).toISOString();
  }

  private t(key: string): string {
    return resolveKey(
      TRANSLATIONS[this.language.lang()],
      key,
    );
  }
}
