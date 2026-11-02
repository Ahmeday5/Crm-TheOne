import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { WhatsAppChat } from '../../models/whatsapp.models';
import { WhatsAppChatsStore } from '../../state/whatsapp-chats.store';
import { cairoDayKey, chatDisplayName, formatWhatsAppPhone, relativeDay } from '../../utils/whatsapp.util';

/** Start fetching the next page this close to the end of the list. */
const LOAD_MORE_THRESHOLD_PX = 160;

/**
 * The inbox's left pane: search + conversations, newest activity first.
 * Reads the page-provided `WhatsAppChatsStore`; emits the picked chat.
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
  protected readonly store = inject(WhatsAppChatsStore);

  /** Admins see whose number each chat lives on. */
  readonly showOwner = input(false);
  readonly selected = output<WhatsAppChat>();

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

  protected name(chat: WhatsAppChat): string {
    return chatDisplayName(chat);
  }

  /** Registered customers and named contacts get an initial; bare numbers get an icon. */
  protected hasName(chat: WhatsAppChat): boolean {
    return !!(chat.customerName?.trim() || chat.contactName?.trim());
  }

  protected phone(chat: WhatsAppChat): string {
    return formatWhatsAppPhone(chat.phone);
  }

  /** `today` → time, `yesterday` → word, older → date. */
  protected when(iso: string | null): 'today' | 'yesterday' | 'date' | null {
    if (!iso) return null;
    return relativeDay(cairoDayKey(iso)) ?? 'date';
  }
}
