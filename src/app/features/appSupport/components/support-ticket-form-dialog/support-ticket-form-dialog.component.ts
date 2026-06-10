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
import { Observable } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import {
  SearchableSelectComponent,
} from '../../../../shared/components/searchable-select/searchable-select.component';
import {
  CreateSupportTicketRequest,
  CustomerDropdownItem,
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_TICKET_STATUSES,
  SupportTicketPriority,
  SupportTicketStatus,
  UpdateSupportTicketRequest,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { SupportTicketsService } from '../../services/support-tickets.service';

/**
 * Create / edit a support ticket — shared modal dialog (no route).
 *
 * The host owns visibility (`@if`) and reacts to `created` / `updated`.
 * In edit mode the customer is locked: `UpdateTicket` only accepts
 * title / description / serviceId / priority / status (no `customerId`).
 *
 * Service picker is scoped to the selected customer: once a customer is
 * chosen, `SupportTickets/CustomerServices/{id}` is called and only the
 * services that customer is subscribed to appear in the picker.
 */
@Component({
  selector: 'app-support-ticket-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    ModalComponent,
    FormErrorComponent,
    SearchableSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './support-ticket-form-dialog.component.html',
  styleUrl: './support-ticket-form-dialog.component.scss',
})
export class SupportTicketFormDialogComponent implements OnInit {
  /** When set, the dialog loads + updates that ticket (edit mode). */
  @Input() ticketId: number | null = null;

  @Output() created = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly service = inject(SupportTicketsService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  /** True while the selected status is `Open` — the follow-up date is then shown + required. */
  readonly requiresFollowUp = signal(false);

  readonly priorities = SUPPORT_TICKET_PRIORITIES;
  readonly statuses = SUPPORT_TICKET_STATUSES;

  readonly loadingTicket = signal(false);
  readonly submitting = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  /** Services belonging to the currently selected customer. */
  readonly serviceItems = signal<{ id: number; name: string }[]>([]);
  readonly loadingServices = signal(false);

  /** Cast to `Record[]` so SearchableSelect's `[options]` input is satisfied. */
  readonly serviceOptionsAsRecords = computed(
    () => this.serviceItems() as unknown as Record<string, unknown>[],
  );

  // ─── Fetch function for customer picker ─────────────────────
  /** Non-paginated: returns all customers in one call. */
  readonly customersFetchFn = (): Observable<Record<string, unknown>[]> =>
    this.service.customersDropdown() as unknown as Observable<Record<string, unknown>[]>;

  // ─── Form ────────────────────────────────────────────────────

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.required, Validators.minLength(3)]],
    customerId: this.fb.nonNullable.control<number | null>(
      null,
      Validators.required,
    ),
    serviceId: this.fb.nonNullable.control<number | null>(
      null,
      Validators.required,
    ),
    priority: [SupportTicketPriority.Medium as number, Validators.required],
    status: [SupportTicketStatus.Open as number, Validators.required],
    // Bound to a <input type="datetime-local">; validators toggled by status.
    nextFollowUpDate: this.fb.nonNullable.control<string>(''),
  });

  get isEditMode(): boolean {
    return this.ticketId !== null;
  }

  readonly titleKey = computed(() =>
    this.isEditMode
      ? 'support.tickets.form.editTitle'
      : 'support.tickets.form.title',
  );

  ngOnInit(): void {
    // Keep the follow-up field's visibility + required rule in sync with status.
    this.form.controls.status.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => this.applyFollowUpRule(Number(status)));
    this.applyFollowUpRule(this.form.controls.status.value);

    // Reload services whenever the customer changes (create mode only).
    // Also reset the selected serviceId so the user picks from the new list.
    this.form.controls.customerId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((customerId) => {
        if (customerId) {
          this.form.controls.serviceId.setValue(null, { emitEvent: false });
          this.loadCustomerServices(customerId as number);
        } else {
          this.serviceItems.set([]);
        }
      });

    if (this.ticketId !== null) this.loadTicket(this.ticketId);
  }

  /**
   * Fetch the services a specific customer is subscribed to.
   * Called on customer selection change and when loading an existing ticket.
   */
  private loadCustomerServices(customerId: number): void {
    this.loadingServices.set(true);
    this.service
      .customerServices(customerId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.serviceItems.set(items ?? []);
          this.loadingServices.set(false);
        },
        error: () => this.loadingServices.set(false),
      });
  }

  /**
   * `Open` tickets must carry a next-follow-up date — show + require the field.
   * For any other status the field is hidden and cleared (the backend wants
   * `null`, never an empty string).
   */
  private applyFollowUpRule(status: number): void {
    const ctrl = this.form.controls.nextFollowUpDate;
    if (status === SupportTicketStatus.Open) {
      this.requiresFollowUp.set(true);
      ctrl.setValidators(Validators.required);
    } else {
      this.requiresFollowUp.set(false);
      ctrl.clearValidators();
      if (ctrl.value) ctrl.setValue('', { emitEvent: false });
    }
    ctrl.updateValueAndValidity({ emitEvent: false });
  }

  /** ISO timestamp → the `YYYY-MM-DDTHH:mm` shape `datetime-local` expects. */
  private toLocalInput(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private loadTicket(id: number): void {
    this.loadingTicket.set(true);
    this.loadError.set(null);
    this.service.getById(id).subscribe({
      next: (t) => {
        const priority = this.toPriorityValue(t.priority, t.priorityName);
        const status = this.toStatusValue(t.status, t.statusName);

        // Load the customer's services first; patch serviceId once options arrive.
        this.loadCustomerServices(t.customerId);

        this.form.patchValue({
          title: t.title,
          description: t.description ?? '',
          customerId: t.customerId,
          serviceId: t.serviceId,
          priority,
          status,
        });
        if (status === SupportTicketStatus.Open && t.nextFollowUpDate) {
          this.form.controls.nextFollowUpDate.setValue(
            this.toLocalInput(t.nextFollowUpDate),
          );
        }
        // Customer can't be reassigned on edit — lock it.
        this.form.controls.customerId.disable();
        this.loadingTicket.set(false);
      },
      error: () => {
        this.loadingTicket.set(false);
        this.loadError.set(this.t('support.tickets.form.loadFailed'));
      },
    });
  }

  retryLoad(): void {
    if (this.ticketId !== null) this.loadTicket(this.ticketId);
  }

  /** Normalize a backend priority (number or enum name) to its numeric value. */
  private toPriorityValue(
    raw: unknown,
    name?: string | null,
  ): SupportTicketPriority {
    if (typeof raw === 'number') return raw;
    const key = String(raw ?? name ?? '').toLowerCase();
    return (
      SUPPORT_TICKET_PRIORITIES.find((p) => p.enumName.toLowerCase() === key)
        ?.value ?? SupportTicketPriority.Medium
    );
  }

  private toStatusValue(
    raw: unknown,
    name?: string | null,
  ): SupportTicketStatus {
    if (typeof raw === 'number') return raw;
    const key = String(raw ?? name ?? '').toLowerCase();
    return (
      SUPPORT_TICKET_STATUSES.find((s) => s.enumName.toLowerCase() === key)
        ?.value ?? SupportTicketStatus.Open
    );
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

    const nextFollowUpDate =
      Number(v.status) === SupportTicketStatus.Open && v.nextFollowUpDate
        ? new Date(v.nextFollowUpDate).toISOString()
        : null;

    if (this.ticketId !== null) {
      const payload: UpdateSupportTicketRequest = {
        title: (v.title ?? '').trim(),
        description: (v.description ?? '').trim(),
        serviceId: Number(v.serviceId),
        priority: Number(v.priority) as SupportTicketPriority,
        status: Number(v.status) as SupportTicketStatus,
        nextFollowUpDate,
      };
      this.service.update(this.ticketId, payload).subscribe({
        next: () => {
          this.submitting.set(false);
          this.toast.success(this.t('support.tickets.messages.updated'));
          this.updated.emit();
        },
        error: (err: ApiError) => {
          this.submitting.set(false);
          this.errorMessage.set(err?.message ?? this.t('common.loadFailed'));
        },
      });
      return;
    }

    const payload: CreateSupportTicketRequest = {
      title: (v.title ?? '').trim(),
      description: (v.description ?? '').trim(),
      customerId: Number(v.customerId),
      serviceId: Number(v.serviceId),
      priority: Number(v.priority) as SupportTicketPriority,
      status: Number(v.status) as SupportTicketStatus,
      nextFollowUpDate,
    };
    this.service.create(payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(this.t('support.tickets.messages.created'));
        this.created.emit();
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.message ?? this.t('common.loadFailed'));
      },
    });
  }

  isInvalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
