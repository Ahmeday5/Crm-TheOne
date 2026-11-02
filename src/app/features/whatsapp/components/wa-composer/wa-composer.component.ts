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
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  WHATSAPP_ACCEPT,
  formatBytes,
  validateAttachment,
} from '../../utils/whatsapp.util';

export interface WaComposerSubmit {
  text: string;
  file: File | null;
}

/** WhatsApp's own cap on a text message. */
const MAX_TEXT_LENGTH = 4096;
/** The textarea grows up to this many pixels, then scrolls. */
const MAX_TEXTAREA_PX = 140;

/**
 * Message input: text, or one attachment with an optional caption.
 *
 * - Enter sends, Shift+Enter breaks the line (on touch screens Enter always
 *   breaks the line — there's a send button).
 * - Files are checked against the 5 MB limit before anything is uploaded;
 *   an image can also be pasted straight from the clipboard.
 * - While `busy` (a send is in flight) typing stays possible but sending is
 *   locked, so a message can never go out twice.
 */
@Component({
  selector: 'app-wa-composer',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wa-composer.component.html',
  styleUrl: './wa-composer.component.scss',
})
export class WaComposerComponent implements OnDestroy {
  private readonly toast = inject(ToastService);
  private readonly language = inject(LanguageService);

  /** A send is in flight. */
  readonly busy = input(false);
  /** The thread can't send at all (e.g. no permission). */
  readonly disabled = input(false);

  readonly submitted = output<WaComposerSubmit>();

  private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('box');
  private readonly picker = viewChild<ElementRef<HTMLInputElement>>('picker');

  protected readonly accept = WHATSAPP_ACCEPT;
  protected readonly maxLength = MAX_TEXT_LENGTH;
  protected readonly text = signal('');
  protected readonly file = signal<File | null>(null);
  protected readonly preview = signal<string | null>(null);

  protected readonly fileSize = computed(() => {
    const f = this.file();
    return f ? formatBytes(f.size, this.language.lang()) : '';
  });
  protected readonly canSend = computed(
    () => !this.busy() && !this.disabled() && (!!this.text().trim() || !!this.file()),
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
      this.toast.error(this.t(problem === 'tooLarge' ? 'whatsapp.errors.fileTooLarge' : 'whatsapp.errors.fileEmpty'));
      return;
    }
    this.revokePreview();
    this.file.set(file);
    if (file.type.startsWith('image/')) this.preview.set(URL.createObjectURL(file));
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
