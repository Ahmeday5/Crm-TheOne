import { Injectable, Signal, computed, signal } from '@angular/core';

/**
 * Counters shown next to sidebar items, keyed by the item's `path`.
 *
 * Features publish their own count (e.g. the WhatsApp module publishes its
 * unread chats under `/whatsapp`) so the sidebar never imports feature code.
 */
@Injectable({ providedIn: 'root' })
export class NavBadgesService {
  private readonly counts = signal<ReadonlyMap<string, number>>(new Map());

  set(path: string, count: number): void {
    const next = Math.max(0, Math.floor(count || 0));
    if ((this.counts().get(path) ?? 0) === next) return;
    this.counts.update((current) => {
      const map = new Map(current);
      if (next) map.set(path, next);
      else map.delete(path);
      return map;
    });
  }

  clear(path: string): void {
    this.set(path, 0);
  }

  /** `0` when nothing is published for `path`. */
  count(path: string): Signal<number> {
    return computed(() => this.counts().get(path) ?? 0);
  }

  /** Snapshot accessor for templates that iterate many items. */
  get(path: string): number {
    return this.counts().get(path) ?? 0;
  }
}
