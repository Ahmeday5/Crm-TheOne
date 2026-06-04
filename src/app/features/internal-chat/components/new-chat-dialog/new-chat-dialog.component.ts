import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLATIONS, resolveKey } from '../../../../core/i18n';
import { LanguageService } from '../../../../core/services/language.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ChatService } from '../../services/chat.service';

@Component({
  selector: 'app-new-chat-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-chat-dialog.component.html',
  styleUrl: './new-chat-dialog.component.scss',
})
export class NewChatDialogComponent {
  private readonly chat = inject(ChatService);
  private readonly lang = inject(LanguageService);

  @Input() mode: 'chat' | 'group' = 'chat';
  @Output() closed = new EventEmitter<void>();

  readonly contacts = this.chat.contacts;
  readonly selected = signal<Set<string>>(new Set());
  readonly groupName = signal('');

  readonly isGroup = computed(() => this.mode === 'group');
  readonly selectedCount = computed(() => this.selected().size);

  readonly canSubmit = computed(() =>
    this.isGroup() ? this.selected().size >= 2 : this.selected().size >= 1,
  );

  initials(name: string): string {
    return this.chat.initials(name);
  }

  isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  toggle(id: string): void {
    const next = new Set(this.selected());
    if (next.has(id)) {
      next.delete(id);
    } else {
      // Direct chat is 1:1 — keep only the latest pick.
      if (!this.isGroup()) next.clear();
      next.add(id);
    }
    this.selected.set(next);
  }

  submit(): void {
    if (!this.canSubmit()) return;
    const ids = [...this.selected()];
    if (this.isGroup()) {
      this.chat.createGroup(this.groupName(), ids);
    } else {
      this.chat.startDirect(ids[0]);
    }
    this.closed.emit();
  }

  selectedLabel(): string {
    return this.t('chat.dialog.selected').replace('{n}', String(this.selectedCount()));
  }

  private t(key: string): string {
    return resolveKey(TRANSLATIONS[this.lang.lang()], key);
  }
}
