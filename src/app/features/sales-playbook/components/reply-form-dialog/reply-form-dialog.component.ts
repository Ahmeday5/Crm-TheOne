import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { startWith } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { ApiError } from '../../../../core/models/api-response.model';
import { AuthService } from '../../../../core/services/auth.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { FormErrorComponent } from '../../../../shared/components/form-error/form-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { PlaybookLookupsService } from '../../data/playbook-lookups.service';
import { PlaybookServiceRef, QuickReply, QuickReplyInput } from '../../models/sales-playbook.models';
import { SalesPlaybookStore } from '../../state/sales-playbook.store';
import {
  AGENT_NAME_TOKEN,
  CUSTOMER_NAME_TOKEN,
  categoryMeta,
  fillReplyPlaceholders,
} from '../../utils/playbook.util';
import { textRules } from '../../utils/playbook-validators.util';

@Component({
  selector: 'app-pb-reply-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, ModalComponent, FormErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reply-form-dialog.component.html',
  styleUrls: ['../playbook-form.scss', './reply-form-dialog.component.scss'],
})
export class ReplyFormDialogComponent implements OnInit {
  readonly reply = input<QuickReply | null>(null);
  readonly defaultCategory = input<string>('');
  readonly closed = output<void>();

  private readonly fb = inject(FormBuilder);
  private readonly store = inject(SalesPlaybookStore);
  private readonly lookups = inject(PlaybookLookupsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly textArea = viewChild<ElementRef<HTMLTextAreaElement>>('textArea');

  /** Backend limits (`QuickReplies`); 4096 is also WhatsApp's own text limit. */
  readonly limits = { title: 150, text: 4096, category: 100 };
  readonly customerToken = CUSTOMER_NAME_TOKEN;
  readonly agentToken = AGENT_NAME_TOKEN;

  readonly suggestions = computed(() => this.store.replyCategories().map((c) => c.category));
  readonly metaOf = categoryMeta;

  readonly services = signal<PlaybookServiceRef[]>([]);
  readonly servicesLoading = signal(true);
  readonly submitting = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly isEdit = computed(() => !!this.reply());

  readonly form = this.fb.nonNullable.group({
    title: ['', textRules(this.limits.title)],
    category: ['', textRules(this.limits.category, false)],
    serviceId: this.fb.control<number | null>(null),
    text: ['', textRules(this.limits.text)],
  });

  readonly value = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  /** The bubble shows the message as a customer would receive it. */
  readonly preview = computed(() =>
    fillReplyPlaceholders(this.value().text ?? '', {
      name: this.t('salesPlaybook.form.sampleCustomer'),
      agent: this.auth.currentUser()?.fullName || this.t('salesPlaybook.form.sampleAgent'),
    }),
  );

  ngOnInit(): void {
    const r = this.reply();
    if (r) {
      this.form.setValue({ title: r.title, category: r.category ?? '', serviceId: r.service?.id ?? null, text: r.text });
      if (r.service) this.services.set([r.service]);
    } else {
      this.form.controls.category.setValue(this.defaultCategory());
    }

    this.lookups
      .services()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          const linked = this.reply()?.service;
          this.services.set(linked && !rows.some((x) => x.id === linked.id) ? [linked, ...rows] : rows);
          this.servicesLoading.set(false);
        },
        error: () => this.servicesLoading.set(false),
      });
  }

  serviceLabel(s: PlaybookServiceRef): string {
    return (this.language.lang() === 'en' ? s.nameEn || s.nameAr : s.nameAr || s.nameEn) || `#${s.id}`;
  }

  pickCategory(category: string): void {
    this.form.controls.category.setValue(category);
  }

  /** Drops a placeholder token at the caret. */
  insertToken(token: string): void {
    const el = this.textArea()?.nativeElement;
    const control = this.form.controls.text;
    const current = control.value;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    control.setValue(current.slice(0, start) + token + current.slice(end));
    control.markAsDirty();
    queueMicrotask(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;
    const v = this.form.getRawValue();
    const payload: QuickReplyInput = {
      title: v.title.trim(),
      category: v.category.trim() || null,
      text: v.text.trim(),
      service: this.services().find((s) => s.id === Number(v.serviceId)) ?? null,
      sortOrder: this.reply()?.sortOrder ?? this.nextSortOrder(),
    };
    this.submitting.set(true);
    this.serverError.set(null);
    this.store.save('replies', payload, this.reply()?.id).subscribe({
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

  /** New replies go to the end of the list. */
  private nextSortOrder(): number {
    return Math.max(0, ...this.store.replies().map((r) => r.sortOrder)) + 1;
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
