import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
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
  projectContribution,
  shareCompletionOf,
  toIsoDate,
} from '../../../../shared/models';
import { ProjectProgressSyncService } from '../../services/project-progress-sync.service';
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

      .share-row { display: flex; align-items: center; gap: 1rem; }
      .share-range { flex: 1; }
      .share-input { width: 8.5rem; flex-shrink: 0; }
      .share-preview {
        display: inline-flex; align-items: center; gap: 0.45rem; margin-top: 0.5rem;
        padding: 0.35rem 0.75rem; border-radius: var(--radius-pill);
        background: var(--brand-soft); color: var(--brand-500); font-weight: var(--fw-700); font-size: var(--fs-sm);
        transition: background-color 200ms ease, color 200ms ease;
      }
      .share-preview.is-zero { background: var(--surface-2); color: var(--text-3); }

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
  private readonly progressSync = inject(ProjectProgressSyncService);

  /** Set when embedded in the project workspace (else the route's `:projectId`). */
  readonly forProject = input<number | null>(null);
  /** Inside the workspace: no page header / overall bar (the workspace shows them). */
  readonly embedded = input(false);

  get projectId(): number {
    return this.forProject() ?? Number(this.route.snapshot.paramMap.get('projectId'));
  }

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
    /** Cumulative % of MY share done (0–100) — not % of the project. */
    shareCompletionPercent: this.fb.control<number | null>(null, [Validators.required, Validators.max(100)]),
  });

  /** Where my share stands now (before this report). */
  readonly currentShare = computed(() => {
    const mp = this.myProgress();
    return mp ? shareCompletionOf(mp) : 0;
  });

  /** "= +16.5% of the project" for what is typed now. */
  readonly previewContribution = computed(() => {
    const mp = this.myProgress();
    if (!mp) return 0;
    const to = this.contributionValue() ?? this.currentShare();
    return projectContribution(mp.responsibilityPercentage, this.currentShare(), to);
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

  /** Typed a share below where it already is (only an admin can lower it). */
  readonly belowCurrent = computed(() => {
    const v = this.contributionValue();
    return v !== null && v < this.currentShare();
  });

  readonly canSubmit = computed(
    () => !this.isWeekendSelected() && !this.blockedByAlreadyReported(),
  );

  ngOnInit(): void {
    this.reload();
    this.form.controls.reportDate.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.reportDateValue.set(value));
    this.form.controls.shareCompletionPercent.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.contributionValue.set(value === null || value === undefined ? null : Number(value)));
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
        // Start the slider where my share stands now.
        if (!this.form.controls.shareCompletionPercent.dirty) {
          this.form.controls.shareCompletionPercent.setValue(Math.round(shareCompletionOf(mp) * 100) / 100);
        }
        if (mp.projectProgressPercent != null) this.progressSync.set(this.projectId, mp.projectProgressPercent);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(this.t('projectProgress.messages.loadFailed'));
      },
    });

    this.service.getSummary(this.projectId, true).subscribe({
      next: (s) => {
        this.summary.set(s);
        this.progressSync.set(this.projectId, s.overallProgressPercentage);
      },
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
    if (this.form.invalid || !this.canSubmit() || this.belowCurrent()) {
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
    // Contract v2: the cumulative share of MY part. Until the backend reads it,
    // the same move is also sent as project points (what the old API expects),
    // capped to what is left of my share so it is never rejected.
    const mp = this.myProgress();
    const share = Math.max(this.currentShare(), Math.min(100, Number(v.shareCompletionPercent ?? this.currentShare())));
    fd.append('ShareCompletionPercent', String(share));
    if (mp) {
      const points = projectContribution(mp.responsibilityPercentage, this.currentShare(), share);
      const left = Math.max(0, mp.remainingResponsibilityPercentage ?? mp.responsibilityPercentage - mp.earnedProgressPercentage);
      fd.append('ActualProgressContribution', String(Math.floor(Math.min(points, left) * 100) / 100));
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
      shareCompletionPercent: null,
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
