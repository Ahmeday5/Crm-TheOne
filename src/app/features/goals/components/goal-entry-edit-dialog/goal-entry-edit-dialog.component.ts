import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
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
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import {
  Goal,
  GoalProgressEntry,
  UpdateGoalProgressEntryRequest,
} from '../../../../shared/models';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { GoalsService } from '../../services/goals.service';
import {
  PROGRESS_DETAILS_MAX,
  progressAmountValidators,
  progressDetailsValidators,
} from '../../utils/goal-progress.util';

/**
 * Admin: edit one logged amount (`PUT /Goals/progress-entries/{entryId}`).
 *
 * Pre-filled with the entry's amount, details and image. Only changed
 * fields are sent. Once the goal is achieved the server rejects a new
 * `Value`, so the amount is locked with the reason shown next to it.
 * Emits the updated goal returned by the server.
 */
@Component({
  selector: 'app-goal-entry-edit-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    CairoDatePipe,
    ModalComponent,
    FormErrorComponent,
    ImagePickerComponent,
    UserAvatarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './goal-entry-edit-dialog.component.html',
  styleUrl: './goal-entry-edit-dialog.component.scss',
})
export class GoalEntryEditDialogComponent implements OnInit {
  readonly entry = input.required<GoalProgressEntry>();
  /** The parent goal is achieved → the amount can no longer change. */
  readonly goalAchieved = input<boolean>(false);

  readonly saved = output<Goal>();
  readonly closed = output<void>();

  private readonly goalsService = inject(GoalsService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  protected readonly detailsMax = PROGRESS_DETAILS_MAX;

  protected readonly form = this.fb.group({
    value: this.fb.control<number | null>(null, progressAmountValidators),
    details: this.fb.nonNullable.control('', progressDetailsValidators),
  });

  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);
  private readonly image = signal<ImagePickerChange>({ file: null, removed: false });

  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly detailsLength = computed(() => (this.formValue().details ?? '').length);

  /** The request that would be sent — only what differs from the entry. */
  private readonly changes = computed<UpdateGoalProgressEntryRequest>(() => {
    const entry = this.entry();
    const { value, details } = this.formValue();
    const { file, removed } = this.image();
    const req: UpdateGoalProgressEntryRequest = {};

    if (!this.goalAchieved() && value !== null && value !== undefined && Number(value) !== entry.value) {
      req.value = Number(value);
    }
    const trimmed = (details ?? '').trim();
    if (trimmed !== (entry.details ?? '').trim()) req.details = trimmed;
    if (file) req.attachment = file;
    else if (removed && entry.attachmentUrl) req.removeAttachment = true;
    return req;
  });

  protected readonly hasChanges = computed(() => Object.keys(this.changes()).length > 0);

  protected readonly amountMessages = {
    min: () => this.t('goals.progress.amountInvalid'),
    pattern: () => this.t('goals.progress.amountInvalid'),
  };

  ngOnInit(): void {
    const entry = this.entry();
    this.form.setValue({ value: entry.value, details: entry.details ?? '' });
    if (this.goalAchieved()) this.form.controls.value.disable();
  }

  protected onImage(change: ImagePickerChange): void {
    this.image.set(change);
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
    if (!this.hasChanges()) {
      this.toast.info(this.t('goals.entryEdit.noChanges'));
      return;
    }

    this.submitting.set(true);
    this.serverError.set(null);

    this.goalsService
      .updateProgressEntry(this.entry().id, this.changes())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.submitting.set(false);
          this.toast.success(this.t('goals.messages.entryUpdated'));
          this.saved.emit(updated);
        },
        error: (err: ApiError) => {
          this.submitting.set(false);
          const msg = err?.message?.trim() || this.t('goals.messages.entryUpdateFailed');
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
