import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { AnimatedNumberDirective } from '../../../../shared/directives/animated-number.directive';
import {
  ProjectDailyReportResponseDto,
  ProjectDetail,
  ProjectProgressSummaryDto,
  ProjectTeamMemberResponseDto,
  isWorkingDay,
  parseIsoDate,
  projectContribution,
  shareCompletionOf,
  toIsoDate,
} from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ProjectsService } from '../../../ProjectsTasks/services/projects.service';
import { ProjectProgressService } from '../../services/project-progress.service';
import { ProjectProgressSyncService } from '../../services/project-progress-sync.service';

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

const round2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * A developer's own progress on one project + the daily report.
 *
 * Contract v2: the report carries the CUMULATIVE % of the developer's own
 * share (0–100, never below where it is). The project points it adds are
 * previewed live: (new − current) × responsibility ÷ 100.
 *
 * One report per working day: once today's report exists the form switches
 * to editing it (`PUT reports/{id}`) instead of being locked.
 */
@Component({
  selector: 'app-my-project-progress',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe, LoadErrorComponent, FormErrorComponent, AnimatedNumberDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './my-project-progress.component.html',
  styleUrl: './my-project-progress.component.scss',
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

  /** Today's report, when it already exists — the form edits it. */
  readonly editing = signal<ProjectDailyReportResponseDto | null>(null);
  /** Looking up today's report (hasReportedToday = true). */
  readonly findingToday = signal(false);

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
    shareCompletionPercent: this.fb.control<number | null>(null, [Validators.required, Validators.min(0), Validators.max(100)]),
  });

  // ─────────── numbers ───────────

  readonly responsibility = computed(() => this.myProgress()?.responsibilityPercentage ?? 0);
  readonly earned = computed(() => this.myProgress()?.earnedProgressPercentage ?? 0);
  readonly remaining = computed(() => this.myProgress()?.remainingResponsibilityPercentage ?? 0);

  /** Where my share stands now (all reports, today's included). */
  readonly currentShare = computed(() => {
    const mp = this.myProgress();
    return mp ? shareCompletionOf(mp) : 0;
  });

  /**
   * The floor for this report: my share BEFORE it. For a new report that is
   * where I am now; when editing today's report it is where I was before it.
   */
  readonly baseShare = computed(() => {
    const r = this.editing();
    return r ? round2(r.shareCompletionBefore ?? this.currentShare()) : this.currentShare();
  });

  /** Signal mirror of the share control so computed()s react to it. */
  private readonly shareValue = signal<number | null>(null);

  /** The value being entered, clamped to a sane number. */
  readonly enteredShare = computed(() => {
    const v = this.shareValue();
    return v == null || !Number.isFinite(v) ? this.baseShare() : Math.min(100, v);
  });

  /** "= +16.5% of the project" for what is entered now. */
  readonly previewContribution = computed(() =>
    projectContribution(this.responsibility(), this.baseShare(), this.enteredShare()),
  );

  /** Project % after this report (preview). */
  readonly previewProject = computed(() => {
    const s = this.summary()?.overallProgressPercentage ?? 0;
    const already = this.editing() ? projectContribution(this.responsibility(), this.baseShare(), this.currentShare()) : 0;
    return round2(Math.min(100, s - already + this.previewContribution()));
  });

  /** Entered a share below the floor (only an admin can lower it). */
  readonly belowCurrent = computed(() => {
    const v = this.shareValue();
    return v != null && v < this.baseShare();
  });

  // ─────────── date / submit guards ───────────

  readonly minDate = computed(() => this.project()?.start?.slice(0, 10) ?? '');
  readonly maxDate = computed(() => {
    const end = this.project()?.end?.slice(0, 10) ?? '';
    return end && end < this.today ? end : this.today;
  });

  /** Signal mirror of `reportDate`'s value so computed()s react to date changes. */
  private readonly reportDateValue = signal(this.today);

  readonly isSelectedDateToday = computed(() => this.reportDateValue() === this.today);
  readonly isWeekendSelected = computed(() =>
    this.reportDateValue() ? !isWorkingDay(parseIsoDate(this.reportDateValue())) : false,
  );

  /** Today's report exists but could not be loaded for editing. */
  readonly blockedByAlreadyReported = computed(
    () => !this.editing() && !this.findingToday() && this.isSelectedDateToday() && !!this.myProgress()?.hasReportedToday,
  );

  readonly canSubmit = computed(
    () => !this.isWeekendSelected() && !this.blockedByAlreadyReported() && !this.belowCurrent() && !this.findingToday(),
  );

  constructor() {
    this.form.controls.reportDate.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.reportDateValue.set(value));
    this.form.controls.shareCompletionPercent.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.shareValue.set(value === null || value === undefined || (value as unknown) === '' ? null : Number(value)));
  }

  ngOnInit(): void {
    this.reload();
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
        if (mp.projectProgressPercent != null) this.progressSync.set(this.projectId, mp.projectProgressPercent);
        if (mp.hasReportedToday) {
          this.loadTodayReport();
        } else {
          this.editing.set(null);
          this.form.controls.reportDate.enable({ emitEvent: false });
          this.setShare(this.currentShare());
        }
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

  /** Slider / number input both write the same control; keep it on a valid step. */
  onShareInput(raw: string | number): void {
    const n = Number(raw);
    if (raw === '' || !Number.isFinite(n)) return;
    const clamped = Math.max(this.baseShare(), Math.min(100, n));
    if (clamped !== n) this.setShare(clamped);
  }

  /** Quick picks: +10 / +25 / done. */
  bumpShare(to: number): void {
    this.setShare(Math.max(this.baseShare(), Math.min(100, to)));
    this.form.controls.shareCompletionPercent.markAsDirty();
  }

  private setShare(value: number): void {
    this.form.controls.shareCompletionPercent.setValue(round2(value));
  }

  /** hasReportedToday → find today's report for this project and edit it. */
  private loadTodayReport(): void {
    this.findingToday.set(true);
    this.service
      .getMyReports({ from: this.today, to: this.today, pageSize: 50 })
      .pipe(
        map((page) => page?.data?.find((r) => r.projectId === this.projectId && r.reportDate.slice(0, 10) === this.today) ?? null),
        switchMap((row) => (row ? this.service.getReportById(row.id) : of(null))),
        catchError(() => of(null)),
      )
      .subscribe((report) => {
        this.findingToday.set(false);
        this.editing.set(report);
        if (!report) return;
        this.form.patchValue({
          reportDate: this.today,
          completedWork: report.completedWork ?? '',
          remainingWork: report.remainingWork ?? '',
          blockers: report.blockers ?? '',
          notes: report.notes ?? '',
        });
        this.form.controls.reportDate.disable({ emitEvent: false });
        this.setShare(report.shareCompletionAfter ?? this.currentShare());
        this.form.markAsPristine();
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
        this.toast.error(this.t('projectProgress.form.fileTooLarge'));
        continue;
      }
      if (nextFiles.length >= MAX_ATTACHMENTS) {
        this.toast.warning(this.t('projectProgress.form.tooManyFiles'));
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

  // ─────────── submit ───────────

  submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid || !this.canSubmit()) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const share = round2(Math.max(this.baseShare(), Math.min(100, Number(v.shareCompletionPercent ?? this.baseShare()))));
    const editing = this.editing();

    const fd = new FormData();
    if (!editing) {
      fd.append('ProjectId', String(this.projectId));
      fd.append('ReportDate', v.reportDate);
    }
    fd.append('CompletedWork', v.completedWork.trim());
    if (v.remainingWork?.trim()) fd.append('RemainingWork', v.remainingWork.trim());
    if (v.blockers?.trim()) fd.append('Blockers', v.blockers.trim());
    if (v.notes?.trim()) fd.append('Notes', v.notes.trim());
    fd.append('ShareCompletionPercent', String(share));
    for (const file of this.attachments()) fd.append(editing ? 'newAttachments' : 'attachments', file);

    this.submitting.set(true);
    this.errorMessage.set(null);

    const request$ = editing ? this.service.updateReport(editing.id, fd) : this.service.createReport(fd);
    request$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(this.t(editing ? 'projectProgress.messages.reportUpdated' : 'projectProgress.messages.reportSubmitted'));
        this.attachments.set([]);
        this.previewNames.set([]);
        if (!editing) this.form.reset({ reportDate: this.today, completedWork: '', remainingWork: '', blockers: '', notes: '', shareCompletionPercent: null });
        this.reload();
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.message ?? this.t('projectProgress.messages.reportSubmitFailed'));
      },
    });
  }

  isInvalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
