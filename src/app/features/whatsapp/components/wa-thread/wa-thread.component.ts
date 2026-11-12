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
import { Observable } from 'rxjs';
import { ToastService } from '../../../../core/services/toast.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { WaMessage } from '../../models/whatsapp.models';
import { WhatsAppSessionStore } from '../../state/whatsapp-session.store';
import {
  RejectedDraft,
  TemplateSend,
  ThreadMessage,
  ThreadSource,
  WhatsAppThreadStore,
} from '../../state/whatsapp-thread.store';
import { groupMessagesByDay, isOutgoing, relativeDay } from '../../utils/whatsapp.util';
import { WaComposerComponent, WaComposerSubmit } from '../wa-composer/wa-composer.component';
import { WaImagePreview, WaMessageBubbleComponent } from '../wa-message-bubble/wa-message-bubble.component';
import { WaTemplatePickerDialogComponent } from '../wa-template-picker-dialog/wa-template-picker-dialog.component';

/** Within this many px of the bottom counts as "reading the latest". */
const NEAR_BOTTOM_PX = 120;
/** Older history starts loading this close to the top. */
const LOAD_OLDER_PX = 80;

/**
 * A full conversation: messages (grouped by Cairo day) + composer. Used by
 * the inbox for the open chat and by the customer dialog's WhatsApp tab.
 * Owns its own `WhatsAppThreadStore`, so several threads can coexist.
 *
 * Scrolling follows chat conventions: open at the latest message; scrolling
 * to the top loads older history without moving what the user is reading;
 * new messages scroll into view only if the user is already near the bottom
 * (otherwise a "new messages" pill appears).
 *
 * The composer's mode comes from the store's single `composer` state; the
 * template picker opens from it. A send the server refuses (400) is shown as
 * a toast and its text / file go back into the composer.
 *
 * Project a header with the `waThreadHeader` attribute.
 */
@Component({
  selector: 'app-wa-thread',
  standalone: true,
  imports: [
    TranslatePipe,
    CairoDatePipe,
    ModalComponent,
    WaMessageBubbleComponent,
    WaComposerComponent,
    WaTemplatePickerDialogComponent,
  ],
  providers: [WhatsAppThreadStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wa-thread.component.html',
  styleUrl: './wa-thread.component.scss',
})
export class WaThreadComponent {
  protected readonly store = inject(WhatsAppThreadStore);
  protected readonly session = inject(WhatsAppSessionStore);
  private readonly toast = inject(ToastService);

  readonly source = input<ThreadSource | null>(null);
  /** Customer's name — fills `{{customerName}}` in quick replies, shown in the template dialog. */
  readonly contactName = input<string | null>(null);
  /** i18n keys for the empty conversation state. */
  readonly emptyTitleKey = input('whatsapp.thread.empty');
  readonly emptyHintKey = input('whatsapp.thread.emptyHint');
  /** Show "by {employee}" under our messages (useful when several people share a channel). */
  readonly showSender = input(true);

  /** Each message the server stored from this thread. */
  readonly sent = output<WaMessage>();
  /** The chat was marked read (by id). */
  readonly read = output<number>();

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly composer = viewChild(WaComposerComponent);

  /** The chat of the newest message — for "Open in inbox" from a customer tab. */
  readonly latestChatId = this.store.latestChatId;

  protected readonly groups = computed(() => groupMessagesByDay(this.store.messages()));
  protected readonly unseen = signal(0);
  protected readonly viewer = signal<WaImagePreview | null>(null);
  protected readonly templateOpen = signal(false);
  /** Admins list the templates of the chat's own number. */
  protected readonly templateInstanceId = computed(() => (this.session.isAdmin() ? this.store.instanceId() : null));
  protected readonly sendTemplate = (request: TemplateSend): Observable<WaMessage> => this.store.sendTemplate(request);

  private sourceKey: string | null = null;
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
          // The host rebuilds the source on every chat update — only a different conversation resets the view.
          const key = sourceKey(source);
          if (key !== this.sourceKey) {
            this.sourceKey = key;
            this.resetScrollState();
          }
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
    this.store.read$.pipe(takeUntilDestroyed()).subscribe((id) => this.read.emit(id));
    this.store.rejected$.pipe(takeUntilDestroyed()).subscribe((draft) => this.onRejected(draft));
  }

  /** Merge the latest messages now (retry). */
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

  protected onTemplateSent(): void {
    this.templateOpen.set(false);
    this.scrollToBottom('smooth');
  }

  protected onScroll(): void {
    const el = this.scroller()?.nativeElement;
    if (!el) return;
    this.nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    if (this.nearBottom && this.unseen()) this.unseen.set(0);
    if (el.scrollTop < LOAD_OLDER_PX) this.loadOlder();
  }

  protected loadOlder(): void {
    if (!this.store.canLoadOlder() || this.store.loadingOlder()) return;
    const el = this.scroller()?.nativeElement;
    if (el) this.preserveOffset = el.scrollHeight - el.scrollTop;
    this.store.loadOlder();
  }

  protected jumpToLatest(): void {
    this.unseen.set(0);
    this.scrollToBottom('smooth');
  }

  protected dayLabelKey(dayKey: string): string | null {
    const rel = relativeDay(dayKey);
    return rel ? `whatsapp.thread.${rel}` : null;
  }

  /** Optimistic and stored copies share the `clientMessageId`, so a bubble never re-mounts on confirm. */
  protected trackMessage(m: ThreadMessage): string {
    return m.clientMessageId ? `c:${m.clientMessageId}` : `s:${m.id}`;
  }

  /** Nothing was sent: say why, and hand the draft back when the composer is free. */
  private onRejected(draft: RejectedDraft): void {
    this.toast.error(draft.reason);
    if (this.composer()?.restore(draft.text, draft.file)) this.store.discard(draft.clientMessageId);
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
      // Our own send always comes into view; a customer reply only if we're near the bottom.
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
    this.templateOpen.set(false);
  }
}

function sourceKey(source: ThreadSource | null): string | null {
  if (!source) return null;
  return source.kind === 'chat' ? `chat:${source.chatId}` : `customer:${source.customerId}`;
}
