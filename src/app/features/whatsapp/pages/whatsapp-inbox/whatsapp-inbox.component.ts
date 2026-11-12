import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { NotificationToastService } from '../../../../core/services/notification-toast.service';
import { NotificationsStore } from '../../../../core/services/notifications.store';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { WHATSAPP_CHAT_ENTITY, isWhatsAppNotification } from '../../../../shared/models';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { CustomerDetailsDialogComponent } from '../../../leads/components/customer-details-dialog/customer-details-dialog.component';
import { WaChannelBadgeComponent } from '../../components/wa-channel-badge/wa-channel-badge.component';
import { WaChannelListComponent } from '../../components/wa-channel-list/wa-channel-list.component';
import { WaChatListComponent } from '../../components/wa-chat-list/wa-chat-list.component';
import { WaNewChatDialogComponent } from '../../components/wa-new-chat-dialog/wa-new-chat-dialog.component';
import { WaNumberCardComponent } from '../../components/wa-number-card/wa-number-card.component';
import { WaThreadComponent } from '../../components/wa-thread/wa-thread.component';
import { WaChat, WaInstance, WaMessage } from '../../models/whatsapp.models';
import { WhatsAppRealtimeService } from '../../services/whatsapp-realtime.service';
import { WindowFocusService } from '../../services/window-focus.service';
import { WhatsAppInboxStore } from '../../state/whatsapp-inbox.store';
import { WhatsAppSessionStore } from '../../state/whatsapp-session.store';
import { ThreadSource } from '../../state/whatsapp-thread.store';
import { channelLabel, chatDisplayName, formatWhatsAppPhone, isChannelActive } from '../../utils/whatsapp.util';

/**
 * `/whatsapp` and `/whatsapp/chats/:chatId` — the WhatsApp + Messenger inbox.
 *
 * Three columns (RTL aware):
 *   1. Admin: channels (every number and page) · Employee: their own channels;
 *   2. chats (search, All / Unread, infinite scroll);
 *   3. the open conversation.
 * Phones show one pane at a time. The URL owns the open chat (`chatId`) and
 * the admin's channel filter (`?channel=`), so back / reload / notification
 * deep links all land in the same place.
 */
