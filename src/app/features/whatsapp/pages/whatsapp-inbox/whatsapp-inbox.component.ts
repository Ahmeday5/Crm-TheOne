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
import { ApiError } from '../../../../core/models/api-response.model';
import { AuthService } from '../../../../core/services/auth.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
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
import { WaChatToolsComponent } from '../../components/wa-chat-tools/wa-chat-tools.component';
import { WaCustomerPanelComponent } from '../../components/wa-customer-panel/wa-customer-panel.component';
import { ReminderDueChange, WaReminderDueComponent } from '../../components/wa-reminder-due/wa-reminder-due.component';
import { isReminderDue } from '../../utils/inbox-tools.util';
import {
  WaAddCustomerDialogComponent,
  WaAddCustomerMode,
} from '../../components/wa-add-customer-dialog/wa-add-customer-dialog.component';
import { WaNewChatDialogComponent } from '../../components/wa-new-chat-dialog/wa-new-chat-dialog.component';
import { WaNumberCardComponent } from '../../components/wa-number-card/wa-number-card.component';
import { WaThreadComponent } from '../../components/wa-thread/wa-thread.component';
import { WaChat, WaInstance, WaMessage } from '../../models/whatsapp.models';
import { WhatsAppApiService } from '../../services/whatsapp-api.service';
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
    WaAddCustomerDialogComponent,
    WaChatToolsComponent,
    WaCustomerPanelComponent,
    WaReminderDueComponent,
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
  private readonly api = inject(WhatsAppApiService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  /** A delete request is in flight. */
  protected readonly deleting = signal(false);

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

  /** `?resumeApproval=<id>` — reopen «طلب دفعة» from an approved discount request (one-shot). */
  protected readonly resumeApprovalId = signal<number | null>(null);

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
  /** "Add as customer" / "link to a customer" for a chat with no CRM customer. */
  protected readonly addCustomerDialog = signal<{ chat: WaChat; mode: WaAddCustomerMode } | null>(null);
  /** Creating customers is Admin / Sales only (Support reads the inbox but can't add customers). */
  protected readonly canAddCustomer = computed(() => {
    const role = this.auth.currentRole();
    return role === 'Admin' || role === 'Sales';
  });

  constructor() {
    const resume = Number(this.route.snapshot.queryParamMap.get('resumeApproval'));
    if (Number.isInteger(resume) && resume > 0) {
      this.resumeApprovalId.set(resume);
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { resumeApproval: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }

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

    // The open chat was deleted (here or by someone else) → back to the list.
    this.inbox.chatDeleted$.pipe(takeUntilDestroyed()).subscribe((id) => {
      if (id === this.activeChatId()) this.backToList();
    });

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

  // ─────────────── inbox v4: customer panel + new-number banner ───────────────

  /** Side customer card — remembered across visits. */
  protected readonly panelOpen = signal(readFlag(PANEL_KEY));
  /** Chats whose "new number" banner was closed (this browser only). */
  private readonly dismissedBanners = signal<ReadonlySet<number>>(readIds(BANNER_KEY));

  protected togglePanel(): void {
    const next = !this.panelOpen();
    this.panelOpen.set(next);
    writeStorage(PANEL_KEY, next ? '1' : '0');
  }

  protected bannerDismissed(chatId: number): boolean {
    return this.dismissedBanners().has(chatId);
  }

  protected dismissBanner(chatId: number): void {
    const next = new Set(this.dismissedBanners());
    next.add(chatId);
    this.dismissedBanners.set(next);
    writeStorage(BANNER_KEY, JSON.stringify([...next].slice(-500)));
  }

  /** The open chat's reminder time has come (live, from the inbox clock). */
  protected reminderDue(chat: WaChat): boolean {
    return isReminderDue(chat, this.inbox.now());
  }

  /** The due banner closed / snoozed a reminder. */
  protected onReminderDueChanged(chat: WaChat, next: ReminderDueChange): void {
    this.inbox.patchChat({ ...chat, ...next });
  }

  /** Labels / notes / reminder / transfer changed the chat — patch it in the list. */
  protected onChatChanged(chat: WaChat): void {
    this.inbox.patchChat(chat);
  }

  protected openAddCustomer(chat: WaChat, mode: WaAddCustomerMode): void {
    this.addCustomerDialog.set({ chat, mode });
  }

  protected onCustomerLinked(chat: WaChat): void {
    this.inbox.patchChat(chat);
  }

  /**
   * Chat permission (§0): Admin, the channel owner, or the colleague the chat
   * was transferred to. Unlocks labels, notes, reminders, add/link customer.
   */
  protected canManage(chat: WaChat): boolean {
    const me = this.auth.currentUser()?.userId;
    return this.canDelete(chat) || (!!me && chat.assignedUserId === me);
  }

  /** Admin, or the employee who owns the chat's channel (the server re-checks). */
  protected canDelete(chat: WaChat): boolean {
    return this.isAdmin() || (!!chat.ownerUserId && chat.ownerUserId === this.auth.currentUser()?.userId);
  }

  /** Confirm → optimistic remove → DELETE; a failure puts the chat back. */
  protected async deleteChat(chat: WaChat): Promise<void> {
    const ok = await this.dialog.confirm({
      title: this.t('whatsapp.thread.deleteTitle'),
      message: this.t('whatsapp.thread.deleteMessage'),
      confirmText: this.t('whatsapp.thread.deleteConfirm'),
      type: 'danger',
    });
    if (!ok) return;
    this.deleting.set(true);
    const removed = this.inbox.removeChat(chat.id);
    this.api.deleteChat(chat.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.session.loadChannels();
      },
      error: (e: ApiError) => {
        this.deleting.set(false);
        if (removed) this.inbox.restoreChat(removed);
        this.toast.error(e?.message || this.t('whatsapp.thread.deleteFailed'));
      },
    });
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

const PANEL_KEY = 'wa.inbox.customerPanel';
const BANNER_KEY = 'wa.inbox.dismissedNewNumberBanners';

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / blocked storage — the setting just isn't remembered */
  }
}

function readFlag(key: string): boolean {
  return readStorage(key) === '1';
}

function readIds(key: string): ReadonlySet<number> {
  try {
    const ids = JSON.parse(readStorage(key) ?? '[]');
    return new Set(Array.isArray(ids) ? ids.filter((n): n is number => typeof n === 'number') : []);
  } catch {
    return new Set();
  }
}
