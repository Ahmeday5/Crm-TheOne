import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { AppService, FormMode } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ServicesService } from '../../services/services.service';

@Component({
  selector: 'app-service-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    ModalComponent,
    FormErrorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './service-form-dialog.component.html',
})
export class ServiceFormDialogComponent implements OnChanges {
  @Input({ required: true }) mode!: FormMode;
  /** Required in edit/view modes. */
  @Input() service: AppService | null = null;

  /** Emitted on successful add/update — host should reload + close. */
  @Output() saved = new EventEmitter<AppService>();
  @Output() cancel = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly services = inject(ServicesService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    nameAr: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    nameEn: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if ('mode' in changes || 'service' in changes) {
      this.errorMessage.set(null);
      this.submitting.set(false);
      this.form.reset({
        nameAr: this.service?.nameAr ?? '',
        nameEn: this.service?.nameEn ?? '',
      });
      if (this.mode === 'view') this.form.disable({ emitEvent: false });
      else this.form.enable({ emitEvent: false });
    }
  }

  // ─────────── derived labels ───────────

  modalTitleKey(): string {
    return this.mode === 'edit'
      ? 'services.form.editTitle'
      : this.mode === 'view'
        ? 'services.form.viewTitle'
        : 'services.form.addTitle';
  }

  submitLabelKey(): string {
    return this.mode === 'edit' ? 'services.form.submitEdit' : 'services.form.submitAdd';
  }

  // ─────────── submit ───────────

  submit(): void {
    if (this.mode === 'view') return;
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = {
      nameAr: this.form.controls.nameAr.value.trim(),
      nameEn: this.form.controls.nameEn.value.trim(),
    };

    this.submitting.set(true);
    this.errorMessage.set(null);

    const request$ =
      this.mode === 'edit' && this.service
        ? this.services.update(this.service.id, payload)
        : this.services.add(payload);

    request$.subscribe({
      next: (saved) => {
        this.submitting.set(false);
        this.toast.success(
          this.t(
            this.mode === 'edit'
              ? 'services.messages.updated'
              : 'services.messages.added',
          ),
        );
        this.saved.emit(saved);
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.message ?? null);
      },
    });
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
