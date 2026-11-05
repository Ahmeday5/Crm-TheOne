import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { roleLabel } from '../../../../core/constants/roles.const';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ChatConversationListComponent } from '../../components/chat-conversation-list/chat-conversation-list.component';
import { ChatThreadComponent } from '../../components/chat-thread/chat-thread.component';
import { provideChatGateway } from '../../data/chat-gateway.provider';
import { ChatUser } from '../../models/team-chat.models';
import { TeamChatStore } from '../../state/team-chat.store';
import { relativeSince } from '../../utils/chat-time.util';

export const TEAM_CHAT_PATH = '/team-chat';

/**
 * Internal employee chat — `/team-chat` and `/team-chat/:conversationId`.
 *
 * Design preview on mock data; realtime comes from the Firebase adapter later
 * (see `chat-gateway.provider.ts`). The URL owns the selected conversation so
 * links and the browser back button work.
 */
@Component({
  selector: 'app-team-chat',
  standalone: true,
  imports: [TranslatePipe, UserAvatarComponent, ChatConversationListComponent, ChatThreadComponent],
  providers: [provideChatGateway(), TeamChatStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './team-chat.component.html',
  styleUrl: './team-chat.component.scss',
})
export class TeamChatComponent {
  protected readonly store = inject(TeamChatStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly language = inject(LanguageService);

  readonly infoOpen = signal(false);

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p) => p.get('conversationId'))), {
    initialValue: null,
  });

  readonly hasActive = computed(() => !!this.store.active());

  constructor() {
    effect(() => {
      const id = this.routeId();
      untracked(() => this.store.open(id));
    });
  }

  select(id: string): void {
    this.router.navigate([TEAM_CHAT_PATH, id]);
  }

  startDirect(userId: string): void {
    this.store.openDirect(userId).subscribe((c) => this.select(c.id));
  }

  backToList(): void {
    this.infoOpen.set(false);
    this.router.navigate([TEAM_CHAT_PATH]);
  }

  toggleInfo(): void {
    this.infoOpen.update((v) => !v);
  }

  roleName(u: ChatUser): string {
    return roleLabel(u.role, this.language.lang());
  }

  presenceText(u: ChatUser): string {
    const dict = TRANSLATIONS[this.language.lang()];
    if (u.presence !== 'offline' || !u.lastSeenAt) return resolveKey(dict, `teamChat.presence.${u.presence}`);
    return `${resolveKey(dict, 'teamChat.lastSeen')} ${relativeSince(u.lastSeenAt, this.language.lang())}`;
  }
}
