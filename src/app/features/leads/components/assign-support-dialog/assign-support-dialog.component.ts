import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  addMinutesToLocalInput,
  localInputToIso,
  toLocalInputValue,
} from '../../../../core/utils/datetime-local.util';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import {
  APPOINTMENT_PRIORITIES,
  AppointmentPriority,
  AppointmentPriorityName,
  AppointmentType,
  AppointmentTypeName,
  AssignSupportResponse,
  SUPPORT_HANDOFF_APPOINTMENT_TYPES,
  SupportHandoffAppointment,
  SupportPerson,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { dateRangeValidator, noWhitespaceValidator } from '../../../../shared/utils/custom-validators.util';
import { CustomersService } from '../../services/customers.service';

/** Default length of the booked follow-up when the user picks a start. */
const DEFAULT_DURATION_MIN = 60;

/**
 * "Transfer to support" — hands a lead to a support agent and, in the same
 * request, books the follow-up appointment for them
 * (`POST /Customers/{id}/AssignToSupportPerson`).
 *
 * The appointment section mirrors the "new appointment" form minus customer
 * and assignee (taken from the URL and the picked agent). Submit stays
 * disabled until the agent, title and a valid start/end range are set; a 400
 * from the server is shown inline. Emits the server's `{ customer, appointment }`.
 */
@Component({
  selector: 'app-assign-support-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ModalComponent,
    EmptyStateComponent,
    FormErrorComponent,
    UserAvatarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './assign-support-dialog.component.html',
  styleUrl: './assign-support-dialog.component.scss',
})
export class AssignSupportDialogComponent implements OnInit {
  @Input({ required: true }) customerId!: number;
  @Input() customerName = '';

  @Output() assigned = new EventEmitter<AssignSupportResponse>();
  @Output() cancel = new EventEmitter<void>();

  private readonly customers = inject(CustomersService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  protected readonly types = SUPPORT_HANDOFF_APPOINTMENT_TYPES;
  protected readonly priorities = APPOINTMENT_PRIORITIES;

  protected readonly supportTeam = signal<SupportPerson[]>([]);
  protected readonly loading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    supportPersonId: ['', Validators.required],
    appointment: this.fb.nonNullable.group(
      {
        title: ['', [Validators.required, noWhitespaceValidator()]],
        type: [AppointmentType.Meeting as number],
        priority: [AppointmentPriority.Low as number],
        startDate: ['', Validators.required],
        endDate: ['', Validators.required],
        location: [''],
        meetingLink: [''],
        description: [''],
        notes: [''],
      },
      { validators: dateRangeValidator('startDate', 'endDate') },
    ),
  });

  protected readonly appt = this.form.controls.appointment.controls;

  /** Drives the submit button — reactive to every value/status change. */
  protected readonly isValid = toSignal(
    this.form.statusChanges.pipe(map((s) => s === 'VALID')),
    { initialValue: false },
  );

  protected readonly rangeMessages = {
    endBeforeStart: () => this.t('common.validation.endBeforeStart'),
  };

  /** Earliest pickable start: now (local), so past slots aren't suggested. */
  protected readonly minStart = toLocalInputValue(new Date());

  ngOnInit(): void {
    const name = this.customerName.trim();
    const title = this.t('customers.supportModal.defaultTitle');
    this.appt.title.setValue(name ? `${title} — ${name}` : title);

    // Picking a start fills a sensible end (start + 1h) while end is untouched.
    this.appt.startDate.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((start) => {
        if (start && !this.appt.endDate.dirty) {
          this.appt.endDate.setValue(addMinutesToLocalInput(start, DEFAULT_DURATION_MIN));
        }
      });

    this.loading.set(true);
    this.customers
      .supportTeam()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (team) => {
          this.supportTeam.set(team ?? []);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected selectPerson(id: string): void {
    this.form.controls.supportPersonId.setValue(id);
    this.form.controls.supportPersonId.markAsTouched();
    this.errorMessage.set(null);
  }

  protected optionLabel(opt: { ar: string; en: string }): string {
    return this.language.lang() === 'ar' ? opt.ar : opt.en;
  }

  protected isInvalid(name: keyof typeof this.appt): boolean {
    const c = this.appt[name];
    return c.invalid && (c.dirty || c.touched);
  }

  protected close(): void {
    if (!this.submitting()) this.cancel.emit();
  }

  protected submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { supportPersonId } = this.form.getRawValue();
    this.submitting.set(true);
    this.errorMessage.set(null);

    this.customers
      .assignSupport(this.customerId, { supportPersonId, appointment: this.buildAppointment() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.submitting.set(false);
          this.toast.success(this.t('customers.supportModal.successWithAppointment'));
          this.assigned.emit(res);
        },
        error: (err: ApiError) => {
          // Server-side validation (e.g. bad dates) rejects the whole hand-off.
          this.submitting.set(false);
          const message = err?.message?.trim() || this.t('customers.supportModal.failed');
          this.errorMessage.set(message);
          this.toast.error(message);
        },
      });
  }

  /** Optional text fields are omitted when blank; enums go as member names. */
  private buildAppointment(): SupportHandoffAppointment {
    const v = this.form.controls.appointment.getRawValue();
    const optional = (s: string) => s.trim() || undefined;
    return {
      title: v.title.trim(),
      startDate: localInputToIso(v.startDate)!,
      endDate: localInputToIso(v.endDate)!,
      type: AppointmentType[v.type] as AppointmentTypeName,
      priority: AppointmentPriority[v.priority] as AppointmentPriorityName,
      location: optional(v.location),
      meetingLink: optional(v.meetingLink),
      description: optional(v.description),
      notes: optional(v.notes),
    };
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
