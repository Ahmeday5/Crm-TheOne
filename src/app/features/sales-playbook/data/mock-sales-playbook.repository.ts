import { Injectable, inject } from '@angular/core';
import { Observable, defer, delay, filter, fromEvent, map, of, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import {
  EMPTY_SNAPSHOT,
  PLAYBOOK_KINDS,
  PlaybookEntityMap,
  PlaybookImportBundle,
  PlaybookImportResult,
  PlaybookInputMap,
  PlaybookKind,
  PlaybookRecord,
  PlaybookSnapshot,
} from '../models/sales-playbook.models';
import { planImport } from '../utils/playbook-dedupe.util';
import { newId } from '../utils/playbook.util';
import { SalesPlaybookRepository } from './sales-playbook.repository';

const STORAGE_KEY = 'crm.salesPlaybook.mock.v1';
/** Small artificial latency so loading states are exercised like the real API. */
const LATENCY_MS = 150;

/**
 * TEMPORARY adapter until `/SalesPlaybook` exists on the backend.
 *
 * Persists the whole playbook as one document in `localStorage` (so it is
 * shared by everyone using this browser only) and mirrors the server rules:
 * Admin-only writes and an idempotent import. Swapping in
 * `HttpSalesPlaybookRepository` needs no UI change.
 */
@Injectable({ providedIn: 'root' })
export class MockSalesPlaybookRepository extends SalesPlaybookRepository {
  private readonly auth = inject(AuthService);

  /** Another tab wrote to the same storage key. */
  readonly externalChanges$: Observable<void> = fromEvent<StorageEvent>(window, 'storage').pipe(
    filter((e) => e.key === STORAGE_KEY),
    map(() => undefined),
  );

  load(): Observable<PlaybookSnapshot> {
    return defer(() => of(this.read())).pipe(delay(LATENCY_MS));
  }

  create<K extends PlaybookKind>(kind: K, input: PlaybookInputMap[K]): Observable<PlaybookEntityMap[K]> {
    return this.guarded(() => {
      const record = this.stamp<K>(input);
      const snapshot = this.read();
      this.write({ ...snapshot, [kind]: [record, ...snapshot[kind]] });
      return record;
    });
  }

  update<K extends PlaybookKind>(
    kind: K,
    id: string,
    input: PlaybookInputMap[K],
  ): Observable<PlaybookEntityMap[K]> {
    return this.guarded(() => {
      const snapshot = this.read();
      const rows = snapshot[kind] as PlaybookEntityMap[K][];
      const current = rows.find((r) => r.id === id);
      if (!current) throw { message: 'Item not found.' };
      const saved = { ...current, ...input, id, updatedAt: new Date().toISOString() } as PlaybookEntityMap[K];
      this.write({ ...snapshot, [kind]: rows.map((r) => (r.id === id ? saved : r)) });
      return saved;
    });
  }

  remove(kind: PlaybookKind, id: string): Observable<void> {
    return this.guarded(() => {
      const snapshot = this.read();
      const rows = snapshot[kind] as PlaybookRecord[];
      this.write({ ...snapshot, [kind]: rows.filter((r) => r.id !== id) });
    });
  }

  importContent(bundle: PlaybookImportBundle): Observable<PlaybookImportResult> {
    return this.guarded(() => {
      const snapshot = this.read();
      const { fresh, skipped } = planImport(bundle, snapshot);
      this.write({
        ...snapshot,
        scripts: [...snapshot.scripts, ...fresh.scripts.map((s) => this.stamp<'scripts'>(s))],
        objections: [...snapshot.objections, ...fresh.objections.map((o) => this.stamp<'objections'>(o))],
        replies: [...snapshot.replies, ...fresh.replies.map((r) => this.stamp<'replies'>(r))],
      });
      return {
        added: {
          scripts: fresh.scripts.length,
          objections: fresh.objections.length,
          replies: fresh.replies.length,
        },
        skipped,
        unlinkedScripts: fresh.scripts.filter((s) => !s.service).length,
      };
    });
  }

  // ─────────── internals ───────────

  /** Admin check + latency + thrown objects surfaced as `{ message }` errors. */
  private guarded<T>(work: () => T): Observable<T> {
    return defer(() => {
      if (this.auth.currentRole() !== 'Admin') {
        return throwError(() => ({ message: 'Only admins can manage the sales playbook.' }));
      }
      try {
        return of(work());
      } catch (err) {
        return throwError(() => err);
      }
    }).pipe(delay(LATENCY_MS));
  }

  private stamp<K extends PlaybookKind>(input: PlaybookInputMap[K]): PlaybookEntityMap[K] {
    return {
      ...input,
      id: newId(),
      createdAt: new Date().toISOString(),
      updatedAt: null,
    } as PlaybookEntityMap[K];
  }

  private read(): PlaybookSnapshot {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<PlaybookSnapshot> | null;
      const snapshot = { ...EMPTY_SNAPSHOT } as PlaybookSnapshot;
      for (const kind of PLAYBOOK_KINDS) {
        const rows = raw?.[kind];
        (snapshot as Record<PlaybookKind, unknown[]>)[kind] = Array.isArray(rows) ? rows : [];
      }
      return snapshot;
    } catch {
      return { ...EMPTY_SNAPSHOT };
    }
  }

  private write(snapshot: PlaybookSnapshot): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      /* storage full / blocked — the next read simply won't see the change */
    }
  }
}
