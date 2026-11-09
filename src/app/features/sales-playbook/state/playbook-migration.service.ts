import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Observable,
  catchError,
  concatMap,
  defer,
  from,
  last,
  map,
  of,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { ApiError } from '../../../core/models/api-response.model';
import {
  LegacyPlaybook,
  archiveLegacyPlaybook,
  legacyItemCount,
  readLegacyPlaybook,
} from '../data/legacy-local-playbook';
import { PlaybookFavoritesService } from '../data/playbook-favorites.service';
import { SALES_PLAYBOOK_REPOSITORY } from '../data/sales-playbook-repository.provider';
import {
  PlaybookImportResult,
  PlaybookInputMap,
  PlaybookKind,
  PlaybookSnapshot,
} from '../models/sales-playbook.models';
import { compactKey } from '../utils/arabic-text.util';
import { SalesPlaybookStore } from './sales-playbook.store';

export interface MigrationReport {
  /** What `LoadDefaultContent` added. */
  defaults: PlaybookImportResult;
  /** Items from this browser created on the server. */
  moved: Record<PlaybookKind, number> & { mentions: number };
  /** Already on the server (same title / text / name) — not duplicated. */
  skipped: number;
  /** Items the server rejected; the local copy is kept so a retry can finish the job. */
  failed: number;
}

type Task = () => Observable<'moved' | 'failed' | 'mention' | 'mentionFailed'>;

/**
 * One-time move of the content kept in this browser (pre-backend era) to
 * the server — so switching to the real API never leaves the playbook empty.
 *
 *   1. `LoadDefaultContent` — the backend's ready-made content (idempotent).
 *   2. Every local item the server doesn't already have is created, one by
 *      one (sequential = predictable, no rate spikes, partial progress kept).
 *   3. Favourites follow their item to its new server id.
 *   4. On full success the local copy is archived (never deleted).
 *
 * Duplicates are detected by normalised identity (script title, objection
 * text, reply title/text, competitor name), so running it twice is harmless.
 */
@Injectable({ providedIn: 'root' })
export class PlaybookMigrationService {
  private readonly repo = inject(SALES_PLAYBOOK_REPOSITORY);
  private readonly store = inject(SalesPlaybookStore);
  private readonly favorites = inject(PlaybookFavoritesService);

  private readonly legacy = signal<LegacyPlaybook | null>(readLegacyPlaybook());

  /** Local items that aren't on the server yet (0 until the store has loaded). */
  readonly pendingCount = computed(() => {
    const legacy = this.legacy();
    if (!legacy || !this.store.loaded()) return 0;
    const plan = planMigration(legacy, this.store.snapshotView());
    return legacyItemCount(plan.fresh);
  });

  /** Admin-only (content writes); resolves with a report, errors only if step 1/2 can't start. */
  migrate(): Observable<MigrationReport> {
    const legacy = this.legacy();
    if (!legacy) return throwError(() => ({ status: 0, message: '' }) as ApiError);

    return this.repo.loadDefaultContent().pipe(
      switchMap((defaults) => this.store.reload().pipe(map((server) => ({ defaults, server })))),
      switchMap(({ defaults, server }) => this.moveItems(legacy, server, defaults)),
      tap((report) => {
        if (report.failed === 0) {
          archiveLegacyPlaybook();
          this.legacy.set(null);
        }
        this.store.refresh(true);
      }),
    );
  }

  private moveItems(
    legacy: LegacyPlaybook,
    server: PlaybookSnapshot,
    defaults: PlaybookImportResult,
  ): Observable<MigrationReport> {
    const plan = planMigration(legacy, server);
    const report: MigrationReport = {
      defaults,
      moved: { scripts: 0, objections: 0, competitors: 0, replies: 0, mentions: 0 },
      skipped: legacyItemCount(legacy) - legacyItemCount(plan.fresh),
      failed: 0,
    };

    // Favourites of items that already exist follow them to the server id.
    for (const [kind, pairs] of Object.entries(plan.existing) as Array<[PlaybookKind, Array<[string, string]>]>) {
      for (const [legacyId, serverId] of pairs) this.favorites.remap(kind, legacyId, serverId);
    }

    let nextSortOrder = Math.max(0, ...server.replies.map((r) => r.sortOrder)) + 1;
    const tasks: Task[] = [
      ...plan.fresh.scripts.map((s) => () =>
        this.createWithServiceFallback('scripts', s.legacyId, {
          title: s.title,
          service: s.service,
          opening: s.opening,
          steps: s.steps,
          questions: s.questions,
          closing: s.closing,
        }, (kind) => report.moved[kind]++),
      ),
      ...plan.fresh.objections.map((o) => () =>
        this.create('objections', o.legacyId, { category: o.category, objection: o.objection, answer: o.answer }, (kind) => report.moved[kind]++),
      ),
      ...plan.fresh.replies.map((r) => {
        const sortOrder = nextSortOrder++;
        return () =>
          this.create('replies', r.legacyId, { title: r.title, category: r.category, text: r.text, service: null, sortOrder }, (kind) => report.moved[kind]++);
      }),
      ...plan.fresh.competitors.map((c) => () =>
        this.repo
          .create('competitors', {
            name: c.name,
            website: c.website,
            strengths: c.strengths,
            weaknesses: c.weaknesses,
            howToWin: c.howToWin,
          })
          .pipe(
            tap((saved) => {
              report.moved.competitors++;
              this.favorites.remap('competitors', c.legacyId, saved.id);
            }),
            // Re-link the customers who mentioned it; a missing customer doesn't fail the competitor.
            switchMap((saved) =>
              c.mentionCustomerIds.length
                ? from(c.mentionCustomerIds).pipe(
                    concatMap((customerId) =>
                      this.repo.addMention(saved.id, { customerId, note: '' }).pipe(
                        map(() => 'mention' as const),
                        catchError(() => of('mentionFailed' as const)),
                      ),
                    ),
                    tap((r) => r === 'mention' && report.moved.mentions++),
                    last(),
                    map(() => 'moved' as const),
                  )
                : of('moved' as const),
            ),
            catchError(() => of('failed' as const)),
          ),
      ),
    ];

    if (!tasks.length) return of(report);
    return from(tasks).pipe(
      concatMap((task) => task()),
      tap((outcome) => outcome === 'failed' && report.failed++),
      last(),
      map(() => report),
    );
  }

