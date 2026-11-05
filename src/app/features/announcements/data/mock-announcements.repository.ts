import { Injectable, inject } from '@angular/core';
import {
  Observable,
  defer,
  delay,
  filter,
  fromEvent,
  map,
  of,
  switchMap,
  throwError,
} from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import {
  Announcement,
  AnnouncementInput,
} from '../models/announcement.models';
import { isTargeted } from '../utils/announcement.util';
import { AnnouncementDeliveryService } from './announcement-delivery.service';
import { AnnouncementsRepository } from './announcements.repository';

const STORAGE_KEY = 'crm.announcements.mock.v1';
/** Small artificial latency so loading states are exercised like the real API. */
const LATENCY_MS = 180;

/** What the mock persists — the per-viewer fields are derived on read. */
type StoredAnnouncement = Omit<Announcement, 'isRead' | 'readAt' | 'readCount'> & {
  /** userId → ISO timestamp of the read receipt. */
  readBy: Record<string, string>;
};

/**
 * TEMPORARY adapter until `/Announcements` exists on the backend.
 *
 * Persists in `localStorage`, so announcements are only visible in this
 * browser — but delivery is real: `create()` notifies every targeted
 * employee through `Notifications/send`. Mirrors the server contract
 * (filtering by audience, read receipts, counters) so swapping in
 * `HttpAnnouncementsRepository` needs no UI change.
 */
@Injectable({ providedIn: 'root' })
export class MockAnnouncementsRepository extends AnnouncementsRepository {
  private readonly auth = inject(AuthService);
  private readonly delivery = inject(AnnouncementDeliveryService);

  /** Another tab wrote to the same storage key. */
  readonly externalChanges$: Observable<void> = fromEvent<StorageEvent>(window, 'storage').pipe(
    filter((e) => e.key === STORAGE_KEY),
    map(() => undefined),
  );

  list(): Observable<Announcement[]> {
    return defer(() => {
      const role = this.auth.currentRole();
      return of(this.read().filter((a) => isTargeted(a, role)).map((a) => this.toView(a)));
    }).pipe(delay(LATENCY_MS));
  }

  create(input: AnnouncementInput): Observable<Announcement> {
    return defer(() => {
      if (!this.isAdmin()) return this.forbidden();
      const user = this.auth.currentUser();
      const now = new Date().toISOString();
      const record: StoredAnnouncement = {
        ...this.normalize(input),
        id: this.newId(),
        createdAt: now,
        updatedAt: null,
        author: { id: user?.userId ?? '', name: user?.fullName || user?.email || '' },
        recipientsCount: 0,
        readBy: {},
      };
      this.write([record, ...this.read()]);
      return this.delivery.deliver(this.toView(record)).pipe(
        map((report) => {
          const saved = this.patch(record.id, { recipientsCount: report.recipients });
          return this.toView(saved ?? record);
        }),
      );
    });
  }

  update(id: string, input: AnnouncementInput): Observable<Announcement> {
    return this.mutate(id, () => ({ ...this.normalize(input), updatedAt: new Date().toISOString() }));
  }

  remove(id: string): Observable<void> {
    return defer(() => {
      if (!this.isAdmin()) return this.forbidden();
      this.write(this.read().filter((a) => a.id !== id));
      return of(undefined);
    }).pipe(delay(LATENCY_MS));
  }

  setPinned(id: string, isPinned: boolean): Observable<Announcement> {
    return this.mutate(id, () => ({ isPinned }));
  }

  markRead(id: string): Observable<void> {
    return defer(() => {
      const userId = this.auth.currentUser()?.userId;
      const target = this.read().find((a) => a.id === id);
      if (!userId || !target) return of(undefined);
      if (!target.readBy[userId]) {
        this.patch(id, { readBy: { ...target.readBy, [userId]: new Date().toISOString() } });
      }
      return of(undefined);
    });
  }

  // ─────────── internals ───────────

  private mutate(
    id: string,
    changes: () => Partial<StoredAnnouncement>,
  ): Observable<Announcement> {
    return defer(() => {
      if (!this.isAdmin()) return this.forbidden();
      const saved = this.patch(id, changes());
      return saved ? of(this.toView(saved)) : throwError(() => ({ message: 'Announcement not found.' }));
    }).pipe(delay(LATENCY_MS));
  }

  private patch(id: string, changes: Partial<StoredAnnouncement>): StoredAnnouncement | null {
    let saved: StoredAnnouncement | null = null;
    this.write(
      this.read().map((a) => {
        if (a.id !== id) return a;
        saved = { ...a, ...changes };
        return saved;
      }),
    );
    return saved;
  }

  private toView(a: StoredAnnouncement): Announcement {
    const userId = this.auth.currentUser()?.userId ?? '';
    const { readBy, ...rest } = a;
    return {
      ...rest,
      isRead: !!readBy[userId],
      readAt: readBy[userId] ?? null,
      readCount: Object.keys(readBy).filter((id) => id !== a.author.id).length,
    };
  }

  private normalize(input: AnnouncementInput): AnnouncementInput {
    return {
      ...input,
      title: input.title.trim(),
      body: input.body.trim(),
      roles: input.audience === 'all' ? [] : [...new Set(input.roles)],
    };
  }

  private read(): StoredAnnouncement[] {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  private write(rows: StoredAnnouncement[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch {
      /* storage full / blocked — the next read simply won't see the change */
    }
  }

  private isAdmin(): boolean {
    return this.auth.currentRole() === 'Admin';
  }

  private forbidden(): Observable<never> {
    return throwError(() => ({ message: 'Only admins can manage announcements.' }));
  }

  private newId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
