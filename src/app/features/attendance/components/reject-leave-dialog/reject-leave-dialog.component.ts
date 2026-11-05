import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { LeaveRequest } from '../../models/attendance.models';

const REASON_MAX = 300;

/** Admin rejects a leave request — a reason is mandatory and shown to the employee. */
@Component({
  selector: 'app-reject-leave-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, CairoDatePipe, ModalComponent, FormErrorComponent, UserAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reject-leave-dialog.component.html',
  styleUrl: './reject-leave-dialog.component.scss',
})
export class RejectLeaveDialogComponent {
  readonly request = input.required<LeaveRequest>();
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly confirm = output<string>();
  readonly cancel = output<void>();

  readonly reasonMax = REASON_MAX;
  readonly submitAttempted = signal(false);

  /** One-tap reasons; the admin can still edit them. */
  readonly presets = ['workload', 'teamCoverage', 'shortNotice', 'balance'];

  readonly form = inject(FormBuilder).nonNullable.group({
    reason: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(REASON_MAX), Validators.pattern(/\S/)]],
  });

  readonly reasonLength = toSignal(
    this.form.controls.reason.valueChanges.pipe(startWith('')),
    { initialValue: '' },
  );

  usePreset(text: string): void {
    this.form.controls.reason.setValue(text);
    this.form.controls.reason.markAsDirty();
  }

  submit(): void {
    this.submitAttempted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.confirm.emit(this.form.controls.reason.value.trim());
  }

  close(): void {
    if (!this.busy()) this.cancel.emit();
  }
}
