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
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { startWith } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Objection, ObjectionInput } from '../../models/sales-playbook.models';
import { SalesPlaybookStore } from '../../state/sales-playbook.store';
import { categoryMeta } from '../../utils/playbook.util';
import { textRules } from '../../utils/playbook-validators.util';

@Component({
  selector: 'app-pb-objection-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, ModalComponent, FormErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './objection-form-dialog.component.html',
  styleUrl: '../playbook-form.scss',
})
export class ObjectionFormDialogComponent implements OnInit {
  readonly objection = input<Objection | null>(null);
  /** Pre-filled category when creating from a filtered view. */
  readonly defaultCategory = input<string>('');
  readonly closed = output<void>();

  private readonly fb = inject(FormBuilder);
  private readonly store = inject(SalesPlaybookStore);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  /** Backend limits (`Objections`). */
  readonly limits = { objection: 500, answer: 4000, category: 100 };

  /** Categories already in use — one click to reuse, or type a new one. */
  readonly suggestions = computed(() => this.store.objectionCategories().map((c) => c.category));
  readonly metaOf = categoryMeta;

  readonly submitting = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly isEdit = computed(() => !!this.objection());

  readonly form = this.fb.nonNullable.group({
    category: ['', textRules(this.limits.category)],
    objection: ['', textRules(this.limits.objection)],
    answer: ['', textRules(this.limits.answer)],
  });

  readonly value = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  ngOnInit(): void {
    const o = this.objection();
    if (o) {
      this.form.setValue({ category: o.category, objection: o.objection, answer: o.answer });
    } else {
      this.form.controls.category.setValue(this.defaultCategory());
    }
  }

  pickCategory(category: string): void {
    this.form.controls.category.setValue(category);
    this.form.controls.category.markAsTouched();
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;
    const v = this.form.getRawValue();
    const payload: ObjectionInput = {
      category: v.category.trim(),
      objection: v.objection.trim(),
      answer: v.answer.trim(),
    };
    this.submitting.set(true);
    this.serverError.set(null);
    this.store.save('objections', payload, this.objection()?.id).subscribe({
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
