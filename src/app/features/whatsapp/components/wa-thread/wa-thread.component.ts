import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { WhatsAppMessage } from '../../models/whatsapp.models';
import { ThreadMessage, ThreadSource, WhatsAppThreadStore } from '../../state/whatsapp-thread.store';
import { groupMessagesByDay, isOutgoing, relativeDay } from '../../utils/whatsapp.util';
import { WaComposerComponent, WaComposerSubmit } from '../wa-composer/wa-composer.component';
import { WaImagePreview, WaMessageBubbleComponent } from '../wa-message-bubble/wa-message-bubble.component';

/** Within this many px of the bottom counts as "reading the latest". */
const NEAR_BOTTOM_PX = 120;

/**
 * A full conversation: messages (grouped by Cairo day) + composer.
 * Used by the inbox for the open chat and by the customer dialog's WhatsApp
 * tab. Owns its own `WhatsAppThreadStore`, so several threads can coexist.
 *
 * Scrolling follows chat conventions: open at the latest message; new
 * messages scroll into view only if the user is already at the bottom
 * (otherwise a "new messages" pill appears); loading older history keeps the
 * user's place.
 *
 * Project a header with the `waThreadHeader` attribute.
 */
@Component({
  selector: 'app-wa-thread',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe, ModalComponent, WaMessageBubbleComponent, WaComposerComponent],
  providers: [WhatsAppThreadStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wa-thread.component.html',
  styleUrl: './wa-thread.component.scss',
})
export class WaThreadComponent {
  protected readonly store = inject(WhatsAppThreadStore);

  readonly source = input<ThreadSource | null>(null);
  /** i18n keys for the empty conversation state. */
  readonly emptyTitleKey = input('whatsapp.thread.empty');
  readonly emptyHintKey = input('whatsapp.thread.emptyHint');
  /** Show "by {employee}" under our messages (useful when several people share a chat). */
  readonly showSender = input(true);

  /** Each message the server confirmed as sent from this thread. */
  readonly sent = output<WhatsAppMessage>();

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  protected readonly groups = computed(() => groupMessagesByDay(this.store.messages()));
  protected readonly unseen = signal(0);
  protected readonly viewer = signal<WaImagePreview | null>(null);

  private nearBottom = true;
  private firstKey: string | null = null;
  private lastKey: string | null = null;
  private pendingScroll: 'bottom' | 'preserve' | null = null;
  /** Distance from the bottom before older history was prepended. */
  private preserveOffset = 0;

  constructor() {
    effect(
      () => {
        const source = this.source();
        untracked(() => {
          this.resetScrollState();
          this.store.connect(source);
        });
      },
      { allowSignalWrites: true },
    );

    effect(
      () => {
        const list = this.store.messages();
        untracked(() => this.onMessagesChanged(list));
      },
      { allowSignalWrites: true },
    );

    afterRender(() => this.applyPendingScroll());

    this.store.sent$.pipe(takeUntilDestroyed()).subscribe((m) => this.sent.emit(m));
  }

  /** Re-read now — e.g. the host saw a new-message notification. */
  refresh(): void {
    this.store.refresh();
  }

  // ─────────────── template handlers ───────────────

  protected onSubmit({ text, file }: WaComposerSubmit): void {
    this.store.send(text, file);
  }

  protected retry(message: ThreadMessage): void {
    this.store.retry(message);
  }

  protected loadOlder(): void {
    const el = this.scroller()?.nativeElement;
    if (el) this.preserveOffset = el.scrollHeight - el.scrollTop;
    this.store.loadOlder();
  }

  protected onScroll(): void {
    const el = this.scroller()?.nativeElement;
    if (!el) return;
    this.nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    if (this.nearBottom && this.unseen()) this.unseen.set(0);
  }

  protected jumpToLatest(): void {
    this.unseen.set(0);
    this.scrollToBottom('smooth');
  }

  protected dayLabelKey(dayKey: string): string | null {
    const rel = relativeDay(dayKey);
    return rel ? `whatsapp.thread.${rel}` : null;
  }

  protected trackMessage(m: ThreadMessage): string {
    return m.local?.key ?? String(m.id);
  }

  // ─────────────── scrolling ───────────────

  private onMessagesChanged(list: readonly ThreadMessage[]): void {
    if (!list.length) {
      this.firstKey = this.lastKey = null;
      return;
    }
    const first = this.trackMessage(list[0]);
    const last = this.trackMessage(list[list.length - 1]);

    if (this.lastKey === null) {
      this.pendingScroll = 'bottom';
    } else if (first !== this.firstKey && last === this.lastKey) {
      this.pendingScroll = 'preserve';
    } else if (last !== this.lastKey) {
      // Our own send always comes into view; a customer reply only if we're at the bottom.
      if (this.nearBottom || isOutgoing(list[list.length - 1])) this.pendingScroll = 'bottom';
      else this.unseen.update((n) => n + 1);
    }

    this.firstKey = first;
    this.lastKey = last;
  }

  private applyPendingScroll(): void {
    const mode = this.pendingScroll;
    const el = this.scroller()?.nativeElement;
    if (!mode || !el) return;
    this.pendingScroll = null;
    if (mode === 'bottom') this.scrollToBottom('auto');
    else el.scrollTop = el.scrollHeight - this.preserveOffset;
  }

  private scrollToBottom(behavior: ScrollBehavior): void {
    const el = this.scroller()?.nativeElement;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    this.nearBottom = true;
  }

  private resetScrollState(): void {
    this.firstKey = this.lastKey = null;
    this.pendingScroll = null;
    this.nearBottom = true;
    this.unseen.set(0);
    this.viewer.set(null);
  }
}
