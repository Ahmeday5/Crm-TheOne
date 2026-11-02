import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { NotificationsStore } from '../../../../core/services/notifications.store';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { isWhatsAppNotification } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { WaChatListComponent } from '../../components/wa-chat-list/wa-chat-list.component';
import { WaNumberStatusComponent } from '../../components/wa-number-status/wa-number-status.component';
import { WaThreadComponent } from '../../components/wa-thread/wa-thread.component';
import { WhatsAppChat } from '../../models/whatsapp.models';
import { WhatsAppChatsStore } from '../../state/whatsapp-chats.store';
import { ThreadSource } from '../../state/whatsapp-thread.store';
import { chatDisplayName, formatWhatsAppPhone, recipientForChat } from '../../utils/whatsapp.util';

/**
 * `/whatsapp` and `/whatsapp/:chatId` — a WhatsApp-Web-style inbox for
 * Admin, Sales and Support. The URL owns the open chat, so the browser's
 * back button, notification deep links and page reloads all just work.
 *
 * Desktop: conversations on one side, the open thread beside it.
 * Phones: one pane at a time — the list, or the thread with a back button.
 */
@Component({
  selector: 'app-whatsapp-inbox',
  standalone: true,
  imports: [
    TranslatePipe,
    PageHeaderComponent,
    UserAvatarComponent,
    WaChatListComponent,
    WaThreadComponent,
    WaNumberStatusComponent,
  ],
  providers: [WhatsAppChatsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './whatsapp-inbox.component.html',
  styleUrl: './whatsapp-inbox.component.scss',
})
export class WhatsAppInboxComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationsStore);
  protected readonly chats = inject(WhatsAppChatsStore);

  private readonly thread = viewChild(WaThreadComponent);

  protected readonly isAdmin = computed(() => this.auth.currentRole() === 'Admin');

  protected readonly activeChatId = toSignal(
    this.route.paramMap.pipe(
      map((params) => {
        const id = Number(params.get('chatId'));
        return Number.isInteger(id) && id > 0 ? id : null;
      }),
    ),
    { initialValue: null },
  );

  /**
   * Every chat seen this session. The open chat keeps its header and
   * recipient even when a search filters it out of the visible list.
   */
  private readonly knownChats = signal<ReadonlyMap<number, WhatsAppChat>>(new Map());

  protected readonly activeChat = computed(() => {
    const id = this.activeChatId();
    return id ? this.knownChats().get(id) ?? null : null;
  });

  protected readonly source = computed<ThreadSource | null>(() => {
    const id = this.activeChatId();
    if (!id) return null;
    const chat = this.activeChat();
    return { kind: 'chat', chatId: id, recipient: chat ? recipientForChat(chat) : null };
  });

  constructor() {
    effect(
      () => {
        const id = this.activeChatId();
        untracked(() => {
          this.chats.setActive(id);
          if (id) this.chats.markReadLocally(id);
        });
      },
      { allowSignalWrites: true },
    );

    effect(
      () => {
        const list = this.chats.chats();
        untracked(() => this.remember(list));
      },
      { allowSignalWrites: true },
    );

    // A new-message notification → refresh at once instead of waiting for the poll.
    this.notifications.arrivals$
      .pipe(
        map((batch) => batch.filter(isWhatsAppNotification)),
        filter((batch) => batch.length > 0),
        takeUntilDestroyed(),
      )
      .subscribe((batch) => {
        this.chats.refresh();
        const open = this.activeChatId();
        if (open && batch.some((n) => n.relatedEntityId === open)) this.thread()?.refresh();
      });
  }

  ngOnInit(): void {
    this.chats.start();
  }

  protected open(chat: WhatsAppChat): void {
    if (chat.id === this.activeChatId()) return;
    this.router.navigate(['/whatsapp', chat.id]);
  }

  protected backToList(): void {
    this.router.navigate(['/whatsapp']);
  }

  /** Our reply changes the chat's preview and position — re-read the list. */
  protected onSent(): void {
    this.chats.refresh();
  }

  protected name(chat: WhatsAppChat): string {
    return chatDisplayName(chat);
  }

  protected phone(chat: WhatsAppChat): string {
    return formatWhatsAppPhone(chat.phone);
  }

  private remember(list: readonly WhatsAppChat[]): void {
    if (!list.length) return;
    this.knownChats.update((current) => {
      const next = new Map(current);
      for (const chat of list) next.set(chat.id, chat);
      return next;
    });
  }
}
