import { Observable } from 'rxjs';
import {
  PlaybookEntityMap,
  PlaybookImportBundle,
  PlaybookImportResult,
  PlaybookInputMap,
  PlaybookKind,
  PlaybookSnapshot,
} from '../models/sales-playbook.models';

/**
 * Persistence port for the sales playbook.
 *
 * The store and UI depend only on this contract; the concrete adapter
 * (mock today, HTTP once the backend ships) is chosen in exactly one place:
 * `SALES_PLAYBOOK_REPOSITORY` in `sales-playbook-repository.provider.ts`.
 *
 * Contract every adapter honours (see `docs/api/sales-playbook.md`):
 *   - Reads are open to Admin / Marketing / Sales.
 *   - `create` / `update` / `remove` / `importContent` are limited to
 *     `PLAYBOOK_MANAGER_ROLES`.
 *   - `importContent` is idempotent: items whose normalised title / text
 *     already exist are skipped and counted in `skipped`.
 */

/** Roles that can add / edit / delete / import playbook content. */
export const PLAYBOOK_MANAGER_ROLES: readonly string[] = ['Admin', 'Marketing'];

export function canManagePlaybook(role: string | null | undefined): boolean {
  return !!role && PLAYBOOK_MANAGER_ROLES.includes(role);
}

export abstract class SalesPlaybookRepository {
  abstract load(): Observable<PlaybookSnapshot>;

  abstract create<K extends PlaybookKind>(
    kind: K,
    input: PlaybookInputMap[K],
  ): Observable<PlaybookEntityMap[K]>;

  abstract update<K extends PlaybookKind>(
    kind: K,
    id: string,
    input: PlaybookInputMap[K],
  ): Observable<PlaybookEntityMap[K]>;

  abstract remove(kind: PlaybookKind, id: string): Observable<void>;

  abstract importContent(bundle: PlaybookImportBundle): Observable<PlaybookImportResult>;

  /**
   * Fires when data changed somewhere else (another tab, a push event…) so
   * the store can refetch. Adapters without such a signal return `EMPTY`.
   */
  abstract readonly externalChanges$: Observable<void>;
}
