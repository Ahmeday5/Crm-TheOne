import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, map } from 'rxjs';
import { withInlineHandling, withSkipLoader } from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import {
  EMPTY_SNAPSHOT,
  PlaybookEntityMap,
  PlaybookImportBundle,
  PlaybookImportResult,
  PlaybookInputMap,
  PlaybookKind,
  PlaybookSnapshot,
} from '../models/sales-playbook.models';
import { SalesPlaybookRepository } from './sales-playbook.repository';

/**
 * Endpoint paths from `docs/api/sales-playbook.md`. Kept feature-local until
 * the backend ships; move them into `API_ENDPOINTS` when wiring the adapter.
 */
const BASE = 'SalesPlaybook';
const SEGMENT: Record<PlaybookKind, string> = {
  scripts: 'scripts',
  objections: 'objections',
  competitors: 'competitors',
  replies: 'replies',
};
export const SALES_PLAYBOOK_ENDPOINTS = {
  snapshot: BASE,
  collection: (kind: PlaybookKind) => `${BASE}/${SEGMENT[kind]}`,
  item: (kind: PlaybookKind, id: string) => `${BASE}/${SEGMENT[kind]}/${encodeURIComponent(id)}`,
  import: `${BASE}/import`,
} as const;

/** Real backend adapter — implements `docs/api/sales-playbook.md`. */
@Injectable({ providedIn: 'root' })
export class HttpSalesPlaybookRepository extends SalesPlaybookRepository {
  private readonly api = inject(ApiService);
  private readonly ep = SALES_PLAYBOOK_ENDPOINTS;

  readonly externalChanges$: Observable<void> = EMPTY;

  load(): Observable<PlaybookSnapshot> {
    return this.api
      .get<Partial<PlaybookSnapshot> | null>(this.ep.snapshot, { context: withSkipLoader() })
      .pipe(map((s) => ({ ...EMPTY_SNAPSHOT, ...(s ?? {}) })));
  }

  create<K extends PlaybookKind>(kind: K, input: PlaybookInputMap[K]): Observable<PlaybookEntityMap[K]> {
    return this.api.post<PlaybookEntityMap[K]>(this.ep.collection(kind), input, {
      context: withInlineHandling(),
    });
  }

  update<K extends PlaybookKind>(
    kind: K,
    id: string,
    input: PlaybookInputMap[K],
  ): Observable<PlaybookEntityMap[K]> {
    return this.api.put<PlaybookEntityMap[K]>(this.ep.item(kind, id), input, {
      context: withInlineHandling(),
    });
  }

  remove(kind: PlaybookKind, id: string): Observable<void> {
    return this.api
      .delete<unknown>(this.ep.item(kind, id), { context: withInlineHandling() })
      .pipe(map(() => undefined));
  }

  importContent(bundle: PlaybookImportBundle): Observable<PlaybookImportResult> {
    return this.api.post<PlaybookImportResult>(this.ep.import, bundle, {
      context: withInlineHandling(),
    });
  }
}
