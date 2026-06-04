import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Conversation } from '../../models/chat.model';
import { listTimestamp } from '../../models/chat-format.util';
import { ChatService } from '../../services/chat.service';

type ListFilter = 'all' | 'direct' | 'group';

@Component({
  selector: 'app-conversation-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './conversation-list.component.html',
  styleUrl: './conversation-list.component.scss',
})
export class ConversationListComponent {
  private readonly chat = inject(ChatService);
  private readonly lang = inject(LanguageService);

  @Output() newChat = new EventEmitter<void>();
  @Output() newGroup = new EventEmitter<void>();

  readonly activeId = this.chat.activeId;
  readonly search = signal('');
  readonly filter = signal<ListFilter>('all');

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const kind = this.filter();
    return this.chat.orderedConversations().filter((c) => {
      if (kind !== 'all' && c.kind !== kind) return false;
      if (!term) return true;
      return (
        c.name.toLowerCase().includes(term) ||
        this.lastText(c).toLowerCase().includes(term)
      );
    });
  });

  setFilter(f: ListFilter): void {
    this.filter.set(f);
  }

  select(id: string): void {
    this.chat.select(id);
  }

  // ─────────── row helpers ───────────

  initials(name: string): string {
    return this.chat.initials(name);
  }

  timestamp(c: Conversation): string {
    return listTimestamp(c.updatedAt, this.locale());
  }

  /** Preview line under each conversation name. */
  preview(c: Conversation): string {
    if (c.typing) return '';
    const last = c.messages[c.messages.length - 1];
    if (!last) return '';
    const prefix =
      c.kind === 'group' && !last.mine && last.senderName
        ? `${last.senderName.split(' ')[0]}: `
        : '';
    if (last.type === 'text') return prefix + (last.text ?? '');
    const labels: Record<string, string> = {
      image: this.t('chat.photo'),
      video: this.t('chat.video'),
      audio: this.t('chat.voiceMessage'),
      file: last.mediaName || this.t('chat.file'),
    };
    return prefix + (labels[last.type] ?? '');
  }

  previewIcon(c: Conversation): string | null {
    const last = c.messages[c.messages.length - 1];
    if (!last) return null;
    switch (last.type) {
      case 'image': return 'fa-solid fa-image';
      case 'video': return 'fa-solid fa-video';
      case 'audio': return 'fa-solid fa-microphone';
      case 'file': return 'fa-solid fa-file';
      default: return null;
    }
  }

  private lastText(c: Conversation): string {
    const last = c.messages[c.messages.length - 1];
    return last?.text ?? '';
  }

  private locale(): 'ar-EG' | 'en-US' {
    return this.lang.lang() === 'ar' ? 'ar-EG' : 'en-US';
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.lang.lang()], key);
  }
}
