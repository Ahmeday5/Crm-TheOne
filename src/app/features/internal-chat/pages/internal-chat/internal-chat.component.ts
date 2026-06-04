import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ConversationListComponent } from '../../components/conversation-list/conversation-list.component';
import { ChatThreadComponent } from '../../components/chat-thread/chat-thread.component';
import { NewChatDialogComponent } from '../../components/new-chat-dialog/new-chat-dialog.component';
import { ChatService } from '../../services/chat.service';

@Component({
  selector: 'app-internal-chat',
  standalone: true,
  imports: [
    CommonModule,
    ConversationListComponent,
    ChatThreadComponent,
    NewChatDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './internal-chat.component.html',
  styleUrl: './internal-chat.component.scss',
})
export class InternalChatComponent {
  private readonly chat = inject(ChatService);

  /** Drives the mobile single-pane switch (list ⇄ thread). */
  readonly hasActive = computed(() => this.chat.activeConversation() !== null);

  readonly dialogOpen = signal(false);
  readonly dialogMode = signal<'chat' | 'group'>('chat');

  openNewChat(): void {
    this.dialogMode.set('chat');
    this.dialogOpen.set(true);
  }

  openNewGroup(): void {
    this.dialogMode.set('group');
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
  }

  back(): void {
    this.chat.clearSelection();
  }
}
