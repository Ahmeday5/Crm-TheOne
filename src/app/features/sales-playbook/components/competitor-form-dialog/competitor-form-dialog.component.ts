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
import {
  MultiSelectComponent,
  MultiSelectOption,
} from '../../../../shared/components/multi-select/multi-select.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PlaybookLookupsService } from '../../data/playbook-lookups.service';
import { Competitor, CompetitorInput, CompetitorMention } from '../../models/sales-playbook.models';
import { SalesPlaybookStore } from '../../state/sales-playbook.store';
import { cleanLines } from '../../utils/playbook.util';
import { textRules } from '../../utils/playbook-validators.util';
import { ListFieldComponent } from '../list-field/list-field.component';

@Component({
  selector: 'app-pb-competitor-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ModalComponent,
    FormErrorComponent,
    MultiSelectComponent,
    ListFieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './competitor-form-dialog.component.html',
  styleUrl: '../playbook-form.scss',
})
export class CompetitorFormDialogComponent implements OnInit {
  readonly competitor = input<Competitor | null>(null);
  readonly closed = output<void>();

  private readonly fb = inject(FormBuilder);
  private readonly store = inject(SalesPlaybookStore);
  private readonly lookups = inject(PlaybookLookupsService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly limits = { name: 80, website: 200, howToWin: 1200 };

  readonly submitting = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly customersLoading = signal(true);
  readonly customersFailed = signal(false);
  readonly isEdit = computed(() => !!this.competitor());

  /** Every known customer, keyed by id (fresh dropdown + already-saved mentions). */
  private readonly people = signal<Map<number, CompetitorMention>>(new Map());

  readonly customerOptions = computed<MultiSelectOption<number>[]>(() =>
    [...this.people().values()].map((m) => ({
      id: m.customerId,
      name: m.company ? `${m.name} — ${m.company}` : m.name,
    })),
  );

  readonly form = this.fb.nonNullable.group({
    name: ['', textRules(this.limits.name)],
    website: ['', textRules(this.limits.website, false)],
    strengths: this.fb.nonNullable.control<string[]>(['']),
    weaknesses: this.fb.nonNullable.control<string[]>(['']),
    howToWin: ['', textRules(this.limits.howToWin, false)],
    mentionIds: this.fb.nonNullable.control<Array<number | string>>([]),
  });

  ngOnInit(): void {
    const c = this.competitor();
    if (c) {
      this.form.setValue({
        name: c.name,
        website: c.website,
        strengths: c.strengths.length ? [...c.strengths] : [''],
        weaknesses: c.weaknesses.length ? [...c.weaknesses] : [''],
        howToWin: c.howToWin,
        mentionIds: c.mentions.map((m) => m.customerId),
      });
      this.people.set(new Map(c.mentions.map((m) => [m.customerId, m])));
    }

    this.lookups
      .customers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          const map = new Map(this.people());
          for (const r of rows) {
            map.set(r.id, { customerId: r.id, name: r.fullName?.trim() || `#${r.id}`, company: r.campanyName?.trim() || null });
          }
          this.people.set(map);
          this.customersLoading.set(false);
        },
        error: () => {
          this.customersLoading.set(false);
          this.customersFailed.set(true);
        },
      });
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;
    const v = this.form.getRawValue();
    const people = this.people();
    const payload: CompetitorInput = {
      name: v.name.trim(),
      website: v.website.trim(),
      strengths: cleanLines(v.strengths),
      weaknesses: cleanLines(v.weaknesses),
      howToWin: v.howToWin.trim(),
      mentions: v.mentionIds
        .map((id) => people.get(Number(id)))
        .filter((m): m is CompetitorMention => !!m),
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
