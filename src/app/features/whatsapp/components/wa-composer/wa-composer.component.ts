import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TRANSLATIONS, interpolate, resolveKey } from '../../../../core/i18n';
import { AuthService } from '../../../../core/services/auth.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { QuickReplyPickerComponent, fillReplyPlaceholders } from '../../../sales-playbook';
import { ComposerState } from '../../utils/composer-state.util';
import {
  AttachmentProblem,
  WHATSAPP_ACCEPT,
  WHATSAPP_ALLOWED_EXTENSIONS_LABEL,
  WHATSAPP_MAX_CAPTION_LENGTH,
  WHATSAPP_MAX_FILE_BYTES,
  WHATSAPP_MAX_TEXT_LENGTH,
  formatBytes,
  validateAttachment,
} from '../../utils/whatsapp.util';

export interface WaComposerSubmit {
  text: string;
  file: File | null;
}

const ATTACHMENT_ERROR_KEY: Record<AttachmentProblem, string> = {
  type: 'whatsapp.errors.fileType',
  tooLarge: 'whatsapp.errors.fileTooLarge',
  empty: 'whatsapp.errors.fileEmpty',
};

/** The textarea grows up to this many pixels, then scrolls. */
const MAX_TEXTAREA_PX = 140;

/**
 * The bottom of a conversation. What it shows comes from ONE computed
 * `state` (see `resolveComposerState`), never from scattered flags:
 *
 *   reply         text (≤ 4096) or one attachment + caption (≤ 1024),
 *                 with "Reply available until 3:40 PM" when < 2 h are left;
 *   templateOnly  the reason + "Send template" (emits `templateRequested`);
 *   locked        a disabled bar explaining why nothing can be sent.
 *
 * Enter sends, Shift+Enter breaks the line (touch screens: Enter always
 * breaks — there's a send button). Files are checked for type and the 16 MB
 * limit before upload; an image can be pasted from the clipboard.
 */
@Component({
  selector: 'app-wa-composer',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe, QuickReplyPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wa-composer.component.html',
  styleUrl: './wa-composer.component.scss',
})
export class WaComposerComponent implements OnDestroy {
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly auth = inject(AuthService);

  readonly state = input.required<ComposerState>();
  /** Customer's name — fills `{{customerName}}` in quick replies when known. */
  readonly contactName = input<string | null>(null);
  /** Admin hint on a disconnected channel ("re-link it in the Mihwar dashboard"). */
  readonly isAdmin = input(false);

  readonly submitted = output<WaComposerSubmit>();
  readonly templateRequested = output<void>();

  private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('box');
  private readonly picker = viewChild<ElementRef<HTMLInputElement>>('picker');

  protected readonly accept = WHATSAPP_ACCEPT;
  protected readonly maxLength = computed(() =>
    this.file() ? WHATSAPP_MAX_CAPTION_LENGTH : WHATSAPP_MAX_TEXT_LENGTH,
  );
  protected readonly text = signal('');
  protected readonly file = signal<File | null>(null);
  protected readonly preview = signal<string | null>(null);

  protected readonly fileSize = computed(() => {
    const f = this.file();
    return f ? formatBytes(f.size, this.language.lang()) : '';
  });
  protected readonly canSend = computed(
    () =>
      this.state().mode === 'reply' &&
      (!!this.text().trim() || !!this.file()) &&
      this.text().length <= this.maxLength(),
  );
  protected readonly attachHint = computed(() =>
    interpolate(this.t('whatsapp.composer.attach'), { max: formatBytes(WHATSAPP_MAX_FILE_BYTES, this.language.lang()) }),
  );

  private readonly coarsePointer =
    typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  ngOnDestroy(): void {
    this.revokePreview();
  }

  /**
   * Put a refused draft back (the server rejected it, nothing was sent).
   * Only when the composer is empty — never overwrite what the user typed since.
   */
  restore(text: string, file: File | null): boolean {
    if (this.state().mode !== 'reply' || this.text().trim() || this.file()) return false;
    if (file) this.setFile(file);
    this.setText(text.slice(0, file ? WHATSAPP_MAX_CAPTION_LENGTH : WHATSAPP_MAX_TEXT_LENGTH));
    this.focus();
    return true;
  }

  // ─────────────── input ───────────────

  protected onInput(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    this.text.set(el.value);
    this.autoGrow(el);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || this.coarsePointer) return;
    event.preventDefault();
    this.submit();
  }

  /** A pasted image becomes the attachment; anything else pastes as text. */
  protected onPaste(event: ClipboardEvent): void {
    const item = Array.from(event.clipboardData?.items ?? []).find(
      (i) => i.kind === 'file' && i.type.startsWith('image/'),
    );
    const pasted = item?.getAsFile();
    if (!pasted || this.state().mode !== 'reply') return;
    event.preventDefault();
    this.attach(pasted);
  }

  /** A sales-playbook quick reply goes in at the caret (replacing any selection) — never auto-sent. */
  protected insertReply(raw: string): void {
    const el = this.textarea()?.nativeElement;
    const snippet = fillReplyPlaceholders(raw, {
      name: this.contactName(),
      agent: this.auth.currentUser()?.fullName,
    });
    const current = this.text();
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = (current.slice(0, start) + snippet + current.slice(end)).slice(0, this.maxLength());
    const caret = Math.min(start + snippet.length, next.length);
    this.setText(next);
    if (!el) return;
    el.focus();
    el.setSelectionRange(caret, caret);
  }

  // ─────────────── attachment ───────────────

  protected openPicker(): void {
    this.picker()?.nativeElement.click();
  }

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = input.files?.[0];
    input.value = ''; // the same file can be picked again after removal
    if (picked) this.attach(picked);
  }

  protected removeFile(): void {
    this.revokePreview();
    this.file.set(null);
    this.focus();
  }

  // ─────────────── send ───────────────

  protected submit(): void {
    if (!this.canSend()) return;
    this.submitted.emit({ text: this.text().trim(), file: this.file() });
    this.reset();
  }

  private attach(file: File): void {
    const problem = validateAttachment(file);
    if (problem) {
      this.toast.error(
        interpolate(this.t(ATTACHMENT_ERROR_KEY[problem]), {
          types: WHATSAPP_ALLOWED_EXTENSIONS_LABEL,
          max: formatBytes(WHATSAPP_MAX_FILE_BYTES, this.language.lang()),
        }),
      );
      return;
    }
    this.setFile(file);
    // A caption is shorter than a message — trim what was typed to fit.
    if (this.text().length > WHATSAPP_MAX_CAPTION_LENGTH) this.setText(this.text().slice(0, WHATSAPP_MAX_CAPTION_LENGTH));
    this.focus();
  }

  private setFile(file: File): void {
    this.revokePreview();
    this.file.set(file);
    if (file.type.startsWith('image/')) this.preview.set(URL.createObjectURL(file));
  }

  private setText(value: string): void {
    this.text.set(value);
    const el = this.textarea()?.nativeElement;
    if (!el) return;
    el.value = value;
    this.autoGrow(el);
  }

  private reset(): void {
    this.setText('');
    this.revokePreview();
    this.file.set(null);
    this.focus();
  }

  private autoGrow(el: HTMLTextAreaElement): void {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
  }

  private focus(): void {
    if (!this.coarsePointer) queueMicrotask(() => this.textarea()?.nativeElement.focus());
  }

  private revokePreview(): void {
    const url = this.preview();
    if (url) URL.revokeObjectURL(url);
    this.preview.set(null);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
