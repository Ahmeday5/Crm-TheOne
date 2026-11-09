import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { PlaybookKind } from '../models/sales-playbook.models';

const KEY_PREFIX = 'crm.salesPlaybook.favorites.v1:';

/**
 * Per-user favourites — a personal shortlist, so it stays in this browser
 * (`localStorage`, keyed by user id) and never reaches the backend.
 */
@Injectable({ providedIn: 'root' })
export class PlaybookFavoritesService {
  private readonly auth = inject(AuthService);
  private readonly keys = signal<ReadonlySet<string>>(new Set());

  readonly count = computed(() => this.keys().size);

  constructor() {
    // Reload whenever a different user signs in.
    effect(() => {
      const userId = this.auth.currentUser()?.userId ?? null;
      untracked(() => this.keys.set(this.read(userId)));
    });
  }

  has(kind: PlaybookKind, id: string): boolean {
    return this.keys().has(this.key(kind, id));
  }

  /** Returns the new state (`true` = now a favourite). */
  toggle(kind: PlaybookKind, id: string): boolean {
    const k = this.key(kind, id);
    const next = new Set(this.keys());
    const added = !next.delete(k);
    if (added) next.add(k);
    this.keys.set(next);
    this.write(next);
    return added;
  }

  /** Carries a favourite over when an item gets a new id (e.g. moved to the server). */
  remap(kind: PlaybookKind, fromId: string, toId: string): void {
    const from = this.key(kind, fromId);
    if (fromId === toId || !this.keys().has(from)) return;
    const next = new Set(this.keys());
    next.delete(from);
    next.add(this.key(kind, toId));
    this.keys.set(next);
    this.write(next);
  }

  private key(kind: PlaybookKind, id: string): string {
    return `${kind}:${id}`;
  }

  private storageKey(userId: string | null): string | null {
    return userId ? `${KEY_PREFIX}${userId}` : null;
  }

  private read(userId: string | null): Set<string> {
    const key = this.storageKey(userId);
    if (!key) return new Set();
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? '[]');
      return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);
    } catch {
      return new Set();
    }
  }

  private write(keys: ReadonlySet<string>): void {
    const key = this.storageKey(this.auth.currentUser()?.userId ?? null);
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify([...keys]));
    } catch {
      /* storage blocked — favourites just won't survive a reload */
    }
  }
}
