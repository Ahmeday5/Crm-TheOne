import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { startWith } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { cairoToday } from '../../../../core/utils/cairo-time.util';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { LEAVE_REASON_MAX, LEAVE_TYPES, LeaveRequestInput, LeaveType } from '../../models/attendance.models';
import { MyAttendanceStore } from '../../state/my-attendance.store';
import { LEAVE_TYPE_ICON, leaveTypeClass, requestedDays } from '../../utils/leave.util';

/** "To" may not be before "From" (both inclusive). */
const rangeValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const from = group.get('startDate')?.value as string;
  const to = group.get('endDate')?.value as string;
  return from && to && to < from ? { endBeforeStart: true } : null;
};

/**
 * "Request leave" — type, inclusive period (with a live day count) and a
 * reason. The server validates the rest (e.g. an overlapping request) and
 * its message is shown inside the form.
 */
@Component({
  selector: 'app-leave-request-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, ModalComponent, FormErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './leave-request-dialog.component.html',
  styleUrl: './leave-request-dialog.component.scss',
})
export class LeaveRequestDialogComponent {
  readonly saved = output<void>();
  readonly cancel = output<void>();

  private readonly fb = inject(FormBuilder);
  private readonly store = inject(MyAttendanceStore);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly types = LEAVE_TYPES;
  readonly typeIcon = LEAVE_TYPE_ICON;
  readonly reasonMax = LEAVE_REASON_MAX;
  private readonly today = cairoToday();

  readonly submitting = signal(false);
  readonly submitAttempted = signal(false);
  readonly serverError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group(
    {
      type: this.fb.nonNullable.control<LeaveType>('Annual'),
      startDate: [this.today, Validators.required],
      endDate: [this.today, Validators.required],
      reason: ['', [Validators.required, Validators.maxLength(LEAVE_REASON_MAX), Validators.pattern(/\S/)]],
    },
    { validators: [rangeValidator] },
  );

  readonly value = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  /** Inclusive day count of the chosen period (0 when invalid). */
  readonly days = computed(() => requestedDays(this.value().startDate ?? '', this.value().endDate ?? ''));

  readonly rangeError = computed(() => {
    this.value();
    const show = this.submitAttempted() || this.form.controls.endDate.touched;
    return show && this.form.errors?.['endBeforeStart'] ? 'attendance.leaveForm.endBeforeStart' : null;
  });

  typeClass(type: LeaveType): string {
    return leaveTypeClass(type);
  }

  setType(type: LeaveType): void {
    this.form.controls.type.setValue(type);
  }

  /** Moving "From" past "To" drags "To" along (a 1-day request by default). */
  onStartChange(): void {
    const { startDate, endDate } = this.form.getRawValue();
    if (startDate && (!endDate || endDate < startDate)) this.form.controls.endDate.setValue(startDate);
  }

  submit(): void {
    this.submitAttempted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;

    const v = this.form.getRawValue();
    const input: LeaveRequestInput = {
      type: v.type,
      startDate: v.startDate,
      endDate: v.endDate,
      reason: v.reason.trim(),
    };

    this.submitting.set(true);
    this.serverError.set(null);
    this.store.requestLeave(input).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(this.t('attendance.leaveForm.submitted'));
        this.saved.emit();
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.serverError.set(err?.message?.trim() || this.t('attendance.leaveForm.failed'));
      },
    });
  }

  close(): void {
    if (!this.submitting()) this.cancel.emit();
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
