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
import { TRANSLATIONS, interpolate, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  ANNOUNCEMENT_DEPARTMENTS,
  ANNOUNCEMENT_TONES,
  Announcement,
  AnnouncementAudience,
  AnnouncementDepartment,
  AnnouncementInput,
  AnnouncementTone,
} from '../../models/announcement.models';
import { AnnouncementsStore } from '../../state/announcements.store';
import { TONE_ICON, addDays, cairoToday, windowLength } from '../../utils/announcement.util';

const TITLE_MAX = 120;
const BODY_MAX = 1000;
const DEFAULT_DAYS = 7;

/** Window must be at least one day: `endsOn >= startsOn` (both inclusive). */
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

/** "Departments" needs at least one ticked department. */
const audienceValidator: ValidatorFn = (group) => {
  const audience = group.get('audience')?.value as AnnouncementAudience;
  const roles = (group.get('roles')?.value as string[]) ?? [];
  return audience === 'roles' && roles.length === 0 ? { rolesRequired: true } : null;
};

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
  readonly saved = output<Announcement>();
  readonly cancel = output<void>();

  private readonly fb = inject(FormBuilder);
  private readonly store = inject(AnnouncementsStore);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly tones = ANNOUNCEMENT_TONES;
  readonly departments = ANNOUNCEMENT_DEPARTMENTS;
  readonly durations = [1, 3, 7, 14, 30];
  readonly titleMax = TITLE_MAX;
  readonly bodyMax = BODY_MAX;
  readonly today = cairoToday();

  readonly submitting = signal(false);
  readonly submitAttempted = signal(false);
  readonly serverError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group(
    {
      title: ['', [Validators.required, Validators.maxLength(TITLE_MAX), Validators.pattern(/\S/)]],
      body: ['', [Validators.required, Validators.maxLength(BODY_MAX), Validators.pattern(/\S/)]],
      tone: this.fb.nonNullable.control<AnnouncementTone>('info'),
      audience: this.fb.nonNullable.control<AnnouncementAudience>('all'),
      roles: this.fb.nonNullable.control<AnnouncementDepartment[]>([]),
      isPinned: false,
      startsOn: [this.today, Validators.required],
      endsOn: [addDays(this.today, DEFAULT_DAYS - 1), Validators.required],
    },
    { validators: [audienceValidator] },
  );

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
        tone: a.tone,
        audience: a.audience,
        roles: [...a.roles],
        isPinned: a.isPinned,
        startsOn: a.startsOn,
        endsOn: a.endsOn,
      });
    }
    this.form.updateValueAndValidity();
  }

  // ─────────── field helpers ───────────

  setTone(tone: AnnouncementTone): void {
    this.form.controls.tone.setValue(tone);
  }

  setAudience(audience: AnnouncementAudience): void {
    this.form.controls.audience.setValue(audience);
  }

  toggleDepartment(dep: AnnouncementDepartment): void {
    const current = this.form.controls.roles.value;
    this.form.controls.roles.setValue(
      current.includes(dep) ? current.filter((d) => d !== dep) : [...current, dep],
    );
    this.form.controls.roles.markAsTouched();
  }

  applyDuration(days: number): void {
    const start = this.form.controls.startsOn.value || this.today;
    this.form.controls.endsOn.setValue(addDays(start, days - 1));
    this.form.controls.endsOn.markAsTouched();
  }

  toneIcon(tone: AnnouncementTone): string {
    return TONE_ICON[tone];
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

  showRolesError(): boolean {
    return !!this.form.errors?.['rolesRequired'] && (this.submitAttempted() || this.form.controls.roles.touched);
  }

  // ─────────── submit ───────────

  submit(): void {
    this.submitAttempted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;

    const v = this.form.getRawValue();
    const payload: AnnouncementInput = {
      ...v,
      title: v.title.trim(),
      body: v.body.trim(),
      roles: v.audience === 'all' ? [] : v.roles,
    };

    this.submitting.set(true);
    this.serverError.set(null);
    const existing = this.announcement();
    const request$ = existing ? this.store.update(existing.id, payload) : this.store.publish(payload);

    request$.subscribe({
      next: (saved) => {
        this.submitting.set(false);
        this.toast.success(
          existing
            ? this.t('announcements.messages.updated')
            : interpolate(this.t('announcements.messages.published'), { count: saved.recipientsCount }),
        );
        this.saved.emit(saved);
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.serverError.set(err?.message?.trim() || this.t('announcements.messages.saveFailed'));
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
