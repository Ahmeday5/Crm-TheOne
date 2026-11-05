import { Injectable, computed, inject, signal } from '@angular/core';
import { Announcement } from '../models/announcement.models';
import { AnnouncementsStore } from './announcements.store';

/**
 * Opens one announcement in full (the detail dialog hosted by the banner,
 * which lives in the layout on every page). Opening it marks it read.
 *
 * Holds only the id so the dialog always shows the store's latest copy
 * (a hub update while it is open is reflected; a removal closes it).
 */
@Injectable({ providedIn: 'root' })
export class AnnouncementViewerService {
  private readonly store = inject(AnnouncementsStore);
  private readonly openId = signal<number | null>(null);
  /** Fallback copy for an announcement not (yet) in the store's lists. */
  private readonly snapshot = signal<Announcement | null>(null);

  readonly current = computed<Announcement | null>(() => {
    const id = this.openId();
    if (id === null) return null;
    // Re-read on every store change so edits and read receipts show live.
    this.store.bannerItems();
    this.store.boardItems();
    return this.store.find(id) ?? (this.snapshot()?.id === id ? this.snapshot() : null);
  });

  open(a: Announcement): void {
    // Only items the store doesn't hold need a snapshot; for the rest a
    // removal (hub / delete) drops them from the store and closes the dialog.
    this.snapshot.set(this.store.find(a.id) ? null : a);
    this.openId.set(a.id);
    this.store.markRead(a);
  }

  close(): void {
    this.openId.set(null);
    this.snapshot.set(null);
  }
}
