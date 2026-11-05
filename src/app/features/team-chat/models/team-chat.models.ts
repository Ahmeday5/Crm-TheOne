import { UserRole } from '../../../core/models/auth.model';

export type ChatPresence = 'online' | 'away' | 'offline';

export interface ChatUser {
  id: string;
  name: string;
  role: UserRole;
  imageUrl?: string | null;
  presence: ChatPresence;
  /** ISO timestamp — shown when `presence` is `offline`. */
  lastSeenAt?: string | null;
}

/**
 * `direct`  → one-to-one between two employees.
 * `channel` → a named room (a department, or a topic like #announcements).
 */
export type ConversationKind = 'direct' | 'channel';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  sentAt: string;
  status: MessageStatus;
}

export interface Conversation {
  id: string;
  kind: ConversationKind;
  /** Channel name; for a direct chat this is the other person's name. */
  title: string;
  /** Font-Awesome icon for channels. */
  icon?: string;
  /** Short description (channels). */
  topic?: string;
  memberIds: string[];
  lastMessage: ChatMessage | null;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
}

/** "Someone is typing" signal for one conversation. */
export interface TypingState {
  conversationId: string;
  userIds: string[];
}
