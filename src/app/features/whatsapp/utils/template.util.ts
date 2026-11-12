import { WaTemplate } from '../models/whatsapp.models';

/** A run of a template body: literal text, or a variable slot. */
export interface TemplateSegment {
  text: string;
  /** Variable name when this run is a placeholder. */
  variable: string | null;
  /** The slot has no value yet (preview shows the placeholder highlighted). */
  missing: boolean;
}

/** `{{name}}`, `{{ 1 }}` — whitespace inside the braces is tolerated. */
const PLACEHOLDER = /\{\{\s*([^{}]+?)\s*\}\}/g;

/**
 * Splits a body into literal / variable runs, filling each variable from
 * `values`. Rendered as text nodes (never HTML), so a value can't inject markup.
 */
export function renderTemplateSegments(body: string, values: Readonly<Record<string, string>>): TemplateSegment[] {
  const segments: TemplateSegment[] = [];
  let last = 0;
  for (const match of body.matchAll(PLACEHOLDER)) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ text: body.slice(last, start), variable: null, missing: false });
    const name = match[1];
    const value = values[name]?.trim();
    segments.push({ text: value || match[0], variable: name, missing: !value });
    last = start + match[0].length;
  }
  if (last < body.length) segments.push({ text: body.slice(last), variable: null, missing: false });
  return segments;
}

/** The body as plain text with the values substituted (optimistic bubble / tests). */
export function renderTemplateBody(body: string, values: Readonly<Record<string, string>>): string {
  return renderTemplateSegments(body, values)
    .map((s) => s.text)
    .join('');
}

/**
 * The template's variables in order: the declared list, plus any placeholder
 * found in the body that wasn't declared (so no slot can be left unfilled).
 */
export function templateVariables(template: Pick<WaTemplate, 'body' | 'variables'>): string[] {
  const names = [...(template.variables ?? [])];
  for (const match of (template.body ?? '').matchAll(PLACEHOLDER)) {
    if (!names.includes(match[1])) names.push(match[1]);
  }
  return names;
}

/** Only approved, sendable templates are offered; sorted by name. */
export function sendableTemplates(list: readonly WaTemplate[]): WaTemplate[] {
  return list.filter((t) => t.sendable).sort((a, b) => a.name.localeCompare(b.name));
}
