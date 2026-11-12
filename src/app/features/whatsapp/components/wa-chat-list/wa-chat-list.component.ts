import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { WaChat } from '../../models/whatsapp.models';
import { ChatsFilter, WhatsAppInboxStore } from '../../state/whatsapp-inbox.store';
import { WhatsAppSessionStore } from '../../state/whatsapp-session.store';
import {
  cairoDayKey,
  channelLabel,
  chatDisplayName,
  formatWhatsAppPhone,
  isMessenger,
  relativeDay,
} from '../../utils/whatsapp.util';
import { WaChannelBadgeComponent } from '../wa-channel-badge/wa-channel-badge.component';

/** Start fetching the next page this close to the end of the list. */
const LOAD_MORE_THRESHOLD_PX = 160;

/**
 * The inbox's chats column: search (300 ms debounce in the store), All /
 * Unread, conversations newest first with infinite scroll. Every row shows
 * its channel (WhatsApp green / Messenger blue + the channel's name), the
 * display name, the last message, the time and the unread badge.
 *
 * Paging keeps the DOM small (30 rows per page, appended on scroll), so no
 * virtual scroll dependency is needed here.
 */
@Component({
  selector: 'app-wa-chat-list',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe, UserAvatarComponent, WaChannelBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wa-chat-list.component.html',
  styleUrl: './wa-chat-list.component.scss',
})
export class WaChatListComponent {
  protected readonly store = inject(WhatsAppInboxStore);
  private readonly session = inject(WhatsAppSessionStore);
  private readonly language = inject(LanguageService);

  /** Admin "All channels" view: also show who owns each chat's channel. */
  readonly showOwner = input(false);
  /** Offer "New chat" (only with a WhatsApp number to send from). */
  readonly canStartChat = input(true);
  readonly selected = output<WaChat>();
  readonly newChat = output<void>();

  protected readonly filters: readonly ChatsFilter[] = ['all', 'unread'];

  protected readonly term = signal('');

  protected onSearch(value: string): void {
    this.term.set(value);
    this.store.setSearch(value);
  }

  protected clearSearch(): void {
    this.onSearch('');
  }

  protected onScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < LOAD_MORE_THRESHOLD_PX) this.store.loadMore();
  }

  protected setFilter(filter: ChatsFilter): void {
    this.store.setFilter(filter);
  }

  /** Customer → contact → +phone → "Messenger customer". */
  protected name(chat: WaChat): string {
    return chatDisplayName(chat) ?? this.t('whatsapp.chats.messengerCustomer');
  }

  /** Registered customers and named contacts get an initial; the rest get an icon. */
  protected hasName(chat: WaChat): boolean {
    return !!(chat.customerName?.trim() || chat.contactName?.trim());
  }

  protected phone(chat: WaChat): string {
    return formatWhatsAppPhone(chat.phone);
  }

  /** The chat's channel name, falling back to the channel list when the chat doesn't carry it. */
  protected channelName(chat: WaChat): string | null {
    return chat.instanceName?.trim() || channelLabel(this.session.channel(chat.instanceId)) || null;
  }

  protected messenger(chat: WaChat): boolean {
    return isMessenger(chat);
  }

  /** `today` → time, `yesterday` → word, older → date. */
  protected when(iso: string | null): 'today' | 'yesterday' | 'date' | null {
    if (!iso) return null;
    return relativeDay(cairoDayKey(iso)) ?? 'date';
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.language.lang()], key);
  }
}
