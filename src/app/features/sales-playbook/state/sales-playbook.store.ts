import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, Subscription, finalize, map, tap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { PlaybookFavoritesService } from '../data/playbook-favorites.service';
import { SALES_PLAYBOOK_REPOSITORY } from '../data/sales-playbook-repository.provider';
import {
  Competitor,
  CompetitorMention,
  CompetitorMentionInput,
  EMPTY_SNAPSHOT,
  PlaybookEntityMap,
  PlaybookImportResult,
  PlaybookInputMap,
  PlaybookKind,
  PlaybookRecord,
  PlaybookSnapshot,
} from '../models/sales-playbook.models';
import { canManagePlaybook, canMentionCompetitors } from '../sales-playbook.permissions';
import { categoryCounts } from '../utils/playbook.util';

/**
 * App-wide sales playbook state — shared by the playbook page and the
 * WhatsApp quick-reply picker, so an edit shows up everywhere at once.
 *
 * Mutations go to the server first and only then patch the local snapshot
 * (pessimistic), so the UI never shows something the backend rejected.
 * `start()` is idempotent: the first consumer loads, later ones reuse.
 */
@Injectable({ providedIn: 'root' })
export class SalesPlaybookStore {
  private readonly repo = inject(SALES_PLAYBOOK_REPOSITORY);
  private readonly auth = inject(AuthService);
  private readonly favorites = inject(PlaybookFavoritesService);

  private readonly snapshot = signal<PlaybookSnapshot>(EMPTY_SNAPSHOT);
  private readonly loadingSig = signal(false);
  private readonly loadedSig = signal(false);
  private readonly errorSig = signal(false);
  private started = false;
  private loadSub?: Subscription;

  readonly loading = this.loadingSig.asReadonly();
  readonly loaded = this.loadedSig.asReadonly();
  readonly error = this.errorSig.asReadonly();

  /** Add / edit / delete content, load the ready-made content. */
  readonly canManage = computed(() => canManagePlaybook(this.auth.currentRole()));
  /** Link customers to competitors. */
  readonly canMention = computed(() => canMentionCompetitors(this.auth.currentRole()));

  readonly scripts = computed(() => this.sorted('scripts'));
  readonly objections = computed(() => this.sorted('objections'));
  readonly competitors = computed(() => this.sorted('competitors'));
  readonly replies = computed(() => this.sorted('replies'));

  /** Raw server order — for diffing against other data (e.g. the local-content migration). */
  readonly snapshotView = this.snapshot.asReadonly();

  readonly objectionCategories = computed(() => categoryCounts(this.snapshot().objections.map((o) => o.category)));
  readonly replyCategories = computed(() => categoryCounts(this.snapshot().replies.map((r) => r.category)));

  readonly counts = computed<Record<PlaybookKind, number>>(() => {
    const s = this.snapshot();
    return {
      scripts: s.scripts.length,
      objections: s.objections.length,
      competitors: s.competitors.length,
      replies: s.replies.length,
    };
  });

  readonly isEmpty = computed(() => Object.values(this.counts()).every((n) => n === 0));

  constructor() {
    // A different user signed in: drop the previous session's view.
    effect(() => {
      const userId = this.auth.currentUser()?.userId ?? null;
      untracked(() => {
        if (!this.started) return;
        this.snapshot.set(EMPTY_SNAPSHOT);
        this.loadedSig.set(false);
        if (userId) this.refresh();
      });
    });
  }

  start(): void {
    if (this.started) {
      if (!this.loadedSig() && !this.loadingSig()) this.refresh();
      return;
    }
    this.started = true;
    this.refresh();
  }

  /** `quiet` keeps the current content on screen (no skeleton). */
  refresh(quiet = false): void {
    this.loadSub?.unsubscribe();
    if (!quiet) this.loadingSig.set(true);
    this.errorSig.set(false);
    this.loadSub = this.repo
      .load()
      .pipe(finalize(() => this.loadingSig.set(false)))
      .subscribe({
        next: (s) => {
          this.snapshot.set(s);
          this.loadedSig.set(true);
        },
        error: () => this.errorSig.set(true),
      });
  }

  /** Re-reads the server and resolves once the snapshot is fresh. */
  reload(): Observable<PlaybookSnapshot> {
    this.loadSub?.unsubscribe();
    return this.repo.load().pipe(
      tap((s) => {
        this.snapshot.set(s);
        this.loadedSig.set(true);
        this.errorSig.set(false);
      }),
    );
  }

