import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { TipDirective } from '../../../../shared/directives/tip.directive';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ChatMessage } from '../../models/team-chat.models';
import { TeamChatStore } from '../../state/team-chat.store';
import { formatClock, formatDaySeparator, relativeSince } from '../../utils/chat-time.util';
import { ChatComposerComponent } from '../chat-composer/chat-composer.component';

/** Px from the bottom that still counts as "reading the latest". */
const STICK_THRESHOLD = 120;

/** Middle pane: header, message history (grouped), typing indicator, composer. */
@Component({
  selector: 'app-chat-thread',
  standalone: true,
  imports: [TranslatePipe, TipDirective, UserAvatarComponent, ChatComposerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat-thread.component.html',
  styleUrl: './chat-thread.component.scss',
})
export class ChatThreadComponent {
  protected readonly store = inject(TeamChatStore);
  private readonly language = inject(LanguageService);
  private readonly injector = inject(Injector);

  readonly infoOpen = input(false);
  readonly back = output<void>();
  readonly toggleInfo = output<void>();

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly composer = viewChild(ChatComposerComponent);

  /** User scrolled up → don't yank them down; offer a jump button instead. */
  readonly atBottom = signal(true);
  readonly pendingNew = signal(0);

  readonly subtitle = computed(() => {
    const c = this.store.active();
    if (!c) return '';
    const dict = TRANSLATIONS[this.language.lang()];
    if (c.kind === 'channel') {
      return `${c.memberIds.length} ${resolveKey(dict, 'teamChat.members')}${c.topic ? ` · ${c.topic}` : ''}`;
    }
    const p = this.store.peer();
    if (!p) return '';
    if (p.presence === 'online') return resolveKey(dict, 'teamChat.presence.online');
    if (p.presence === 'away') return resolveKey(dict, 'teamChat.presence.away');
    return p.lastSeenAt
      ? `${resolveKey(dict, 'teamChat.lastSeen')} ${relativeSince(p.lastSeenAt, this.language.lang())}`
      : resolveKey(dict, 'teamChat.presence.offline');
  });

  constructor() {
    // New conversation → jump to the latest message and focus the input.
    effect(() => {
      const id = this.store.activeId();
      untracked(() => {
        this.pendingNew.set(0);
        this.atBottom.set(true);
        if (id) this.afterRender(() => {
          this.scrollToBottom(false);
          this.composer()?.focus();
        });
      });
    });

    // New messages → follow if the reader is at the bottom, else count them.
    let lastCount = 0;
    effect(() => {
      const count = this.store.messageCount();
      untracked(() => {
        const grew = count > lastCount;
        lastCount = count;
        if (!grew) return;
        if (this.atBottom()) {
          this.store.markActiveRead();
          this.afterRender(() => this.scrollToBottom(true));
        } else {
          this.pendingNew.update((n) => n + 1);
        }
      });
    });
  }

  onScroll(): void {
    const el = this.scroller()?.nativeElement;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD;
    this.atBottom.set(bottom);
    if (bottom && this.pendingNew()) {
      this.pendingNew.set(0);
      this.store.markActiveRead();
    }
  }

  jumpToLatest(): void {
    this.pendingNew.set(0);
    this.scrollToBottom(true);
    this.store.markActiveRead();
  }

  onSend(text: string): void {
    this.atBottom.set(true);
    this.store.send(text);
  }

  // ─────────── view helpers ───────────

  clock(m: ChatMessage): string {
    return formatClock(m.sentAt, this.language.lang());
  }

  dayLabel(iso: string): string {
    const dict = TRANSLATIONS[this.language.lang()];
    return formatDaySeparator(iso, this.language.lang(), {
      today: resolveKey(dict, 'teamChat.today'),
      yesterday: resolveKey(dict, 'teamChat.yesterday'),
    });
  }

  statusIcon(m: ChatMessage): string {
    switch (m.status) {
      case 'sending': return 'fa-regular fa-clock';
      case 'sent': return 'fa-solid fa-check';
      case 'failed': return 'fa-solid fa-circle-exclamation';
      default: return 'fa-solid fa-check-double';
    }
  }

  // ─────────── internals ───────────

  private scrollToBottom(smooth: boolean): void {
    const el = this.scroller()?.nativeElement;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }

  private afterRender(fn: () => void): void {
    afterNextRender(fn, { injector: this.injector });
  }
}
