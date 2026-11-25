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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, catchError, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { extractCalendarDate, localCalendarToday } from '../../../../core/utils/calendar-date.util';
import { cairoToday } from '../../../../core/utils/cairo-time.util';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { SearchableSelectComponent } from '../../../../shared/components/searchable-select/searchable-select.component';
import {
  CONTRACT_STATUSES,
  ContractListItem,
  ContractStatus,
  CreateContractRequest,
  UpdateContractRequest,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ContractsService } from '../../services/contracts.service';

/**
 * Create / edit a contract — shared modal dialog (no route).
 *
 * The host owns visibility (`@if`) and reacts to `created` / `updated`.
 * In edit mode the customer is locked (the `UpdateContract` endpoint only
 * accepts title / description / status / price / dates — it can't reassign
 * the customer).
 */
@Component({
  selector: 'app-contract-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    ModalComponent,
    FormErrorComponent,
    SearchableSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contract-form-dialog.component.html',
  styleUrl: './contract-form-dialog.component.scss',
})
export class ContractFormDialogComponent implements OnInit {
  /** When set, the dialog loads + updates that contract (edit mode). */
  @Input() contractId: number | null = null;
  /**
   * Create mode only: pre-selects this customer and starts the contract
   * today — used when a customer has just been marked as Buyer.
   */
  @Input() presetCustomerId: number | null = null;

  @Output() created = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ContractsService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly statuses = CONTRACT_STATUSES;
  readonly loadingContract = signal(false);

  readonly customersFetchFn = (): Observable<Record<string, unknown>[]> =>
    this.service.customersDropdown() as unknown as Observable<Record<string, unknown>[]>;
  readonly submitting = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  /**
   * Create mode: an active contract the picked customer already has — a hint
   * to renew it instead. Never blocks submit; the server 400 is authoritative.
   */
  readonly existingActive = signal<ContractListItem | null>(null);
  /** Edit mode: status as loaded, so a rejected switch to Active can be undone. */
  private loadedStatus: ContractStatus | null = null;

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    customerId: this.fb.nonNullable.control<number | null>(
      null,
      Validators.required,
    ),
    status: this.fb.nonNullable.control<ContractStatus>('Active', Validators.required),
    price: this.fb.nonNullable.control<number | null>(null, [
      Validators.required,
      Validators.min(0),
    ]),
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
  });

  get isEditMode(): boolean {
    return this.contractId !== null;
  }

  readonly titleKey = computed(() =>
    this.isEditMode
      ? 'sales.contractsMgmt.form.editTitle'
      : 'sales.contractsMgmt.form.title',
  );

  /** True when the dialog was opened right after a customer became a buyer. */
  get isNewBuyerFlow(): boolean {
    return !this.isEditMode && this.presetCustomerId !== null;
  }

  ngOnInit(): void {
    if (this.contractId !== null) {
      this.loadContract(this.contractId);
      return;
    }
    if (this.presetCustomerId !== null) {
      this.form.patchValue({
        customerId: this.presetCustomerId,
        startDate: localCalendarToday(),
      });
    }
    this.watchActiveContract();
  }

  /**
   * Create mode only: after a customer is picked, look up an active contract
   * of theirs (`GetContracts?search=<name>&status=Active`, filtered to the
   * same `customerId` and a non-past end date). Failures just hide the hint.
   */
  private watchActiveContract(): void {
    const ctrl = this.form.controls.customerId;
    ctrl.valueChanges
      .pipe(
        startWith(ctrl.value),
        map((id) => (id === null || id === undefined ? null : Number(id))),
        distinctUntilChanged(),
        switchMap((id) => {
          this.existingActive.set(null);
          if (!id) return of(null);
          return this.service.customersDropdown().pipe(
            map((rows) => (Array.isArray(rows) ? rows : []).find((r) => Number(r.id) === id)),
            switchMap((customer) => {
              const search = customer?.fullName?.trim();
              if (!search) return of(null);
              return this.service
                .list({ pageIndex: 1, pageSize: 10, search, status: 'Active' }, true, true)
                .pipe(map((page) => this.findActive(page.data, id)));
            }),
            catchError(() => of(null)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((row) => this.existingActive.set(row ?? null));
  }

  private findActive(rows: ContractListItem[], customerId: number): ContractListItem | null {
    const today = cairoToday();
    return (
      rows.find((r) => {
        if (Number(r.customerId) !== customerId || r.status !== 'Active') return false;
        const end = extractCalendarDate(r.endDate);
        return !end || end >= today;
      }) ?? null
    );
  }

  private loadContract(id: number): void {
    this.loadingContract.set(true);
    this.loadError.set(null);
    this.service.getById(id).subscribe({
      next: (c) => {
        this.form.patchValue({
          title: c.title,
          description: c.description ?? '',
          customerId: c.customerId,
          status: c.status,
          price: c.price,
          startDate: this.toDateInput(c.startDate),
          endDate: this.toDateInput(c.endDate),
        });
        this.loadedStatus = c.status;
        // Customer can't change on edit — lock it.
        this.form.controls.customerId.disable();
        this.loadingContract.set(false);
      },
      error: () => {
        this.loadingContract.set(false);
        this.loadError.set(this.t('sales.contractsMgmt.form.loadFailed'));
      },
    });
  }

  retryLoad(): void {
    if (this.contractId !== null) this.loadContract(this.contractId);
  }

  submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    this.submitting.set(true);
    this.errorMessage.set(null);

    if (this.contractId !== null) {
      const payload: UpdateContractRequest = {
        title: (v.title ?? '').trim(),
        description: (v.description ?? '').trim(),
        status: v.status,
        price: Number(v.price) || 0,
        startDate: this.toIso(v.startDate),
        endDate: this.toIso(v.endDate),
      };
      this.service.update(this.contractId, payload).subscribe({
        next: () => {
          this.submitting.set(false);
          this.toast.success(this.t('sales.contractsMgmt.messages.updated'));
          this.loadedStatus = payload.status;
          this.updated.emit();
        },
        error: (err: ApiError) => {
          this.submitting.set(false);
          // Rejected switch to Active (customer already has an active
          // contract) — put the status back to what it was.
          if (
            err?.status === 400 &&
            payload.status === 'Active' &&
            this.loadedStatus !== null &&
            this.loadedStatus !== 'Active'
          ) {
            this.form.controls.status.setValue(this.loadedStatus);
          }
          this.showError(err);
        },
      });
      return;
    }

    const payload: CreateContractRequest = {
      title: (v.title ?? '').trim(),
      description: (v.description ?? '').trim(),
      customerId: Number(v.customerId),
      status: v.status,
      price: Number(v.price) || 0,
      startDate: this.toIso(v.startDate),
      endDate: this.toIso(v.endDate),
    };
    this.service.create(payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(this.t('sales.contractsMgmt.messages.created'));
        this.created.emit();
      },
      error: (err: ApiError) => {
        // Form stays filled and the dialog open — just surface the reason.
        this.submitting.set(false);
        this.showError(err);
      },
    });
  }

  /** Server message as-is (inline + toast — the alert sits below a long form). */
  private showError(err: ApiError): void {
    const message = err?.message?.trim() || this.t('common.loadFailed');
    this.errorMessage.set(message);
    this.toast.error(message);
  }

  isInvalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }

  /** ISO date-time → `yyyy-MM-dd` for `<input type="date">`. */
  private toDateInput(value: string | null | undefined): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  private toIso(date: string): string {
    if (!date) return new Date().toISOString();
    return new Date(`${date}T00:00:00`).toISOString();
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
