import { Observable } from 'rxjs';
import {
  CompetitorMention,
  CompetitorMentionInput,
  PlaybookEntityMap,
  PlaybookImportResult,
  PlaybookInputMap,
  PlaybookKind,
  PlaybookSnapshot,
} from '../models/sales-playbook.models';

/**
 * Persistence port for the sales playbook.
 *
 * The store and UI depend only on this contract; the concrete adapter is
 * bound in exactly one place — `SALES_PLAYBOOK_REPOSITORY`. Errors surface
 * as the app's `ApiError` (`{ status, message }`), never raw HTTP errors.
 *
 * Authorisation is the backend's job (see `sales-playbook.permissions.ts`
 * for the roles the UI mirrors).
 */
export abstract class SalesPlaybookRepository {
  /** Every tab's content in one snapshot. */
  abstract load(): Observable<PlaybookSnapshot>;

  abstract create<K extends PlaybookKind>(kind: K, input: PlaybookInputMap[K]): Observable<PlaybookEntityMap[K]>;

  abstract update<K extends PlaybookKind>(
    kind: K,
    id: string,
    input: PlaybookInputMap[K],
  ): Observable<PlaybookEntityMap[K]>;

  abstract remove(kind: PlaybookKind, id: string): Observable<void>;

  /** Server-side ready-made content; idempotent. */
  abstract loadDefaultContent(): Observable<PlaybookImportResult>;

  /** Links a customer to a competitor — re-linking the same customer updates the note. */
  abstract addMention(competitorId: string, input: CompetitorMentionInput): Observable<CompetitorMention>;

  abstract removeMention(mentionId: string): Observable<void>;
}
