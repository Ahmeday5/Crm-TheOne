import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  calendarDateToIso,
  extractCalendarDate,
  localCalendarToday,
} from '../../../../core/utils/calendar-date.util';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { MultiSelectComponent, MultiSelectOption } from '../../../../shared/components/multi-select/multi-select.component';
import { DailyReport, DailyReportProjectRef, DailyReportRequest } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { DailyReportsService } from '../../services/daily-reports.service';

/**
 * Create / edit dialog for a single daily report.
 *
 * Mirrors the shape of `CampaignFormDialogComponent`: pass `report` to switch
 * to edit mode — when null the dialog hits `POST /Reports`; otherwise
 * `PUT /Reports/{id}`. Emits `created` / `updated` so the host can pick the
 * right toast / reload semantics.
 *
 * Projects (optional): Admin picks from every active project, a Developer
 * from their own. A project already linked to the report stays selectable
 * even if it is no longer active. The section is Admin / Developer only
 * (enforced here, whatever the backend allows); for other roles the existing
 * ids are sent back unchanged, because `projectIds` replaces the links on update.
 */
@Component({
  selector: 'app-daily-report-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    ModalComponent,
    FormErrorComponent,
    MultiSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './daily-report-form-dialog.component.html',
  styleUrl: './daily-report-form-dialog.component.scss',
})
export class DailyReportFormDialogComponent implements OnInit {
  /** When set, the dialog opens in edit mode and pre-fills the form. */
  @Input() report: DailyReport | null = null;

  @Output() created = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly reports = inject(DailyReportsService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly canLinkProjects = this.reports.canLinkProjects;
  readonly projectOptions = signal<MultiSelectOption<number>[]>([]);
  readonly loadingProjects = signal(false);
  readonly projectsFailed = signal(false);
  /** Links of the report being edited — kept on save for roles that can't change them. */
  readonly linkedProjects = signal<DailyReportProjectRef[]>([]);

  /**
   * Today's local calendar date as `YYYY-MM-DD`. We deliberately avoid
   * `toISOString().slice(0,10)` because that converts to UTC and would shift
   * the day for users east of Greenwich shortly after midnight.
   */
  readonly today = localCalendarToday();

  readonly form = this.fb.nonNullable.group({
    reportDate: [this.today, Validators.required],
    completedTasks: ['', [Validators.required, Validators.minLength(2)]],
    tasksInProgress: [''],
    plannedTasks: [''],
    challenges: [''],
    workHours: this.fb.control<number | null>(8, [
      Validators.required,
      Validators.min(0),
      Validators.max(24),
    ]),
    additionalNotes: [''],
    projectIds: this.fb.nonNullable.control<number[]>([]),
  });

  get isEditMode(): boolean {
    return this.report != null;
  }

  ngOnInit(): void {
    if (this.report) this.patchFromReport(this.report);
    if (this.canLinkProjects()) this.loadProjects();
  }

  loadProjects(): void {
    this.loadingProjects.set(true);
    this.projectsFailed.set(false);
    this.reports.linkableProjects().subscribe({
      next: (list) => {
        this.loadingProjects.set(false);
        this.projectOptions.set(this.mergeOptions(list));
      },
      error: () => {
        this.loadingProjects.set(false);
        this.projectsFailed.set(true);
        // Still offer what the report is already linked to.
        this.projectOptions.set(this.mergeOptions([]));
      },
    });
  }

  submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const payload: DailyReportRequest = {
      reportDate: calendarDateToIso(v.reportDate),
      completedTasks: (v.completedTasks ?? '').trim(),
      tasksInProgress: (v.tasksInProgress ?? '').trim(),
      plannedTasks: (v.plannedTasks ?? '').trim(),
      challenges: (v.challenges ?? '').trim(),
      workHours: Number(v.workHours) || 0,
      additionalNotes: (v.additionalNotes ?? '').trim(),
      projectIds: this.canLinkProjects()
        ? [...new Set(v.projectIds)]
        : this.linkedProjects().map((p) => p.id),
    };

    this.submitting.set(true);
    this.errorMessage.set(null);

    const request$ = this.isEditMode
      ? this.reports.update(this.report!.id, payload)
      : this.reports.create(payload);
    const successKey = this.isEditMode
      ? 'dailyReports.messages.updated'
      : 'dailyReports.messages.created';
    const emitter = this.isEditMode ? this.updated : this.created;

    request$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(this.t(successKey));
        emitter.emit();
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.message ?? null);
      },
    });
  }

  // ─────────── helpers ───────────

  label(key: string): string {
    return this.t(key);
  }

  isInvalid(ctrl: AbstractControl): boolean {
    return ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  private patchFromReport(r: DailyReport): void {
    this.form.patchValue({
      reportDate: extractCalendarDate(r.reportDate) ?? this.today,
      completedTasks: r.completedTasks ?? '',
      tasksInProgress: r.tasksInProgress ?? '',
      plannedTasks: r.plannedTasks ?? '',
      challenges: r.challenges ?? '',
      workHours: r.workHours ?? 0,
      additionalNotes: r.additionalNotes ?? '',
      projectIds: (r.projects ?? []).map((p) => p.id),
    });
    this.linkedProjects.set(r.projects ?? []);
  }

  /** Active projects + the report's current links (which may be archived by now). */
  private mergeOptions(active: DailyReportProjectRef[]): MultiSelectOption<number>[] {
    const byId = new Map<number, string>();
    for (const p of active) byId.set(p.id, p.title);
    for (const p of this.linkedProjects()) if (!byId.has(p.id)) byId.set(p.id, p.title);
    return [...byId].map(([id, name]) => ({ id, name }));
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