  // ─────────── favourites ───────────

  isFavorite(kind: PlaybookKind, id: string): boolean {
    return this.favorites.has(kind, id);
  }

  toggleFavorite(kind: PlaybookKind, id: string): boolean {
    return this.favorites.toggle(kind, id);
  }

  // ─────────── content (Admin) ───────────

  save<K extends PlaybookKind>(
    kind: K,
    input: PlaybookInputMap[K],
    id?: string | null,
  ): Observable<PlaybookEntityMap[K]> {
    const request$ = id ? this.repo.update(kind, id, input) : this.repo.create(kind, input);
    return request$.pipe(
      map((saved) => this.withKeptMentions(kind, saved)),
      tap((saved) => this.upsert(kind, saved)),
    );
  }

  remove(kind: PlaybookKind, id: string): Observable<void> {
    return this.repo.remove(kind, id).pipe(
      tap(() =>
        this.snapshot.update((s) => ({
          ...s,
          [kind]: (s[kind] as PlaybookRecord[]).filter((r) => r.id !== id),
        })),
      ),
    );
  }

  /** The backend's ready-made content (idempotent), then a quiet refresh. */
  importReadyContent(): Observable<PlaybookImportResult> {
    return this.repo.loadDefaultContent().pipe(tap(() => this.refresh(true)));
  }

  // ─────────── competitor mentions (Admin / Sales / Support) ───────────

  addMention(competitorId: string, input: CompetitorMentionInput): Observable<CompetitorMention> {
    return this.repo.addMention(competitorId, input).pipe(
      tap((mention) =>
        this.patchCompetitor(competitorId, (c) => {
          // Re-linking the same customer updates the existing mention server-side.
          const others = c.mentions.filter((m) => m.id !== mention.id && m.customerId !== mention.customerId);
          const mentions = [mention, ...others];
          const added = mentions.length - c.mentions.length;
          return { ...c, mentions, mentionsCount: Math.max(0, c.mentionsCount + added) };
        }),
      ),
    );
  }

  removeMention(competitorId: string, mentionId: string): Observable<void> {
    return this.repo.removeMention(mentionId).pipe(
      tap(() =>
        this.patchCompetitor(competitorId, (c) => ({
          ...c,
          mentions: c.mentions.filter((m) => m.id !== mentionId),
          mentionsCount: Math.max(0, c.mentionsCount - 1),
        })),
      ),
    );
  }

  // ─────────── internals ───────────

  /** Favourites first; otherwise the server's order (title / category / name / sortOrder). */
  private sorted<K extends PlaybookKind>(kind: K): PlaybookEntityMap[K][] {
    const rows = this.snapshot()[kind] as PlaybookEntityMap[K][];
    const fav = (r: PlaybookRecord) => (this.favorites.has(kind, r.id) ? 0 : 1);
    return rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => fav(a.row) - fav(b.row) || a.index - b.index)
      .map(({ row }) => row);
  }

  private upsert<K extends PlaybookKind>(kind: K, saved: PlaybookEntityMap[K]): void {
    this.snapshot.update((s) => {
      const rows = s[kind] as PlaybookEntityMap[K][];
      const next = rows.some((r) => r.id === saved.id)
        ? rows.map((r) => (r.id === saved.id ? saved : r))
        : [...rows, saved];
      return { ...s, [kind]: next };
    });
  }

  /** PUT/POST responses for competitors carry no mentions — keep the ones we have. */
  private withKeptMentions<K extends PlaybookKind>(kind: K, saved: PlaybookEntityMap[K]): PlaybookEntityMap[K] {
    if (kind !== 'competitors') return saved;
    const c = saved as Competitor;
    if (c.mentions.length) return saved;
    const current = this.snapshot().competitors.find((x) => x.id === c.id);
    return (current ? { ...c, mentions: current.mentions, mentionsCount: current.mentionsCount } : c) as PlaybookEntityMap[K];
  }

  private patchCompetitor(id: string, patch: (c: Competitor) => Competitor): void {
    this.snapshot.update((s) => ({
      ...s,
      competitors: s.competitors.map((c) => (c.id === id ? patch(c) : c)),
    }));
  }
}
