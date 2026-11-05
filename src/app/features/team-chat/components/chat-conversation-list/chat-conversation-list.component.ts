import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ChatUser, Conversation } from '../../models/team-chat.models';
import { ConversationFilter, TeamChatStore } from '../../state/team-chat.store';
import { formatListTime } from '../../utils/chat-time.util';

/** Left pane: search, filter tabs, people strip and the conversation list. */
@Component({
  selector: 'app-chat-conversation-list',
  standalone: true,
  imports: [TranslatePipe, UserAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat-conversation-list.component.html',
  styleUrl: './chat-conversation-list.component.scss',
})
export class ChatConversationListComponent {
  protected readonly store = inject(TeamChatStore);
  private readonly language = inject(LanguageService);

  readonly select = output<string>();
  readonly startDirect = output<string>();

  readonly filters: ConversationFilter[] = ['all', 'direct', 'channel', 'unread'];
  readonly showPeople = signal(false);

  time(c: Conversation): string {
    const at = c.lastMessage?.sentAt;
    if (!at) return '';
    const lang = this.language.lang();
    return formatListTime(at, lang, resolveKey(TRANSLATIONS[lang], 'teamChat.yesterday'));
  }

  preview(c: Conversation): string {
    const m = c.lastMessage;
    if (!m) return resolveKey(TRANSLATIONS[this.language.lang()], 'teamChat.noMessagesYet');
    if (m.senderId === this.store.me.id) {
      return `${resolveKey(TRANSLATIONS[this.language.lang()], 'teamChat.you')}: ${m.text}`;
    }
    if (c.kind === 'channel') {
      const name = this.store.usersById().get(m.senderId)?.name.split(' ')[0];
      return name ? `${name}: ${m.text}` : m.text;
    }
    return m.text;
  }

  peer(c: Conversation): ChatUser | null {
    return this.store.peerOf(c);
  }

  isMineLast(c: Conversation): boolean {
    return c.lastMessage?.senderId === this.store.me.id;
  }
}
