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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PlaybookLookupsService } from '../../data/playbook-lookups.service';
import { CallScript, CallScriptInput, PlaybookServiceRef } from '../../models/sales-playbook.models';
import { SalesPlaybookStore } from '../../state/sales-playbook.store';
import { cleanLines } from '../../utils/playbook.util';
import { minLines, textRules } from '../../utils/playbook-validators.util';
import { ListFieldComponent } from '../list-field/list-field.component';

@Component({
  selector: 'app-pb-script-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, ModalComponent, FormErrorComponent, ListFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './script-form-dialog.component.html',
  styleUrl: '../playbook-form.scss',
})
export class ScriptFormDialogComponent implements OnInit {
  /** `null` → create; otherwise edit. */
  readonly script = input<CallScript | null>(null);
  readonly closed = output<void>();

  private readonly fb = inject(FormBuilder);
  private readonly store = inject(SalesPlaybookStore);
  private readonly lookups = inject(PlaybookLookupsService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly limits = { title: 140, summary: 240, text: 1200 };

  readonly submitting = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly services = signal<PlaybookServiceRef[]>([]);
  readonly servicesLoading = signal(true);
  readonly isEdit = computed(() => !!this.script());

  readonly form = this.fb.nonNullable.group({
    title: ['', textRules(this.limits.title)],
    serviceId: this.fb.control<number | null>(null),
    summary: ['', textRules(this.limits.summary, false)],
    opening: ['', textRules(this.limits.text)],
    steps: this.fb.nonNullable.control<string[]>([''], minLines(1)),
    questions: this.fb.nonNullable.control<string[]>([]),
    closing: ['', textRules(this.limits.text)],
  });

  readonly minLinesMsg = { minLines: () => this.t('salesPlaybook.form.minOneLine') };

  ngOnInit(): void {
    const s = this.script();
    if (s) {
      this.form.setValue({
        title: s.title,
        serviceId: s.service?.id ?? null,
        summary: s.summary,
        opening: s.opening,
        steps: s.steps.length ? [...s.steps] : [''],
        questions: [...s.questions],
        closing: s.closing,
      });
      // Keep the saved link visible even if the service list fails to load.
      if (s.service) this.services.set([s.service]);
    }

    this.lookups
      .services()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          const linked = this.script()?.service;
          this.services.set(linked && !rows.some((r) => r.id === linked.id) ? [linked, ...rows] : rows);
          this.servicesLoading.set(false);
        },
        error: () => this.servicesLoading.set(false),
      });
  }

  serviceLabel(s: PlaybookServiceRef): string {
    return (this.language.lang() === 'en' ? s.nameEn || s.nameAr : s.nameAr || s.nameEn) || `#${s.id}`;
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;

    const v = this.form.getRawValue();
    const service = this.services().find((s) => s.id === Number(v.serviceId)) ?? null;
    const payload: CallScriptInput = {
      title: v.title.trim(),
      service,
      summary: v.summary.trim(),
      opening: v.opening.trim(),
      steps: cleanLines(v.steps),
      questions: cleanLines(v.questions),
      closing: v.closing.trim(),
    };

    this.submitting.set(true);
    this.serverError.set(null);
    this.store.save('scripts', payload, this.script()?.id).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(this.t(this.isEdit() ? 'salesPlaybook.messages.updated' : 'salesPlaybook.messages.created'));
        this.closed.emit();
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        this.serverError.set(err?.message?.trim() || this.t('salesPlaybook.messages.saveFailed'));
      },
    });
  }

  close(): void {
    if (!this.submitting()) this.closed.emit();
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
