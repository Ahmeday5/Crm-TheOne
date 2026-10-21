import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import {
  ProjectDetail,
  ProjectProgressSummaryDto,
  ProjectTeamMemberResponseDto,
  isWorkingDay,
  parseIsoDate,
  toIsoDate,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ProjectsService } from '../../../ProjectsTasks/services/projects.service';
import { ProjectProgressService } from '../../services/project-progress.service';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;

/** Rejects Friday/Saturday selections (working week is Sunday–Thursday). */
function workingDayValidator(): ValidatorFn {
  return (control): ValidationErrors | null => {
    const value = control.value as string;
    if (!value) return null;
    return isWorkingDay(parseIsoDate(value)) ? null : { weekend: true };
  };
}

@Component({
  selector: 'app-my-project-progress',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe, LoadErrorComponent, FormErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './my-project-progress.component.html',
  styles: [
    `
      @use 'breakpoints' as bp;

      .progress-lg { height: 10px; }

      @include bp.down(md) {
        .submit-btn { width: 100%; }
      }
    `,
  ],
})
export class MyProjectProgressComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ProjectProgressService);
  private readonly projectsService = inject(ProjectsService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly projectId = Number(this.route.snapshot.paramMap.get('projectId'));

  readonly project = signal<ProjectDetail | null>(null);
  readonly myProgress = signal<ProjectTeamMemberResponseDto | null>(null);
  readonly summary = signal<ProjectProgressSummaryDto | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly attachments = signal<File[]>([]);
  readonly previewNames = signal<string[]>([]);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly today = toIsoDate(new Date());

  readonly form = this.fb.nonNullable.group({
    reportDate: [this.today, [Validators.required, workingDayValidator()]],
    completedWork: ['', Validators.required],
    remainingWork: [''],
    blockers: [''],
    notes: [''],
    actualProgressContribution: this.fb.control<number | null>(null, [
      Validators.min(0),
      Validators.max(100),
    ]),
  });

  readonly minDate = computed(() => {
    const p = this.project();
    return p?.start ? p.start.slice(0, 10) : '';
  });

  readonly maxDate = computed(() => {
    const p = this.project();
    return p?.end ? p.end.slice(0, 10) : '';
  });

  /** Signal mirror of `reportDate`'s value so computed()s react to date changes. */
  private readonly reportDateValue = signal(this.today);

  readonly isSelectedDateToday = computed(() => this.reportDateValue() === this.today);

  readonly isWeekendSelected = computed(() =>
    this.reportDateValue() ? !isWorkingDay(parseIsoDate(this.reportDateValue())) : false,
  );

  readonly blockedByAlreadyReported = computed(
    () => this.isSelectedDateToday() && !!this.myProgress()?.hasReportedToday,
  );

  /** Signal mirror of `actualProgressContribution`'s value for the same reason. */
  private readonly contributionValue = signal<number | null>(null);

  readonly exceedsResponsibility = computed(() => {
    const mp = this.myProgress();
    if (!mp) return false;
    const contribution = this.contributionValue() ?? mp.dailyAllocation;
    return mp.earnedProgressPercentage + contribution > mp.responsibilityPercentage;
  });

  readonly canSubmit = computed(
    () => !this.isWeekendSelected() && !this.blockedByAlreadyReported(),
  );

  ngOnInit(): void {
    this.reload();
    this.form.controls.reportDate.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.reportDateValue.set(value));
    this.form.controls.actualProgressContribution.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.contributionValue.set(value));
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.projectsService.myGetById(this.projectId).subscribe({
      next: (p) => this.project.set(p),
      error: () => this.project.set(null),
    });

    this.service.getMyProgress(this.projectId, true).subscribe({
      next: (mp) => {
        this.myProgress.set(mp);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(this.t('projectProgress.messages.loadFailed'));
      },
    });

    this.service.getSummary(this.projectId, true).subscribe({
      next: (s) => this.summary.set(s),
      error: () => this.summary.set(null),
    });
  }

  // ─────────── attachments ───────────

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = Array.from(input.files ?? []);
    input.value = '';
    if (picked.length === 0) return;

    const nextFiles = [...this.attachments()];
    const nextNames = [...this.previewNames()];

    for (const file of picked) {
      if (file.size > MAX_FILE_BYTES) {
        this.toast.error(this.t('common.loadFailed'));
        continue;
      }
      if (nextFiles.length >= MAX_ATTACHMENTS) {
        this.toast.warning(this.t('common.loadFailed'));
        break;
      }
      nextFiles.push(file);
      nextNames.push(file.name);
    }
    this.attachments.set(nextFiles);
    this.previewNames.set(nextNames);
  }

  removeAttachment(index: number): void {
    this.attachments.update((list) => list.filter((_, i) => i !== index));
    this.previewNames.update((list) => list.filter((_, i) => i !== index));
  }

  private revokeAll(): void {
    this.attachments.set([]);
    this.previewNames.set([]);
  }

  // ─────────── submit ───────────

  submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid || !this.canSubmit()) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const fd = new FormData();
    fd.append('ProjectId', String(this.projectId));
    fd.append('ReportDate', v.reportDate);
    fd.append('CompletedWork', v.completedWork.trim());
    if (v.remainingWork?.trim()) fd.append('RemainingWork', v.remainingWork.trim());
    if (v.blockers?.trim()) fd.append('Blockers', v.blockers.trim());
    if (v.notes?.trim()) fd.append('Notes', v.notes.trim());
    if (v.actualProgressContribution !== null && v.actualProgressContribution !== undefined) {
      fd.append('ActualProgressContribution', String(v.actualProgressContribution));
    }
    for (const file of this.attachments()) fd.append('attachments', file);

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.service.createReport(fd).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(this.t('projectProgress.messages.reportSubmitted'));
        this.resetForm();
        this.reload();
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.message ?? this.t('projectProgress.messages.reportSubmitFailed'));
      },
    });
  }

  private resetForm(): void {
    this.form.reset({
      reportDate: this.today,
      completedWork: '',
      remainingWork: '',
      blockers: '',
      notes: '',
      actualProgressContribution: null,
    });
    this.revokeAll();
  }

  isInvalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
