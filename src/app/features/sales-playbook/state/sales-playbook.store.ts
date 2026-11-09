import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subscription, finalize, switchMap, tap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { PlaybookFavoritesService } from '../data/playbook-favorites.service';
import { PlaybookLookupsService } from '../data/playbook-lookups.service';
import { SEED_OBJECTIONS, SEED_REPLIES, SEED_SCRIPTS } from '../data/playbook-seed-content';
import { SALES_PLAYBOOK_REPOSITORY } from '../data/sales-playbook-repository.provider';
import { canManagePlaybook } from '../data/sales-playbook.repository';
import {
  EMPTY_SNAPSHOT,
  PlaybookEntityMap,
  PlaybookImportBundle,
  PlaybookImportResult,
  PlaybookInputMap,
  PlaybookKind,
  PlaybookRecord,
  PlaybookServiceRef,
  PlaybookSnapshot,
} from '../models/sales-playbook.models';
import { findSimilarService } from '../utils/service-matching.util';

/**
 * App-wide sales playbook state — shared by the playbook page and the
 * WhatsApp quick-reply picker, so an edit shows up everywhere at once.
 *
 * `start()` is idempotent: the first consumer loads, later ones reuse.
 */
@Injectable({ providedIn: 'root' })
export class SalesPlaybookStore {
  private readonly repo = inject(SALES_PLAYBOOK_REPOSITORY);
  private readonly auth = inject(AuthService);
  private readonly lookups = inject(PlaybookLookupsService);
  private readonly favorites = inject(PlaybookFavoritesService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly snapshot = signal<PlaybookSnapshot>(EMPTY_SNAPSHOT);
  private readonly loadingSig = signal(false);
  private readonly loadedSig = signal(false);
  private readonly errorSig = signal(false);
  private started = false;
  private loadSub?: Subscription;

  readonly loading = this.loadingSig.asReadonly();
  readonly loaded = this.loadedSig.asReadonly();
  readonly error = this.errorSig.asReadonly();

  /** Can add / edit / delete / import — see `PLAYBOOK_MANAGER_ROLES`. */
  readonly canManage = computed(() => canManagePlaybook(this.auth.currentRole()));

  readonly scripts = computed(() => this.sorted('scripts'));
  readonly objections = computed(() => this.sorted('objections'));
  readonly competitors = computed(() => this.sorted('competitors'));
  readonly replies = computed(() => this.sorted('replies'));

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
    this.repo.externalChanges$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refresh(true));
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

  // ─────────── favourites ───────────

  isFavorite(kind: PlaybookKind, id: string): boolean {
    return this.favorites.has(kind, id);
  }

  toggleFavorite(kind: PlaybookKind, id: string): boolean {
    return this.favorites.toggle(kind, id);
  }

  // ─────────── mutations (admin) ───────────

  save<K extends PlaybookKind>(
    kind: K,
    input: PlaybookInputMap[K],
    id?: string | null,
  ): Observable<PlaybookEntityMap[K]> {
    const request$ = id ? this.repo.update(kind, id, input) : this.repo.create(kind, input);
    return request$.pipe(tap((saved) => this.upsert(kind, saved)));
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

  /**
   * Loads the website's ready-made content: links each program script to the
   * most similar service, then lets the repository add only what's missing.
   */
  importReadyContent(): Observable<PlaybookImportResult> {
    return this.lookups.services().pipe(
      switchMap((services) => this.repo.importContent(buildSeedBundle(services))),
      tap(() => this.refresh(true)),
    );
  }

  // ─────────── internals ───────────

  /** Favourites first, then newest. */
  private sorted<K extends PlaybookKind>(kind: K): PlaybookEntityMap[K][] {
    const rows = this.snapshot()[kind] as PlaybookEntityMap[K][];
    const fav = (r: PlaybookRecord) => (this.favorites.has(kind, r.id) ? 0 : 1);
    return [...rows].sort(
      (a, b) => fav(a) - fav(b) || (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0),
    );
  }

  private upsert<K extends PlaybookKind>(kind: K, saved: PlaybookEntityMap[K]): void {
    this.snapshot.update((s) => {
      const rows = s[kind] as PlaybookEntityMap[K][];
      const next = rows.some((r) => r.id === saved.id)
        ? rows.map((r) => (r.id === saved.id ? saved : r))
        : [saved, ...rows];
      return { ...s, [kind]: next };
    });
  }
}

/** Seed content → import bundle, scripts linked to their similar service. */
function buildSeedBundle(services: readonly PlaybookServiceRef[]): PlaybookImportBundle {
  return {
    scripts: SEED_SCRIPTS.map(({ serviceAliases, ...script }) => {
      const match = findSimilarService(serviceAliases, services);
      return {
        ...script,
        steps: [...script.steps],
        questions: [...script.questions],
        service: match ? { id: match.id, nameAr: match.nameAr, nameEn: match.nameEn } : null,
      };
    }),
    objections: SEED_OBJECTIONS.map((o) => ({ ...o })),
    replies: SEED_REPLIES.map((r) => ({ ...r })),
  };
}
