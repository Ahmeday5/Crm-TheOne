import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
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
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { addDays, cairoToday } from '../../../../core/utils/cairo-time.util';
import {
  ANNOUNCEMENT_BODY_MAX,
  ANNOUNCEMENT_TARGETS,
  ANNOUNCEMENT_TITLE_MAX,
  Announcement,
  AnnouncementInput,
  AnnouncementTarget,
} from '../../models/announcement.models';
import { AnnouncementsStore } from '../../state/announcements.store';
import { targetLabelKey, windowLength } from '../../utils/announcement.util';

const DEFAULT_DAYS = 7;

/** `endsOn >= startsOn` (both inclusive); a new post can't start in the past. */
function windowValidator(minStart: string | null): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const start = group.get('startsOn')?.value as string;
    const end = group.get('endsOn')?.value as string;
    const errors: ValidationErrors = {};
    if (start && end && end < start) errors['endBeforeStart'] = true;
    if (minStart && start && start < minStart) errors['startInPast'] = true;
    return Object.keys(errors).length ? errors : null;
  };
}

/**
 * Admin composer — create / edit. The server delivers the notification
 * (in-app + push) to every targeted employee when the announcement starts,
 * so publishing a future announcement is "schedule", not "send now".
 */
@Component({
  selector: 'app-announcement-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, ModalComponent, FormErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './announcement-form-dialog.component.html',
  styleUrl: './announcement-form-dialog.component.scss',
})
export class AnnouncementFormDialogComponent implements OnInit {
  /** `null` → create; otherwise edit this announcement. */
  readonly announcement = input<Announcement | null>(null);
  readonly saved = output<void>();
  readonly cancel = output<void>();

  private readonly fb = inject(FormBuilder);
  private readonly store = inject(AnnouncementsStore);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly targets = ANNOUNCEMENT_TARGETS;
  readonly durations = [1, 3, 7, 14, 30];
  readonly titleMax = ANNOUNCEMENT_TITLE_MAX;
  readonly bodyMax = ANNOUNCEMENT_BODY_MAX;
  readonly today = cairoToday();

  readonly submitting = signal(false);
  readonly submitAttempted = signal(false);
  readonly serverError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(ANNOUNCEMENT_TITLE_MAX), Validators.pattern(/\S/)]],
    body: ['', [Validators.required, Validators.maxLength(ANNOUNCEMENT_BODY_MAX), Validators.pattern(/\S/)]],
    target: this.fb.nonNullable.control<AnnouncementTarget>(null),
    isPinned: false,
    startsOn: [this.today, Validators.required],
    endsOn: [addDays(this.today, DEFAULT_DAYS - 1), Validators.required],
  });

  /** Live form value → drives the preview, counters and the duration chip. */
  readonly value = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  readonly isEdit = computed(() => !!this.announcement());

  readonly duration = computed(() => {
    const v = this.value();
    return v.startsOn && v.endsOn && v.endsOn >= v.startsOn ? windowLength(v.startsOn, v.endsOn) : 0;
  });

  ngOnInit(): void {
    const a = this.announcement();
    // Editing a live post must not be blocked because it started in the past.
    this.form.addValidators(windowValidator(a ? null : this.today));
    if (a) {
      this.form.setValue({
        title: a.title,
        body: a.body,
        target: a.target,
        isPinned: a.isPinned,
        startsOn: a.startsOn,
        endsOn: a.endsOn,
      });
    }
    this.form.updateValueAndValidity();
  }

  // ─────────── field helpers ───────────

  targetKey(target: AnnouncementTarget): string {
    return targetLabelKey(target);
  }

  /** Scheduled for later → the CTA says "schedule", not "publish now". */
  readonly startsLater = computed(() => (this.value().startsOn ?? this.today) > this.today);

  applyDuration(days: number): void {
    const start = this.form.controls.startsOn.value || this.today;
    this.form.controls.endsOn.setValue(addDays(start, days - 1));
    this.form.controls.endsOn.markAsTouched();
  }

  /** Error to show under the period fields (group-level validators). */
  periodError(): string | null {
    const e = this.form.errors;
    const show = this.submitAttempted() || this.form.controls.endsOn.touched || this.form.controls.startsOn.touched;
    if (!e || !show) return null;
    if (e['startInPast']) return 'announcements.form.startInPast';
    if (e['endBeforeStart']) return 'announcements.form.endBeforeStart';
    return null;
  }

  // ─────────── submit ───────────

  submit(): void {
    this.submitAttempted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;

    const v = this.form.getRawValue();
    const payload: AnnouncementInput = {
      title: v.title.trim(),
      body: v.body.trim(),
      targetRole: v.target,
      isPinned: v.isPinned,
      startDate: v.startsOn,
      endDate: v.endsOn,
    };

    this.submitting.set(true);
    this.serverError.set(null);
    const existing = this.announcement();
    const request$ = existing ? this.store.update(existing.id, payload) : this.store.publish(payload);

    request$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(this.t(this.successKey(!!existing, payload.startDate)));
        this.saved.emit();
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.serverError.set(err?.message?.trim() || this.t('announcements.messages.saveFailed'));
      },
    });
  }

  private successKey(isEdit: boolean, startDate: string): string {
    if (isEdit) return 'announcements.messages.updated';
    return startDate > this.today ? 'announcements.messages.scheduled' : 'announcements.messages.published';
  }

  close(): void {
    if (!this.submitting()) this.cancel.emit();
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
