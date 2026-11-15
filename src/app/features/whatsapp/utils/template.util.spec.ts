import { WaTemplate } from '../models/whatsapp.models';
import { renderTemplateBody, renderTemplateSegments, sendableTemplates, templateVariables } from './template.util';
import { WaChat, WaInstance } from '../models/whatsapp.models';
import { makeChannel, makeChat } from '../testing/whatsapp.testing';
import { normalizeChannel, normalizeChat, validateAttachment } from './whatsapp.util';

describe('normalizeChat / normalizeChannel (fields missing from the backend)', () => {
  /** A chat as an older backend build sends it — without the Mihwar fields. */
  function legacy(patch: Partial<WaChat>): WaChat {
    const chat: Partial<WaChat> = { ...makeChat(), ...patch };
    delete chat.channelType;
    delete chat.canReply;
    delete chat.canSendTemplate;
    delete chat.replyWindowEndsAt;
    delete chat.instanceName;
    return chat as WaChat;
  }

  it('infers the channel type from the phone and never leaves it undefined', () => {
    expect(normalizeChat(legacy({ phone: '201000000000' })).channelType).toBe('whatsapp_cloud');
    expect(normalizeChat(legacy({ phone: null })).channelType).toBe('messenger');
  });

  it('keeps the composer usable when the window fields are missing', () => {
    const wa = normalizeChat(legacy({ phone: '201000000000' }));
    expect(wa.canReply).toBeTrue();
    expect(wa.canSendTemplate).toBeTrue();
    expect(wa.replyWindowEndsAt).toBeNull();
    expect(wa.instanceName).toBeNull();
    expect(normalizeChat(legacy({ phone: null })).canSendTemplate).toBeFalse();
  });

  it('keeps values the backend did send', () => {
    const chat = makeChat({ channelType: 'messenger', canReply: false, canSendTemplate: false });
    expect(normalizeChat(chat)).toEqual(chat);
  });

  it('defaults a channel to WhatsApp and to "exists on the provider"', () => {
    const raw = { ...makeChannel(), type: undefined, existsInProvider: undefined } as unknown as WaInstance;
    const channel = normalizeChannel(raw);
    expect(channel.type).toBe('whatsapp_cloud');
    expect(channel.existsInProvider).toBeTrue();
  });
});

function tpl(patch: Partial<WaTemplate>): WaTemplate {
  return {
    id: 1,
    name: 'welcome',
    language: 'ar',
    category: 'MARKETING',
    status: 'APPROVED',
    instanceId: '217',
    body: 'Hi {{name}}',
    variables: ['name'],
    sendable: true,
    ...patch,
  };
}

describe('template utils', () => {
  it('substitutes values and keeps missing slots visible', () => {
    expect(renderTemplateBody('Hi {{name}}, order {{ 1 }} ready', { name: 'Ahmed' })).toBe(
      'Hi Ahmed, order {{ 1 }} ready',
    );
    const segments = renderTemplateSegments('Hi {{name}}!', {});
    expect(segments).toEqual([
      { text: 'Hi ', variable: null, missing: false },
      { text: '{{name}}', variable: 'name', missing: true },
      { text: '!', variable: null, missing: false },
    ]);
  });

  it('treats a blank value as missing', () => {
    expect(renderTemplateSegments('{{a}}', { a: '   ' })[0].missing).toBeTrue();
  });

  it('lists declared variables first, then undeclared placeholders, once each', () => {
    expect(templateVariables(tpl({ body: '{{1}} {{2}} {{1}}', variables: ['2'] }))).toEqual(['2', '1']);
  });

  it('offers only sendable templates, sorted by name', () => {
    const list = sendableTemplates([
      tpl({ id: 1, name: 'zeta' }),
      tpl({ id: 2, name: 'alpha' }),
      tpl({ id: 3, name: 'beta', sendable: false }),
    ]);
    expect(list.map((t) => t.id)).toEqual([2, 1]);
  });
});

describe('validateAttachment', () => {
  const file = (name: string, size: number) => ({ name, size });

  it('accepts allowed types up to 16 MB', () => {
    expect(validateAttachment(file('a.pdf', 16 * 1024 * 1024))).toBeNull();
    expect(validateAttachment(file('voice.aac', 1000))).toBeNull();
  });

  it('rejects other types, empty files and files over 16 MB', () => {
    expect(validateAttachment(file('a.exe', 10))).toBe('type');
    expect(validateAttachment(file('a.png', 0))).toBe('empty');
    expect(validateAttachment(file('a.mp4', 16 * 1024 * 1024 + 1))).toBe('tooLarge');
  });
});
