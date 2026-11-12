import { ComposerInput, REPLY_WINDOW_WARNING_MS, resolveComposerState } from './composer-state.util';

const NOW = Date.parse('2026-11-12T12:00:00Z');
const inHours = (h: number) => new Date(NOW + h * 3_600_000).toISOString();

function input(patch: Partial<ComposerInput> = {}, chat: Partial<NonNullable<ComposerInput['chat']>> = {}): ComposerInput {
  return {
    scope: 'chat',
    forbidden: false,
    channelCanSend: true,
    now: NOW,
    chat: {
      canReply: true,
      canSendTemplate: true,
      replyWindowEndsAt: inHours(10),
      channelType: 'whatsapp_cloud',
      ...chat,
    },
    ...patch,
  };
}

describe('resolveComposerState', () => {
  it('window open → reply, no countdown when far from closing', () => {
    expect(resolveComposerState(input())).toEqual({
      mode: 'reply',
      reason: null,
      windowEndsAt: inHours(10),
      closingSoon: false,
    });
  });

  it('window closes within 2 hours → reply with the countdown', () => {
    const state = resolveComposerState(input({}, { replyWindowEndsAt: inHours(1.5) }));
    expect(state.mode).toBe('reply');
    expect(state.closingSoon).toBeTrue();
    expect(REPLY_WINDOW_WARNING_MS).toBe(2 * 3_600_000);
  });

  it('WhatsApp past 24 h → template only', () => {
    const state = resolveComposerState(input({}, { canReply: false, replyWindowEndsAt: null }));
    expect(state).toEqual({ mode: 'templateOnly', reason: 'windowClosed', windowEndsAt: null, closingSoon: false });
  });

  it('closes the window client-side once replyWindowEndsAt has passed', () => {
    const state = resolveComposerState(input({}, { canReply: true, replyWindowEndsAt: inHours(-0.01) }));
    expect(state.mode).toBe('templateOnly');
  });

  it('Messenger past 24 h → locked "wait for the customer", never templates', () => {
    const state = resolveComposerState(
      input({}, { canReply: false, canSendTemplate: true, channelType: 'messenger', replyWindowEndsAt: null }),
    );
    expect(state).toEqual({ mode: 'locked', reason: 'waitCustomer', windowEndsAt: null, closingSoon: false });
  });

  it('chat not linked yet (no reply, no template) → locked', () => {
    const state = resolveComposerState(input({}, { canReply: false, canSendTemplate: false }));
    expect(state.mode).toBe('locked');
    expect(state.reason).toBe('waitCustomer');
  });

  it('forbidden and disconnected win over an open window', () => {
    expect(resolveComposerState(input({ forbidden: true })).reason).toBe('forbidden');
    expect(resolveComposerState(input({ channelCanSend: false })).reason).toBe('disconnected');
  });

  it('customer profile → template only', () => {
    const state = resolveComposerState(input({ scope: 'customer', chat: null }));
    expect(state).toEqual({ mode: 'templateOnly', reason: 'noChat', windowEndsAt: null, closingSoon: false });
  });

  it('chat whose details are unknown yet stays open (the backend decides)', () => {
    expect(resolveComposerState(input({ chat: null })).mode).toBe('reply');
  });

  it('no deadline + canReply → reply without countdown', () => {
    const state = resolveComposerState(input({}, { replyWindowEndsAt: null }));
    expect(state).toEqual({ mode: 'reply', reason: null, windowEndsAt: null, closingSoon: false });
  });
});
