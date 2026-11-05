import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
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
import {
  QuickReply,
  QuickReplyInput,
  REPLY_CATEGORIES,
  ReplyCategory,
} from '../../models/sales-playbook.models';
import { SalesPlaybookStore } from '../../state/sales-playbook.store';
import { REPLY_META } from '../../utils/playbook.util';
import { textRules } from '../../utils/playbook-validators.util';

/** WhatsApp's own text limit. */
const TEXT_MAX = 4096;
const NAME_TOKEN = '{name}';

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
  readonly defaultCategory = input<ReplyCategory>('greeting');
  readonly closed = output<void>();

  private readonly fb = inject(FormBuilder);
  private readonly store = inject(SalesPlaybookStore);
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly textArea = viewChild<ElementRef<HTMLTextAreaElement>>('textArea');

  readonly categories = REPLY_CATEGORIES;
  readonly meta = REPLY_META;
  readonly limits = { title: 80, text: TEXT_MAX };
  readonly nameToken = NAME_TOKEN;

  readonly submitting = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly isEdit = computed(() => !!this.reply());

  readonly form = this.fb.nonNullable.group({
    title: ['', textRules(this.limits.title)],
    category: this.fb.nonNullable.control<ReplyCategory>('greeting'),
    text: ['', textRules(this.limits.text)],
  });

  readonly value = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  ngOnInit(): void {
    const r = this.reply();
    if (r) this.form.setValue({ title: r.title, category: r.category, text: r.text });
    else this.form.controls.category.setValue(this.defaultCategory());
  }

  /** Drops `{name}` at the caret. */
  insertName(): void {
    const el = this.textArea()?.nativeElement;
    const control = this.form.controls.text;
    const current = control.value;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    control.setValue(current.slice(0, start) + NAME_TOKEN + current.slice(end));
    control.markAsDirty();
    queueMicrotask(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + NAME_TOKEN.length, start + NAME_TOKEN.length);
    });
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;
    const v = this.form.getRawValue();
    const payload: QuickReplyInput = { title: v.title.trim(), category: v.category, text: v.text.trim() };
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

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
