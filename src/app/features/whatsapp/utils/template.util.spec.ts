import { WaTemplate } from '../models/whatsapp.models';
import { renderTemplateBody, renderTemplateSegments, sendableTemplates, templateVariables } from './template.util';
import { validateAttachment } from './whatsapp.util';

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
