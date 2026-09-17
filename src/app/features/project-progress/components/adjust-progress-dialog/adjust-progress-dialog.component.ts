import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { AdjustProgressDto, ProjectTeamMemberResponseDto } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ProjectProgressService } from '../../services/project-progress.service';

@Component({
  selector: 'app-adjust-progress-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe, ModalComponent, FormErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './adjust-progress-dialog.component.html',
})
export class AdjustProgressDialogComponent implements OnChanges {
  @Input({ required: true }) projectId!: number;
  @Input({ required: true }) member!: ProjectTeamMemberResponseDto;

  @Output() saved = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ProjectProgressService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    newProgressPercentage: this.fb.control<number>(0, [
      Validators.required,
      Validators.min(0),
      Validators.max(100),
    ]),
    reason: [''],
  });

  readonly exceedsResponsibility = computed(() => {
    const value = Number(this.form.controls.newProgressPercentage.value) || 0;
    return value > (this.member?.responsibilityPercentage ?? 100);
  });

  ngOnChanges(changes: SimpleChanges): void {
    if ('member' in changes) {
      this.errorMessage.set(null);
      this.submitting.set(false);
      this.form.reset({
        newProgressPercentage: this.member?.earnedProgressPercentage ?? 0,
        reason: '',
      });
    }
  }

  submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const payload: AdjustProgressDto = {
      newProgressPercentage: Number(v.newProgressPercentage),
      reason: v.reason.trim() || undefined,
    };

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.service.adjustProgress(this.projectId, this.member.developerId, payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(this.t('projectProgress.messages.progressAdjusted'));
        this.saved.emit();
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.message ?? this.t('projectProgress.messages.progressAdjustFailed'));
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
