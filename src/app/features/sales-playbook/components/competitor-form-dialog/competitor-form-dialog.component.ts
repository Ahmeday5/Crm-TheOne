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
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Competitor, CompetitorInput } from '../../models/sales-playbook.models';
import { SalesPlaybookStore } from '../../state/sales-playbook.store';
import { cleanLines } from '../../utils/playbook.util';
import { textRules } from '../../utils/playbook-validators.util';
import { ListFieldComponent } from '../list-field/list-field.component';

/**
 * Admin form for the competitor's profile. Which customers mentioned it is
 * managed separately on the card (Sales / Support can do that too).
 */
@Component({
  selector: 'app-pb-competitor-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, ModalComponent, FormErrorComponent, ListFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './competitor-form-dialog.component.html',
  styleUrl: '../playbook-form.scss',
})
export class CompetitorFormDialogComponent implements OnInit {
  readonly competitor = input<Competitor | null>(null);
  readonly closed = output<void>();

  private readonly fb = inject(FormBuilder);
  private readonly store = inject(SalesPlaybookStore);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  /** Backend limits (`Competitors`). */
  readonly limits = { name: 150, website: 300, howToWin: 4000, items: 30, item: 500 };

  readonly submitting = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly isEdit = computed(() => !!this.competitor());

  readonly form = this.fb.nonNullable.group({
    name: ['', textRules(this.limits.name)],
    website: ['', textRules(this.limits.website, false)],
    strengths: this.fb.nonNullable.control<string[]>(['']),
    weaknesses: this.fb.nonNullable.control<string[]>(['']),
    howToWin: ['', textRules(this.limits.howToWin, false)],
  });

  ngOnInit(): void {
    const c = this.competitor();
    if (!c) return;
    this.form.setValue({
      name: c.name,
      website: c.website,
      strengths: c.strengths.length ? [...c.strengths] : [''],
      weaknesses: c.weaknesses.length ? [...c.weaknesses] : [''],
      howToWin: c.howToWin,
    });
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;
    const v = this.form.getRawValue();
    const payload: CompetitorInput = {
      name: v.name.trim(),
      website: v.website.trim(),
      strengths: cleanLines(v.strengths),
      weaknesses: cleanLines(v.weaknesses),
      howToWin: v.howToWin.trim(),
    };
    this.submitting.set(true);
    this.serverError.set(null);
    this.store.save('competitors', payload, this.competitor()?.id).subscribe({
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
