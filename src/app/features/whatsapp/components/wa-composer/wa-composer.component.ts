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
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { QuickReplyPickerComponent, fillReplyPlaceholders } from '../../../sales-playbook';
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
 * Message input: text (≤ 4096), or one attachment with an optional caption
 * (≤ 1024).
 *
 * - Enter sends, Shift+Enter breaks the line (on touch screens Enter always
 *   breaks the line — there's a send button).
 * - Files are checked for type and the 3.5 MB limit before anything is
 *   uploaded; an image can also be pasted straight from the clipboard.
 * - Sending never locks the composer: the thread shows each message as its
 *   own "sending" bubble while the provider's anti-ban delay runs.
 */
@Component({
  selector: 'app-wa-composer',
  standalone: true,
  imports: [TranslatePipe, QuickReplyPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wa-composer.component.html',
  styleUrl: './wa-composer.component.scss',
})
export class WaComposerComponent implements OnDestroy {
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  /** At least one message is still on its way — shows the anti-ban delay hint. */
  readonly sending = input(false);
  /** The thread can't send (no permission, number disconnected). */
  readonly disabled = input(false);
  /** Customer's name — fills `{name}` in quick replies when known. */
  readonly contactName = input<string | null>(null);

  readonly submitted = output<WaComposerSubmit>();

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
      !this.disabled() &&
      (!!this.text().trim() || !!this.file()) &&
      this.text().length <= this.maxLength(),
  );

  private readonly coarsePointer =
    typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  ngOnDestroy(): void {
    this.revokePreview();
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
    if (!pasted || this.disabled()) return;
    event.preventDefault();
    this.attach(pasted);
  }

  /** A sales-playbook quick reply goes in at the caret (replacing any selection) — never auto-sent. */
  protected insertReply(raw: string): void {
    const el = this.textarea()?.nativeElement;
    const snippet = fillReplyPlaceholders(raw, { name: this.contactName() });
    const current = this.text();
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = (current.slice(0, start) + snippet + current.slice(end)).slice(0, this.maxLength());
    const caret = Math.min(start + snippet.length, next.length);
    this.text.set(next);
    if (!el) return;
    el.value = next;
    this.autoGrow(el);
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
    this.revokePreview();
    this.file.set(file);
    if (file.type.startsWith('image/')) this.preview.set(URL.createObjectURL(file));
    // A caption is shorter than a message — trim what was typed to fit.
    if (this.text().length > WHATSAPP_MAX_CAPTION_LENGTH) this.text.set(this.text().slice(0, WHATSAPP_MAX_CAPTION_LENGTH));
    this.focus();
  }

  private reset(): void {
    this.text.set('');
    this.revokePreview();
    this.file.set(null);
    const el = this.textarea()?.nativeElement;
    if (el) {
      el.value = '';
      this.autoGrow(el);
    }
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
