import { toCommentForm } from './portal-requests.gateway';

/**
 * Comment endpoints are multipart (they take attachments) — the backend binds
 * `[FromForm]`, so a JSON body fails. Every reply (client, staff, Admin) goes
 * through `toCommentForm`; these tests pin its shape.
 */
describe('toCommentForm', () => {
  it('builds multipart FormData, never a JSON object', () => {
    const form = toCommentForm('  hello  ', []);
    expect(form instanceof FormData).toBeTrue();
    expect(form.get('body')).toBe('hello');
    expect(form.has('isInternal')).toBeFalse();
  });

  it('sends isInternal as a form field (staff / Admin replies)', () => {
    const form = toCommentForm('note', [], { isInternal: String(true) });
    expect(form.get('isInternal')).toBe('true');
  });

  it('appends every file under "attachments"', () => {
    const a = new File(['a'], 'a.png', { type: 'image/png' });
    const b = new File(['b'], 'b.pdf', { type: 'application/pdf' });
    const form = toCommentForm('', [a, b]);
    const files = form.getAll('attachments') as File[];
    expect(files.map((f) => f.name)).toEqual(['a.png', 'b.pdf']);
    // The server requires a body — a file-only reply names its files.
    expect(form.get('body')).toBe('📎 a.png · 📎 b.pdf');
  });
});
