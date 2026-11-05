import { Observable } from 'rxjs';
import { ChatMessage, ChatUser, Conversation, TypingState } from '../models/team-chat.models';

/**
 * Realtime port for the internal team chat.
 *
 * The UI and store depend only on this contract. Today it is backed by
 * `MockChatGateway` (in-memory, simulated colleagues); the production adapter
 * will be a Firebase implementation (Firestore collections for conversations
 * and messages, RTDB/Firestore presence) bound in `chat-gateway.provider.ts`.
 *
 * All streams are hot and emit the full current snapshot — exactly how a
 * Firestore `onSnapshot` listener behaves — so the swap is mechanical.
 */
export abstract class ChatGateway {
  /** The signed-in employee as a chat participant. */
  abstract me(): ChatUser;

  /** Directory of employees who can be messaged (presence included). */
  abstract users$(): Observable<ChatUser[]>;

  /** The caller's conversations, most recent activity first. */
  abstract conversations$(): Observable<Conversation[]>;

  /** Messages of one conversation, oldest → newest. */
  abstract messages$(conversationId: string): Observable<ChatMessage[]>;

  abstract typing$(): Observable<TypingState[]>;

  abstract send(conversationId: string, text: string): Observable<ChatMessage>;

  abstract markRead(conversationId: string): void;

  /** Broadcast that the caller is typing (debounced by the caller). */
  abstract setTyping(conversationId: string, typing: boolean): void;

  /** Opens (or creates) the direct conversation with `userId`. */
  abstract openDirect(userId: string): Observable<Conversation>;

  abstract setPinned(conversationId: string, pinned: boolean): void;
  abstract setMuted(conversationId: string, muted: boolean): void;
}
