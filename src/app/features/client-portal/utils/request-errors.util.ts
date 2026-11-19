import { TRANSLATIONS, resolveKey } from '../../../core/i18n';
import { Lang } from '../../../core/services/language.service';
import { ApiError } from '../../../core/models/api-response.model';

/** Contract `reason` codes we have our own words for (`clientRequests.errors.*`). */
const KNOWN_REASONS = new Set([
  'invalid_transition',
  'request_rejected',
  'request_not_approved',
  'use_triage_endpoint',
  'assignee_invalid',
  'reason_required',
  'surface_name_taken',
  'surface_kind_invalid',
  'app_required',
  'app_name_required',
  'target_required',
  'surface_invalid',
  'status_cannot_go_back',
]);

/** Shown inline: a translation key when we know the reason, else the server's text. */
export interface UiError {
  key: string | null;
  text: string | null;
}

export function toUiError(e: ApiError | null | undefined): UiError {
  const reason = e?.reason ?? null;
  if (reason && KNOWN_REASONS.has(reason)) return { key: `clientRequests.errors.${reason}`, text: null };
  // ModelState 400: say WHICH field failed, not "One or more validation errors occurred."
  const fields = fieldErrorsText(e);
  if (fields) return { key: null, text: fields };
  return e?.message ? { key: null, text: e.message } : { key: 'clientRequests.errors.generic', text: null };
}

/** `Body: The Body field is required. · Attachments: …` — `null` when the server sent none. */
function fieldErrorsText(e: ApiError | null | undefined): string | null {
  const errors = e?.fieldErrors;
  if (!errors) return null;
  const parts = Object.entries(errors)
    .filter(([, msgs]) => Array.isArray(msgs) && msgs.length)
    .map(([field, msgs]) => `${field}: ${msgs.join(' ')}`);
  return parts.length ? parts.join(' · ') : null;
}

export function isConflict(e: ApiError | null | undefined): boolean {
  return e?.reason === 'invalid_transition' || e?.status === 409;
}

/** The same, as ready-to-show text (for inputs that take a plain string). */
export function errorText(e: ApiError | null | undefined, lang: Lang): string {
  const ui = toUiError(e);
  return ui.key ? resolveKey(TRANSLATIONS[lang], ui.key) : ui.text ?? '';
}
