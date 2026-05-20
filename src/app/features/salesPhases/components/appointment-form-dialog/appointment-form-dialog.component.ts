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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import {
  APPOINTMENT_PRIORITIES,
  APPOINTMENT_TYPES,
  AppointmentAssignee,
  AppointmentCustomerOption,
  AppointmentPriority,
  AppointmentRequest,
  AppointmentType,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AppointmentsService } from '../../services/appointments.service';

/**
 * Create / edit an appointment — shared modal dialog (no route).
 *
 * The host owns visibility (`@if`) and reacts to `created` / `updated`.
 * Status is intentionally absent: the backend owns the lifecycle and the
 * create/update body only carries scheduling fields.
 */
@Component({
  selector: 'app-appointment-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    ModalComponent,
    FormErrorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './appointment-form-dialog.component.html',
  styleUrl: './appointment-form-dialog.component.scss',
})
export class AppointmentFormDialogComponent implements OnInit {
  /** When set, the dialog loads + updates that appointment (edit mode). */
  @Input() appointmentId: number | null = null;

  @Output() created = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AppointmentsService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly types = APPOINTMENT_TYPES;
  readonly priorities = APPOINTMENT_PRIORITIES;

  readonly users = signal<AppointmentAssignee[]>([]);
  readonly customers = signal<AppointmentCustomerOption[]>([]);
  readonly loadingUsers = signal(false);
  readonly loadingCustomers = signal(false);
  readonly loadingAppointment = signal(false);
  readonly submitting = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    customerId: this.fb.nonNullable.control<number | null>(
      null,
      Validators.required,
    ),
    assignedToUserId: ['', Validators.required],
    type: [AppointmentType.Meeting as number, Validators.required],
    priority: [AppointmentPriority.Low as number, Validators.required],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    location: [''],
    meetingLink: [''],
    notes: [''],
  });

  get isEditMode(): boolean {
    return this.appointmentId !== null;
  }

  readonly titleKey = computed(() =>
    this.isEditMode
      ? 'sales.appointments.form.editTitle'
      : 'sales.appointments.form.createTitle',
  );

  optionLabel(opt: { ar: string; en: string }): string {
    return this.language.lang() === 'ar' ? opt.ar : opt.en;
  }

  ngOnInit(): void {
    this.loadUsers();
    this.loadCustomers();
    if (this.appointmentId !== null) this.loadAppointment(this.appointmentId);
  }

  private loadUsers(): void {
    this.loadingUsers.set(true);
    this.service.assignableUsers().subscribe({
      next: (rows) => {
        this.users.set(rows ?? []);
        this.loadingUsers.set(false);
      },
      error: () => this.loadingUsers.set(false),
    });
  }

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

  private loadAppointment(id: number): void {
    this.loadingAppointment.set(true);
    this.loadError.set(null);
    this.service.getById(id).subscribe({
      next: (a) => {
        this.form.patchValue({
          title: a.title,
          description: a.description ?? '',
          customerId: a.customerId,
          assignedToUserId: a.assignedToId,
          type: a.type,
          priority: a.priority,
          startDate: this.toLocalInput(a.startDate),
          endDate: this.toLocalInput(a.endDate),
          location: a.location ?? '',
          meetingLink: a.meetingLink ?? '',
          notes: a.notes ?? '',
        });
        this.loadingAppointment.set(false);
      },
      error: () => {
        this.loadingAppointment.set(false);
        this.loadError.set(this.t('sales.appointments.form.loadFailed'));
      },
    });
  }

  retryLoad(): void {
    if (this.appointmentId !== null) this.loadAppointment(this.appointmentId);
  }

  submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const payload: AppointmentRequest = {
      title: (v.title ?? '').trim(),
      description: (v.description ?? '').trim(),
      startDate: this.toIso(v.startDate),
      endDate: this.toIso(v.endDate),
      type: Number(v.type) as AppointmentType,
      priority: Number(v.priority) as AppointmentPriority,
      assignedToUserId: v.assignedToUserId ?? '',
      location: (v.location ?? '').trim(),
      meetingLink: (v.meetingLink ?? '').trim(),
      notes: (v.notes ?? '').trim(),
      customerId: Number(v.customerId),
    };

    this.submitting.set(true);
    this.errorMessage.set(null);

    const id = this.appointmentId;
    const request$ =
      id !== null
        ? this.service.update(id, payload)
        : this.service.create(payload);
    const successKey =
      id !== null
        ? 'sales.appointments.messages.updated'
        : 'sales.appointments.messages.created';
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

  isInvalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }

  /** ISO date-time → `yyyy-MM-ddTHH:mm` for `<input type="datetime-local">`. */
  private toLocalInput(value: string | null | undefined): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const p = (n: number) => String(n).padStart(2, '0');
    return (
      `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
      `T${p(d.getHours())}:${p(d.getMinutes())}`
    );
  }

  private toIso(value: string): string {
    if (!value) return new Date().toISOString();
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? new Date().toISOString()
      : d.toISOString();
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
