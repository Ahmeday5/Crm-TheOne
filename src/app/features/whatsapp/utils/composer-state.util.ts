import { parseUtc } from '../../../shared/pipes/cairo-date.pipe';
import { WaChat } from '../models/whatsapp.models';

/** Show "Reply available until …" once the window has less than this left. */
export const REPLY_WINDOW_WARNING_MS = 2 * 60 * 60 * 1000;

/**
 * What the composer offers:
 * - `reply`        free text + attachments;
 * - `templateOnly` the 24-hour window is closed (or there is no chat yet) —
 *                  only a Meta-approved template can go out;
 * - `locked`       nothing can be sent right now.
 */
export type ComposerMode = 'reply' | 'templateOnly' | 'locked';

/**
 * Why the composer looks the way it does — each maps to one banner:
 * - `windowClosed`  WhatsApp chat past 24 h → send a template;
 * - `noChat`        customer profile (no single chat) → template or open the inbox;
 * - `waitCustomer`  Messenger past 24 h, or a chat not linked yet → wait for the customer;
 * - `disconnected`  the channel can't send;
 * - `forbidden`     the caller has no access.
 */
export type ComposerReason = 'windowClosed' | 'noChat' | 'waitCustomer' | 'disconnected' | 'forbidden';

export interface ComposerState {
  mode: ComposerMode;
  reason: ComposerReason | null;
  /** When the free-reply window closes (only while it is open). */
  windowEndsAt: string | null;
  /** The window closes within {@link REPLY_WINDOW_WARNING_MS} — show the countdown. */
  closingSoon: boolean;
}

export interface ComposerInput {
  /** `chat`: one inbox conversation · `customer`: a customer's profile (several chats, no single window). */
  scope: 'chat' | 'customer';
  /** The open chat's details; `null` while unknown (e.g. a deep link outside the loaded list). */
  chat: Pick<WaChat, 'canReply' | 'canSendTemplate' | 'replyWindowEndsAt' | 'channelType'> | null;
  /** The caller got a 401 for this thread. */
  forbidden: boolean;
  /** The sending channel is connected (or unknown — the backend decides). */
  channelCanSend: boolean;
  /** Epoch ms — injected so the state re-evaluates as time passes. */
  now: number;
}

/**
 * The single source of truth for the composer (spec Part 3-B):
 *
 *   forbidden / disconnected   → locked
 *   chat.canReply (window open) → reply   (+ countdown when < 2 h left)
 *   chat.canSendTemplate        → templateOnly
 *   otherwise                   → locked "wait for the customer"
 *
 * The window is also closed client-side once `replyWindowEndsAt` passes, so
 * a chat left open past the deadline switches without a reload.
 *
 * A customer profile has no single window → template only (free replies
 * happen in the inbox). A chat whose details aren't known yet stays open —
 * the backend has the final word and a refusal gives the draft back.
 */
export function resolveComposerState({ scope, chat, forbidden, channelCanSend, now }: ComposerInput): ComposerState {
  if (forbidden) return locked('forbidden');
  if (!channelCanSend) return locked('disconnected');

  if (scope === 'customer') {
    return { mode: 'templateOnly', reason: 'noChat', windowEndsAt: null, closingSoon: false };
  }
  if (!chat) return { mode: 'reply', reason: null, windowEndsAt: null, closingSoon: false };

  const endsAt = parseUtc(chat.replyWindowEndsAt)?.getTime() ?? null;
  const windowOpen = chat.canReply && (endsAt === null || endsAt > now);
  if (windowOpen) {
    return {
      mode: 'reply',
      reason: null,
      windowEndsAt: endsAt === null ? null : chat.replyWindowEndsAt,
      closingSoon: endsAt !== null && endsAt - now <= REPLY_WINDOW_WARNING_MS,
    };
  }

  // Templates exist on WhatsApp only — never offer one on a Messenger chat.
  if (chat.canSendTemplate && chat.channelType !== 'messenger') {
    return { mode: 'templateOnly', reason: 'windowClosed', windowEndsAt: null, closingSoon: false };
  }
  return locked('waitCustomer');
}

function locked(reason: ComposerReason): ComposerState {
  return { mode: 'locked', reason, windowEndsAt: null, closingSoon: false };
}
