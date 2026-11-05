import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ATTENDANCE_POLICY } from '../../config/attendance.config';
import { LEAVE_TYPES, LeaveRequest, LeaveRequestInput, LeaveType } from '../../models/attendance.models';
import { AttendanceStore } from '../../state/attendance.store';
import { addDays } from '../../utils/attendance-date.util';
import { LEAVE_TYPE_ICON, countLeaveDays, earliestStart, validateLeaveRequest } from '../../utils/leave.util';
import { leaveErrorKey } from '../../utils/attendance-errors.util';

const REASON_MAX = 500;

/** New leave request — validated live against dates, overlaps and balance. */
@Component({
  selector: 'app-leave-request-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, ModalComponent, FormErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './leave-request-dialog.component.html',
  styleUrl: './leave-request-dialog.component.scss',
})
export class LeaveRequestDialogComponent {
  readonly saved = output<LeaveRequest>();
  readonly cancel = output<void>();

  private readonly fb = inject(FormBuilder);
  private readonly store = inject(AttendanceStore);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly types = LEAVE_TYPES;
  readonly typeIcon = LEAVE_TYPE_ICON;
  readonly reasonMax = REASON_MAX;
  readonly today = this.store.today();

  readonly submitting = signal(false);
  readonly submitAttempted = signal(false);
  readonly serverError = signal<string | null>(null);

  /** Business rules as a group validator → `{ leaveRule: <code> }`. */
  private readonly rulesValidator: ValidatorFn = (group) => {
    const v = group.value as LeaveRequestInput;
    const code = validateLeaveRequest(this.normalize(v), {
      today: this.store.today(),
      policy: ATTENDANCE_POLICY,
      holidays: this.store.holidays(),
      existing: this.store.myLeaves(),
      balances: this.store.balances(),
    });
    return code ? { leaveRule: code } : null;
  };

  readonly form = this.fb.nonNullable.group(
    {
      type: this.fb.nonNullable.control<LeaveType>('annual'),
      from: [addDays(this.today, 1), Validators.required],
      to: [addDays(this.today, 1), Validators.required],
      halfDay: false,
      reason: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(REASON_MAX), Validators.pattern(/\S/)]],
    },
    { validators: [this.rulesValidator] },
  );

  readonly value = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  readonly minFrom = computed(() =>
    earliestStart(this.value().type ?? 'annual', this.store.today(), ATTENDANCE_POLICY.sickBackdateDays),
  );

  readonly days = computed(() => {
    const v = this.value();
    return countLeaveDays(v.from ?? '', v.halfDay ? (v.from ?? '') : (v.to ?? ''), !!v.halfDay, ATTENDANCE_POLICY, this.store.holidays());
  });

  readonly balance = computed(() => this.store.balances().find((b) => b.type === this.value().type) ?? null);
  readonly balanceAfter = computed(() => {
    const b = this.balance();
    return b ? b.available - this.days() : null;
  });

  // ─────────── field helpers ───────────

  availableOf(type: LeaveType): number | string {
    return this.store.balances().find((b) => b.type === type)?.available ?? '—';
  }

  setType(type: LeaveType): void {
    this.form.controls.type.setValue(type);
  }

  toggleHalfDay(): void {
    const half = !this.form.controls.halfDay.value;
    this.form.controls.halfDay.setValue(half);
    if (half) this.form.controls.to.setValue(this.form.controls.from.value);
  }

  onFromChange(): void {
    const { from, to, halfDay } = this.form.getRawValue();
    if (halfDay || (from && to && to < from)) this.form.controls.to.setValue(from);
  }

  /** Key of the rule broken right now (shown once the user touched a date or submitted). */
  ruleError(): string | null {
    const code = this.form.errors?.['leaveRule'] as string | undefined;
    const touched = this.submitAttempted() || this.form.controls.from.dirty || this.form.controls.to.dirty || this.form.controls.type.dirty;
    return code && touched ? leaveErrorKey(code) : null;
  }

  // ─────────── submit ───────────

  submit(): void {
    this.submitAttempted.set(true);
    this.form.markAllAsTouched();
    this.form.updateValueAndValidity();
    if (this.form.invalid || this.submitting()) return;

    this.submitting.set(true);
    this.serverError.set(null);
    this.store.requestLeave(this.normalize(this.form.getRawValue())).subscribe({
      next: (saved) => {
        this.submitting.set(false);
        this.toast.success(this.t('attendance.messages.leaveRequested'));
        this.saved.emit(saved);
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        const key = err?.code ? leaveErrorKey(err.code) : null;
        this.serverError.set(key ? this.t(key) : err?.message?.trim() || this.t('attendance.messages.saveFailed'));
      },
    });
  }

  close(): void {
    if (!this.submitting()) this.cancel.emit();
  }

  private normalize(v: LeaveRequestInput): LeaveRequestInput {
    return { ...v, to: v.halfDay ? v.from : v.to, reason: (v.reason ?? '').trim() };
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