@Component({
  selector: 'app-whatsapp-inbox',
  standalone: true,
  imports: [
    RouterLink,
    TranslatePipe,
    PageHeaderComponent,
    UserAvatarComponent,
    WaChannelBadgeComponent,
    WaChannelListComponent,
    WaChatListComponent,
    WaThreadComponent,
    WaNumberCardComponent,
    WaNewChatDialogComponent,
    CustomerDetailsDialogComponent,
  ],
  providers: [WhatsAppInboxStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './whatsapp-inbox.component.html',
  styleUrl: './whatsapp-inbox.component.scss',
})
export class WhatsAppInboxComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly language = inject(LanguageService);
  private readonly notifications = inject(NotificationsStore);
  private readonly notificationToasts = inject(NotificationToastService);
  private readonly focus = inject(WindowFocusService);
  protected readonly realtime = inject(WhatsAppRealtimeService);
  protected readonly session = inject(WhatsAppSessionStore);
  protected readonly inbox = inject(WhatsAppInboxStore);

  protected readonly isAdmin = this.session.isAdmin;

  protected readonly activeChatId = toSignal(
    this.route.paramMap.pipe(
      map((params) => {
        const id = Number(params.get('chatId'));
        return Number.isInteger(id) && id > 0 ? id : null;
      }),
    ),
    { initialValue: null },
  );

  /** Admin channel filter from `?channel=` — `null` = all channels. */
  protected readonly channelId = toSignal(
    this.route.queryParamMap.pipe(map((q) => q.get('channel') || null)),
    { initialValue: null },
  );

  protected readonly selectedChannel = computed(() => this.session.channel(this.channelId()));
  protected readonly activeChat = this.inbox.activeChat;

  protected readonly source = computed<ThreadSource | null>(() => {
    const id = this.activeChatId();
    return id ? { kind: 'chat', chatId: id, chat: this.activeChat() } : null;
  });

  /**
   * A channel that can't send and needs re-linking in the Mihwar dashboard:
   * employee → one of their own; admin → the selected channel or the open
   * chat's channel.
   */
  protected readonly attentionChannel = computed<WaInstance | null>(() => {
    const needsRelink = (c: WaInstance | null | undefined): c is WaInstance =>
      !!c && isChannelActive(c) && !c.canSend;
    if (!this.isAdmin()) return this.session.channels().find(needsRelink) ?? null;
    const candidate = this.selectedChannel() ?? this.session.channel(this.activeChat()?.instanceId);
    return needsRelink(candidate) ? candidate : null;
  });

  /** New chats need a WhatsApp number (Messenger can't start conversations). */
  protected readonly canStartChat = this.session.hasWhatsAppNumber;

  /** Phones: which pane shows when no chat is open. */
  protected readonly mobilePane = signal<'channels' | 'list'>('list');
  protected readonly view = computed(() => (this.activeChatId() ? 'thread' : this.mobilePane()));

  protected readonly newChatOpen = signal(false);
  /** The linked customer's details, opened from the conversation header. */
  protected readonly customerDialogId = signal<number | null>(null);

  constructor() {
    effect(
      () => {
        const id = this.activeChatId();
        untracked(() => this.inbox.setActive(id));
      },
      { allowSignalWrites: true },
    );

    effect(
      () => {
        const channelId = this.isAdmin() ? this.channelId() : null;
        untracked(() => this.inbox.setChannel(channelId));
      },
      { allowSignalWrites: true },
    );

    // No toast for a message in the chat the user is looking at right now.
    const unregister = this.notificationToasts.suppressWhen(
      (n) =>
        isWhatsAppNotification(n) &&
        n.relatedEntityType === WHATSAPP_CHAT_ENTITY &&
        n.relatedEntityId === this.activeChatId() &&
        this.focus.focused(),
    );

    // Hub down → a new-message notification is the next best signal.
    this.notifications.arrivals$
      .pipe(
        map((batch) => batch.filter(isWhatsAppNotification)),
        filter((batch) => batch.length > 0 && !this.realtime.connected()),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.inbox.refresh());

    inject(DestroyRef).onDestroy(unregister);
  }

  ngOnInit(): void {
    this.inbox.start();
  }

  // ─────────────── navigation ───────────────

  protected open(chat: WaChat): void {
    if (chat.id === this.activeChatId()) return;
    this.router.navigate(['/whatsapp', 'chats', chat.id], { queryParamsHandling: 'preserve' });
  }

  protected backToList(): void {
    this.mobilePane.set('list');
    this.router.navigate(['/whatsapp'], { queryParamsHandling: 'preserve' });
  }

  protected selectChannel(channelId: string | null): void {
    this.mobilePane.set('list');
    this.router.navigate(['/whatsapp'], { queryParams: { channel: channelId } });
  }

  // ─────────────── actions ───────────────

  protected onRead(chatId: number): void {
    this.inbox.markReadLocally(chatId);
  }

  protected onSent(): void {
    if (!this.realtime.connected()) this.inbox.refresh();
  }

  protected onChatStarted(message: WaMessage): void {
    this.newChatOpen.set(false);
    if (!this.realtime.connected()) this.inbox.refresh();
    this.router.navigate(['/whatsapp', 'chats', message.chatId], { queryParamsHandling: 'preserve' });
  }

  // ─────────────── view helpers ───────────────

  /** Customer → contact → +phone → "Messenger customer". */
  protected name(chat: WaChat): string {
    return chatDisplayName(chat) ?? this.t('whatsapp.chats.messengerCustomer');
  }

  protected phone(value: string | null | undefined): string {
    return formatWhatsAppPhone(value);
  }

  protected channelName(channel: WaInstance): string {
    return channelLabel(channel);
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
