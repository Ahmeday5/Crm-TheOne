/**
 * Front-end models for the internal chat feature.
 *
 * The chat has no backend yet, so everything here lives client-side: the
 * `ChatService` seeds demo conversations, keeps state in signals, and mirrors
 * it to `localStorage`. Media (voice notes, images, videos, files) is stored
 * as a data URL so it survives a reload without an object-URL registry.
 */

export type ChatId = string;

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file';

/** WhatsApp-style delivery state, drives the tick icons on outgoing bubbles. */
export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface ChatParticipant {
  id: string;
  name: string;
  /** Stable accent colour for the avatar, derived from the name. */
  avatarColor: string;
}

export interface ChatMessage {
  id: string;
  conversationId: ChatId;
  senderId: string;
  senderName: string;
  type: MessageType;
  /** Text body, or the caption attached to a media message. */
  text?: string;
  /** Data URL for media messages (image/video/audio/file). */
  mediaUrl?: string;
  mediaName?: string;
  mediaMime?: string;
  /** Duration in seconds for audio/video. */
  durationSec?: number;
  /** Original size in bytes for file/media messages. */
  fileSize?: number;
  /** Epoch milliseconds. */
  createdAt: number;
  status: MessageStatus;
  /** True when the signed-in user is the sender. */
  mine: boolean;
}

export interface Conversation {
  id: ChatId;
  kind: 'direct' | 'group';
  name: string;
  /** For a direct chat this is the single peer; for a group, its members. */
  participants: ChatParticipant[];
  avatarColor: string;
  messages: ChatMessage[];
  /** Count of unread incoming messages. */
  unread: number;
  /** Simulated "is typing" indicator. */
  typing: boolean;
  /** Simulated peer presence (direct chats only). */
  online: boolean;
  /** Epoch ms of the last activity — drives list ordering. */
  updatedAt: number;
}
