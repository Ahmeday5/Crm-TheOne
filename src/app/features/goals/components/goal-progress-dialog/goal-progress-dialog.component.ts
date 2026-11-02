import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import {
  ImagePickerChange,
  ImagePickerComponent,
} from '../../../../shared/components/image-picker/image-picker.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { Goal } from '../../../../shared/models';
import { MoneyPipe } from '../../../../shared/pipes/money.pipe';
import { PercentLabelPipe } from '../../../../shared/pipes/percent-label.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { GoalsService } from '../../services/goals.service';
import {
  CommissionQuote,
  goalAchievementPercent,
  hasCommissionRates,
  quoteCommission,
} from '../../utils/goal-commission.util';
import {
  PROGRESS_DETAILS_MAX,
  achievementPercent,
  progressAmountValidators,
  progressDetailsValidators,
} from '../../utils/goal-progress.util';

/**
 * Sales: log an amount against a goal (`PATCH /Goals/{id}/progress`).
 *
 * Amount (≥ 1, whole), details (required, ≤ 1000) and an optional
 * proof-of-payment image. Shows a live "after adding" preview, including
 * the commission it would earn on individual goals. Still open after the
 * goal is achieved — amounts above target move it into the top commission
 * bracket. Emits the updated goal returned by the server.
 */
@Component({
  selector: 'app-goal-progress-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    MoneyPipe,
    PercentLabelPipe,
    ModalComponent,
    FormErrorComponent,
    ImagePickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './goal-progress-dialog.component.html',
  styleUrl: './goal-progress-dialog.component.scss',
})
export class GoalProgressDialogComponent {
  readonly goal = input.required<Goal>();

  readonly saved = output<Goal>();
  readonly closed = output<void>();

  private readonly goalsService = inject(GoalsService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly detailsMax = PROGRESS_DETAILS_MAX;

  private readonly fb = inject(FormBuilder);

  protected readonly form = this.fb.group({
    // `null` while empty so `required` fires instead of a silent 0.
    value: this.fb.control<number | null>(null, progressAmountValidators),
    details: this.fb.nonNullable.control('', progressDetailsValidators),
  });

  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);
  private attachment: File | null = null;

  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly amount = computed(() => {
    const v = Number(this.formValue().value);
    return Number.isFinite(v) && v > 0 ? v : 0;
  });
  protected readonly detailsLength = computed(() => (this.formValue().details ?? '').length);

  /** Bar widths (capped at 100). */
  protected readonly currentPercent = computed(() =>
    achievementPercent(this.goal().currentProgress, this.goal().targetValue),
  );
  protected readonly newTotal = computed(() => this.goal().currentProgress + this.amount());
  protected readonly newPercent = computed(() =>
    achievementPercent(this.newTotal(), this.goal().targetValue),
  );

  /** Displayed figures (uncapped, may exceed 100). */
  protected readonly currentRealPercent = computed(() => goalAchievementPercent(this.goal()));
  protected readonly newRealPercent = computed(() => {
    const target = this.goal().targetValue;
    return target > 0 ? (this.newTotal() / target) * 100 : 0;
  });

  protected readonly willExceed = computed(
    () => this.amount() > 0 && this.newTotal() > this.goal().targetValue,
  );
  protected readonly willAchieve = computed(
    () => this.amount() > 0 && !this.goal().isAchieved && this.newTotal() >= this.goal().targetValue,
  );

  /**
   * Commission after adding — individual goals only: on a team goal each
   * member is paid on their own share, which this dialog doesn't know.
   */
  protected readonly commissionAfter = computed<CommissionQuote | null>(() => {
    const goal = this.goal();
    if (this.amount() <= 0 || goal.type !== 'Individual' || !hasCommissionRates(goal)) return null;
    return quoteCommission(this.newTotal(), goal.targetValue, goal.commissionThresholdPercent, goal);
  });

  protected readonly amountMessages = {
    min: () => this.t('goals.progress.amountInvalid'),
    pattern: () => this.t('goals.progress.amountInvalid'),
  };

  protected onImage(change: ImagePickerChange): void {
    this.attachment = change.file;
  }

  protected close(): void {
    if (!this.submitting()) this.closed.emit();
  }

  protected submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { value, details } = this.form.getRawValue();
    this.submitting.set(true);
    this.serverError.set(null);

    this.goalsService
      .addProgress(this.goal().id, {
        value: Number(value),
        details: details.trim(),
        attachment: this.attachment,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.submitting.set(false);
          this.toast.success(this.t('goals.messages.progressUpdated'));
          this.saved.emit(updated);
        },
        error: (err: ApiError) => {
          this.submitting.set(false);
          const msg = err?.message?.trim() || this.t('goals.messages.progressFailed');
          this.serverError.set(msg);
          this.toast.error(msg);
        },
      });
  }

  protected fieldInvalid(name: 'value' | 'details'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
