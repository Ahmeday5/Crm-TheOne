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
import { MoneyPipe } from '../../../../shared/pipes/money.pipe';
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
 * fields are sent. On an achieved goal the amount stays editable as long
 * as total progress doesn't drop below the target: the lowest allowed
 * amount is shown as guidance, and the server's 400 message is surfaced
 * if the change is still rejected. Emits the updated goal from the server.
 */
@Component({
  selector: 'app-goal-entry-edit-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    CairoDatePipe,
    MoneyPipe,
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
  /** The entry's goal — used to explain the "not below target" rule once achieved. */
  readonly goal = input<Goal | null>(null);

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

  protected readonly goalAchieved = computed(() => !!this.goal()?.isAchieved);

  /**
   * Smallest amount this entry can take without pulling an achieved goal
   * back under its target — `null` when no floor applies. Guidance only:
   * the server is authoritative.
   */
  protected readonly minAllowedValue = computed<number | null>(() => {
    const goal = this.goal();
    if (!goal?.isAchieved) return null;
    const surplus = goal.currentProgress - goal.targetValue;
    const floor = this.entry().value - surplus;
    return floor > 1 ? floor : null;
  });

  /** The request that would be sent — only what differs from the entry. */
  private readonly changes = computed<UpdateGoalProgressEntryRequest>(() => {
    const entry = this.entry();
    const { value, details } = this.formValue();
    const { file, removed } = this.image();
    const req: UpdateGoalProgressEntryRequest = {};

    if (value !== null && value !== undefined && Number(value) !== entry.value) {
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
