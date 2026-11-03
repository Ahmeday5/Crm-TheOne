import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { WaChat } from '../../models/whatsapp.models';
import { ChatsFilter, WhatsAppInboxStore } from '../../state/whatsapp-inbox.store';
import { cairoDayKey, chatDisplayName, formatWhatsAppPhone, relativeDay } from '../../utils/whatsapp.util';

/** Start fetching the next page this close to the end of the list. */
const LOAD_MORE_THRESHOLD_PX = 160;

/**
 * The inbox's chats column: search, All / Unread, conversations newest
 * first with infinite scroll. Reads the page-provided `WhatsAppInboxStore`;
 * emits the picked chat.
 */
@Component({
  selector: 'app-wa-chat-list',
  standalone: true,
  imports: [TranslatePipe, CairoDatePipe, UserAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wa-chat-list.component.html',
  styleUrl: './wa-chat-list.component.scss',
})
export class WaChatListComponent {
  protected readonly store = inject(WhatsAppInboxStore);

  /** Admin "All channels" view: tag each chat with its number / owner. */
  readonly showChannel = input(false);
  /** Offer "New chat" (hidden when the sending number can't send). */
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

  protected name(chat: WaChat): string {
    return chatDisplayName(chat);
  }

  /** Registered customers and named contacts get an initial; bare numbers get an icon. */
  protected hasName(chat: WaChat): boolean {
    return !!(chat.customerName?.trim() || chat.contactName?.trim());
  }

  protected phone(chat: WaChat): string {
    return formatWhatsAppPhone(chat.phone);
  }

  protected channelPhone(chat: WaChat): string {
    return formatWhatsAppPhone(chat.instancePhoneNumber);
  }

  /** `today` → time, `yesterday` → word, older → date. */
  protected when(iso: string | null): 'today' | 'yesterday' | 'date' | null {
    if (!iso) return null;
    return relativeDay(cairoDayKey(iso)) ?? 'date';
  }
}
