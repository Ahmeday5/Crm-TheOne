import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

const MAX_LENGTH = 2000;
const TYPING_IDLE_MS = 2500;
const QUICK_EMOJIS = ['👍', '🙏', '😂', '❤️', '🔥', '✅', '👏', '🎉', '😅', '🤝', '👀', '💯', '🙌', '😊', '🚀', '📌'];

/**
 * Message input: auto-growing textarea, Enter to send (Shift+Enter = newline),
 * quick emoji picker, typing signal. Attachments are shown but disabled until
 * the Firebase adapter (Storage) lands.
 */
@Component({
  selector: 'app-chat-composer',
  standalone: true,
  imports: [TranslatePipe, TipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat-composer.component.html',
  styleUrl: './chat-composer.component.scss',
})
export class ChatComposerComponent implements OnDestroy {
  readonly placeholder = input('');
  readonly send = output<string>();
  readonly typing = output<boolean>();

  readonly emojis = QUICK_EMOJIS;
  readonly maxLength = MAX_LENGTH;
  readonly text = signal('');
  readonly emojiOpen = signal(false);

  private readonly textarea = viewChild.required<ElementRef<HTMLTextAreaElement>>('field');
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('root');
  private typingTimer?: ReturnType<typeof setTimeout>;
  private isTyping = false;

  ngOnDestroy(): void {
    this.stopTyping();
  }

  onInput(value: string): void {
    this.text.set(value);
    this.autoGrow();
    if (!this.isTyping) {
      this.isTyping = true;
      this.typing.emit(true);
    }
    clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => this.stopTyping(), TYPING_IDLE_MS);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.submit();
    }
  }

  submit(): void {
    const value = this.text().trim();
    if (!value) return;
    this.send.emit(value);
    this.text.set('');
    const el = this.textarea().nativeElement;
    el.value = '';
    this.autoGrow();
    this.stopTyping();
    el.focus();
  }

  insertEmoji(emoji: string): void {
    const el = this.textarea().nativeElement;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = `${el.value.slice(0, start)}${emoji}${el.value.slice(end)}`;
    el.value = next;
    this.text.set(next);
    el.focus();
    el.setSelectionRange(start + emoji.length, start + emoji.length);
    this.autoGrow();
  }

  /** Focus the field from outside (e.g. after opening a conversation). */
  focus(): void {
    this.textarea().nativeElement.focus();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.emojiOpen() && !this.host().nativeElement.contains(event.target as Node)) {
      this.emojiOpen.set(false);
    }
  }

  private autoGrow(): void {
    const el = this.textarea().nativeElement;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }

  private stopTyping(): void {
    clearTimeout(this.typingTimer);
    if (this.isTyping) {
      this.isTyping = false;
      this.typing.emit(false);
    }
  }
}