  private create<K extends PlaybookKind>(
    kind: K,
    legacyId: string,
    input: PlaybookInputMap[K],
    onMoved: (kind: K) => void,
  ): Observable<'moved' | 'failed'> {
    return this.repo.create(kind, input).pipe(
      map((saved) => {
        onMoved(kind);
        this.favorites.remap(kind, legacyId, saved.id);
        return 'moved' as const;
      }),
      catchError(() => of('failed' as const)),
    );
  }

  /** A linked service deleted since (404) shouldn't lose the script — retry it as generic. */
  private createWithServiceFallback(
    kind: 'scripts',
    legacyId: string,
    input: PlaybookInputMap['scripts'],
    onMoved: (kind: 'scripts') => void,
  ): Observable<'moved' | 'failed'> {
    return this.repo.create(kind, input).pipe(
      catchError((err: ApiError) =>
        err?.status === 404 && input.service
          ? defer(() => this.repo.create(kind, { ...input, service: null }))
          : throwError(() => err),
      ),
      map((saved) => {
        onMoved(kind);
        this.favorites.remap(kind, legacyId, saved.id);
        return 'moved' as const;
      }),
      catchError(() => of('failed' as const)),
    );
  }
}

// ─────────── planning (pure) ───────────

interface MigrationPlan {
  fresh: LegacyPlaybook;
  /** legacyId → serverId for items the server already has. */
  existing: Record<PlaybookKind, Array<[string, string]>>;
}

function planMigration(legacy: LegacyPlaybook, server: PlaybookSnapshot): MigrationPlan {
  const existing: MigrationPlan['existing'] = { scripts: [], objections: [], competitors: [], replies: [] };

  const index = <T extends { id: string }>(rows: readonly T[], keysOf: (r: T) => string[]) => {
    const m = new Map<string, string>();
    for (const r of rows) for (const k of keysOf(r).filter(Boolean)) m.set(k, r.id);
    return m;
  };
  const scriptKeys = index(server.scripts, (s) => [compactKey(s.title)]);
  const objectionKeys = index(server.objections, (o) => [compactKey(o.objection)]);
  const competitorKeys = index(server.competitors, (c) => [compactKey(c.name)]);
  const replyKeys = index(server.replies, (r) => [`t:${compactKey(r.title)}`, `x:${compactKey(r.text)}`]);

  /** Keeps items whose keys are unseen; also de-duplicates within the legacy set itself. */
  function split<T extends { legacyId: string }>(
    kind: PlaybookKind,
    items: readonly T[],
    keysOf: (item: T) => string[],
    known: Map<string, string>,
  ): T[] {
    const fresh: T[] = [];
    for (const item of items) {
      const keys = keysOf(item).filter(Boolean);
      const hit = keys.map((k) => known.get(k)).find((id) => id !== undefined);
      if (hit !== undefined) {
        if (hit) existing[kind].push([item.legacyId, hit]);
        continue;
      }
      keys.forEach((k) => known.set(k, '')); // '' = queued in this run
      fresh.push(item);
    }
    return fresh;
  }

  return {
    existing,
    fresh: {
      scripts: split('scripts', legacy.scripts, (s) => [compactKey(s.title)], scriptKeys),
      objections: split('objections', legacy.objections, (o) => [compactKey(o.objection)], objectionKeys),
      competitors: split('competitors', legacy.competitors, (c) => [compactKey(c.name)], competitorKeys),
      replies: split('replies', legacy.replies, (r) => [`t:${compactKey(r.title)}`, `x:${compactKey(r.text)}`], replyKeys),
    },
  };
}
