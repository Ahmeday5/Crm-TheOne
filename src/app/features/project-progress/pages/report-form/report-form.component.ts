import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { CompanySettingsService } from '../../../../core/services/company-settings.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { ProjectDailyReportResponseDto } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ProjectProgressService } from '../../services/project-progress.service';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;

@Component({
  selector: 'app-report-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe, LoadErrorComponent, FormErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-form.component.html',
})
export class ReportFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ProjectProgressService);
  private readonly toast = inject(ToastService);
  private readonly company = inject(CompanySettingsService);
  private readonly language = inject(LanguageService);

  readonly reportId = Number(this.route.snapshot.paramMap.get('reportId'));

  readonly report = signal<ProjectDailyReportResponseDto | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly newAttachments = signal<File[]>([]);
  readonly newAttachmentNames = signal<string[]>([]);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    completedWork: ['', Validators.required],
    remainingWork: [''],
    blockers: [''],
    notes: [''],
    actualProgressContribution: this.fb.control<number | null>(null, [
      Validators.min(0),
      Validators.max(100),
    ]),
  });

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.getReportById(this.reportId).subscribe({
      next: (r) => {
        this.report.set(r);
        this.form.reset({
          completedWork: r.completedWork,
          remainingWork: r.remainingWork ?? '',
          blockers: r.blockers ?? '',
          notes: r.notes ?? '',
          actualProgressContribution: r.actualProgressContribution ?? null,
        });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(null);
      },
    });
  }

  attachmentUrl(path: string): string {
    return this.company.assetUrl(path) ?? path;
  }

  // ─────────── new attachments ───────────

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = Array.from(input.files ?? []);
    input.value = '';
    if (picked.length === 0) return;

    const nextFiles = [...this.newAttachments()];
    const nextNames = [...this.newAttachmentNames()];

    for (const file of picked) {
      if (file.size > MAX_FILE_BYTES) continue;
      if (nextFiles.length >= MAX_ATTACHMENTS) break;
      nextFiles.push(file);
      nextNames.push(file.name);
    }
    this.newAttachments.set(nextFiles);
    this.newAttachmentNames.set(nextNames);
  }

  removeNewAttachment(index: number): void {
    this.newAttachments.update((list) => list.filter((_, i) => i !== index));
    this.newAttachmentNames.update((list) => list.filter((_, i) => i !== index));
  }

  // ─────────── submit ───────────

  submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const fd = new FormData();
    fd.append('CompletedWork', v.completedWork.trim());
    if (v.remainingWork?.trim()) fd.append('RemainingWork', v.remainingWork.trim());
    if (v.blockers?.trim()) fd.append('Blockers', v.blockers.trim());
    if (v.notes?.trim()) fd.append('Notes', v.notes.trim());
    if (v.actualProgressContribution !== null && v.actualProgressContribution !== undefined) {
      fd.append('ActualProgressContribution', String(v.actualProgressContribution));
    }
    for (const file of this.newAttachments()) fd.append('newAttachments', file);

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.service.updateReport(this.reportId, fd).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(this.t('projectProgress.messages.reportUpdated'));
        this.router.navigate(['/ProjectManage', 'reports', this.reportId]);
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.message ?? this.t('projectProgress.messages.reportUpdateFailed'));
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/ProjectManage', 'reports', this.reportId]);
  }

  isInvalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
