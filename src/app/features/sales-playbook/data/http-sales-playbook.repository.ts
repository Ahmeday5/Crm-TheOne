import { HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import {
  withInlineHandling,
  withUnauthorizedAsForbidden,
} from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import { PagedResult } from '../../../shared/models/paged-result.model';
import {
  Competitor,
  CompetitorMention,
  CompetitorMentionInput,
  PlaybookEntityMap,
  PlaybookImportResult,
  PlaybookInputMap,
  PlaybookKind,
  PlaybookSnapshot,
} from '../models/sales-playbook.models';
import {
  CallScriptDto,
  CompetitorDto,
  CompetitorMentionDto,
  LoadDefaultContentDto,
  ObjectionDto,
  QuickReplyDto,
} from './sales-playbook.dto';
import {
  toCallScript,
  toCallScriptRequest,
  toCompetitor,
  toCompetitorMention,
  toCompetitorRequest,
  toImportResult,
  toMentionRequest,
  toObjection,
  toObjectionRequest,
  toQuickReply,
  toQuickReplyRequest,
} from './sales-playbook.mappers';
import { SalesPlaybookRepository } from './sales-playbook.repository';

const EP = API_ENDPOINTS.salesPlaybook;

/** The backend's maximum page size for `Objections`. */
const OBJECTIONS_PAGE_SIZE = 100;

/**
 * Per-kind wiring: endpoints + mappers. Adding a fifth kind means one more
 * entry here — the generic CRUD below doesn't change.
 */
interface KindAdapter<K extends PlaybookKind> {
  collection: string;
  item: (id: string) => string;
  fromDto: (dto: never) => PlaybookEntityMap[K];
  toRequest: (input: PlaybookInputMap[K]) => unknown;
}

const ADAPTERS: { [K in PlaybookKind]: KindAdapter<K> } = {
  scripts: {
    collection: EP.scripts,
    item: EP.script,
    fromDto: toCallScript as (dto: never) => PlaybookEntityMap['scripts'],
    toRequest: toCallScriptRequest,
  },
  objections: {
    collection: EP.objections,
    item: EP.objection,
    fromDto: toObjection as (dto: never) => PlaybookEntityMap['objections'],
    toRequest: toObjectionRequest,
  },
  competitors: {
    collection: EP.competitors,
    item: EP.competitor,
    fromDto: toCompetitor as (dto: never) => PlaybookEntityMap['competitors'],
    toRequest: toCompetitorRequest,
  },
  replies: {
    collection: EP.quickReplies,
    item: EP.quickReply,
    fromDto: toQuickReply as (dto: never) => PlaybookEntityMap['replies'],
    toRequest: toQuickReplyRequest,
  },
};

/**
 * `api/SalesPlaybook` adapter.
 *
 * The whole playbook is small (tens of items), so `load()` pulls everything
 * once and the UI filters, searches and counts locally — instant tab
 * switches, offline-friendly search, and favourites that can sort across
 * the full list. Objections are paged server-side, so every page is fetched.
 */
@Injectable({ providedIn: 'root' })
export class HttpSalesPlaybookRepository extends SalesPlaybookRepository {
  private readonly api = inject(ApiService);

  load(): Observable<PlaybookSnapshot> {
    return forkJoin({
      scripts: this.api
        .get<CallScriptDto[] | null>(EP.scripts, { context: quiet() })
        .pipe(map((rows) => (rows ?? []).map(toCallScript))),
      objections: this.loadAllObjections(),
      competitors: this.loadCompetitors(),
      replies: this.api
        .get<QuickReplyDto[] | null>(EP.quickReplies, { context: quiet() })
        .pipe(map((rows) => (rows ?? []).map(toQuickReply))),
    });
  }

  create<K extends PlaybookKind>(kind: K, input: PlaybookInputMap[K]): Observable<PlaybookEntityMap[K]> {
    const a = ADAPTERS[kind] as KindAdapter<K>;
    return this.api
      .post<never>(a.collection, a.toRequest(input), { context: quiet() })
      .pipe(map((dto) => a.fromDto(dto)));
  }

  update<K extends PlaybookKind>(
    kind: K,
    id: string,
    input: PlaybookInputMap[K],
  ): Observable<PlaybookEntityMap[K]> {
    const a = ADAPTERS[kind] as KindAdapter<K>;
    return this.api
      .put<never>(a.item(id), a.toRequest(input), { context: quiet() })
      .pipe(map((dto) => a.fromDto(dto)));
  }

  remove(kind: PlaybookKind, id: string): Observable<void> {
    return this.api
      .delete<unknown>(ADAPTERS[kind].item(id), { context: quiet() })
      .pipe(map(() => undefined));
  }

  loadDefaultContent(): Observable<PlaybookImportResult> {
    return this.api
      .post<LoadDefaultContentDto>(EP.loadDefaultContent, null, { context: quiet() })
      .pipe(map(toImportResult));
  }

  addMention(competitorId: string, input: CompetitorMentionInput): Observable<CompetitorMention> {
    return this.api
      .post<CompetitorMentionDto>(EP.competitorMentions(competitorId), toMentionRequest(input), {
        context: withUnauthorizedAsForbidden(quiet()),
      })
      .pipe(map(toCompetitorMention));
  }

  removeMention(mentionId: string): Observable<void> {
    return this.api
      .delete<unknown>(EP.mention(mentionId), { context: withUnauthorizedAsForbidden(quiet()) })
      .pipe(map(() => undefined));
  }

  // ─────────── internals ───────────

  /** Page 1 tells us the total; the remaining pages load in parallel. */
  private loadAllObjections() {
    const page = (pageIndex: number) =>
      this.api.get<PagedResult<ObjectionDto> | null>(EP.objections, {
        params: { pageIndex, pageSize: OBJECTIONS_PAGE_SIZE },
        context: quiet(),
      });

    return page(1).pipe(
      switchMap((first) => {
        const pages = Math.ceil((first?.count ?? 0) / OBJECTIONS_PAGE_SIZE);
        const rest = Array.from({ length: Math.max(0, pages - 1) }, (_, i) => page(i + 2));
        return (rest.length ? forkJoin(rest) : of([])).pipe(map((others) => [first, ...others]));
      }),
      map((pages) => pages.flatMap((p) => (p?.data ?? []).map(toObjection))),
    );
  }

  /**
   * The list endpoint omits mentions; competitors that have any are fetched
   * individually (in parallel) so the cards can show who mentioned them.
   */
  private loadCompetitors(): Observable<Competitor[]> {
    return this.api.get<CompetitorDto[] | null>(EP.competitors, { context: quiet() }).pipe(
      switchMap((rows) => {
        const list = rows ?? [];
        if (!list.length) return of([] as CompetitorDto[]);
        return forkJoin(
          list.map((c) =>
            c.mentionsCount > 0
              ? this.api.get<CompetitorDto>(EP.competitor(c.id), { context: quiet() })
              : of(c),
          ),
        );
      }),
      map((rows) => rows.map(toCompetitor)),
    );
  }
}

/** Errors are shown inline by the caller (form alert, load-error card, toast). */
function quiet(): HttpContext {
  return withInlineHandling();
}
