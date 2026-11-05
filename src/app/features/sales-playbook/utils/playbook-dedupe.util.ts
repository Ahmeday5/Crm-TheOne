import {
  CallScriptInput,
  ObjectionInput,
  PlaybookImportBundle,
  QuickReplyInput,
} from '../models/sales-playbook.models';
import { compactKey } from './arabic-text.util';

/**
 * Duplicate detection for the ready-made content import — pure.
 *
 * Identity is the normalised, space-free text:
 *   - script    → title
 *   - objection → the objection sentence
 *   - reply     → title OR text (either one already present = duplicate)
 * Duplicates inside the incoming bundle itself are dropped too, so running
 * the import twice (or with a repeated seed line) never adds anything twice.
 */

export interface ExistingPlaybookKeys {
  scripts: ReadonlyArray<Pick<CallScriptInput, 'title'>>;
  objections: ReadonlyArray<Pick<ObjectionInput, 'objection'>>;
  replies: ReadonlyArray<Pick<QuickReplyInput, 'title' | 'text'>>;
}

export interface DedupePlan {
  fresh: PlaybookImportBundle;
  skipped: number;
}

function filterFresh<T>(items: readonly T[], keysOf: (item: T) => string[], seen: Set<string>): T[] {
  const fresh: T[] = [];
  for (const item of items) {
    const keys = keysOf(item).filter(Boolean);
    if (!keys.length || keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    fresh.push(item);
  }
  return fresh;
}

export function planImport(bundle: PlaybookImportBundle, existing: ExistingPlaybookKeys): DedupePlan {
  const scriptKeys = new Set(existing.scripts.map((s) => compactKey(s.title)));
  const objectionKeys = new Set(existing.objections.map((o) => compactKey(o.objection)));
  const replyKeys = new Set(
    existing.replies.flatMap((r) => [`t:${compactKey(r.title)}`, `x:${compactKey(r.text)}`]),
  );

  const fresh: PlaybookImportBundle = {
    scripts: filterFresh(bundle.scripts, (s) => [compactKey(s.title)], scriptKeys),
    objections: filterFresh(bundle.objections, (o) => [compactKey(o.objection)], objectionKeys),
    replies: filterFresh(
      bundle.replies,
      (r) => [`t:${compactKey(r.title)}`, `x:${compactKey(r.text)}`],
      replyKeys,
    ),
  };

  const incoming = bundle.scripts.length + bundle.objections.length + bundle.replies.length;
  const added = fresh.scripts.length + fresh.objections.length + fresh.replies.length;
  return { fresh, skipped: incoming - added };
}
