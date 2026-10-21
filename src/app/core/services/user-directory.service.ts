import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api-endpoints.const';
import { CACHE_TTL } from '../constants/cache-policy.const';
import { withCache, withSilentErrors, withSkipLoader } from '../http/http-context.tokens';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

interface DirectoryUser {
  userId: string;
  imageUrl?: string | null;
}

/**
 * userId → profile image lookup for places where the API only returns a
 * name + id (goal assignees, progress entries, leaderboard rows…).
 *
 * Loaded lazily on the first `imageFor()` call and at most once per session:
 * Admins read the full user list, everyone else the sales + developer
 * rosters (the people those screens are about). A failed or forbidden load is silent — avatars
 * simply fall back to initials. Pages that already fetched users can
 * `register()` them to skip the round-trip. The signed-in user is always
 * resolved from the live session, so their own avatar updates instantly.
 */
@Injectable({ providedIn: 'root' })
export class UserDirectoryService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  private readonly images = signal<ReadonlyMap<string, string | null>>(new Map());
  private requested = false;

  private readonly selfId = computed(() => this.auth.currentUser()?.userId ?? null);
  private readonly selfImage = computed(() => this.auth.currentUser()?.imageUrl ?? null);

  /** Reactive: reads inside templates/computeds re-run once the directory loads. */
  imageFor(userId: string | null | undefined): string | null {
    if (!userId) return null;
    if (userId === this.selfId()) return this.selfImage();
    this.ensureLoaded();
    return this.images().get(userId) ?? null;
  }

  register(users: readonly DirectoryUser[] | null | undefined): void {
    if (!users?.length) return;
    this.images.update((current) => {
      const next = new Map(current);
      for (const u of users) {
        if (u?.userId && 'imageUrl' in u) next.set(u.userId, u.imageUrl ?? null);
      }
      return next;
    });
  }

  private ensureLoaded(): void {
    if (this.requested || !this.auth.currentUser()) return;
    this.requested = true;
    // Deferred so a template read never triggers a signal write mid-render.
    queueMicrotask(() => this.fetch().subscribe((users) => this.register(users)));
  }

  private fetch(): Observable<DirectoryUser[]> {
    if (this.auth.currentRole() === 'Admin') return this.read(API_ENDPOINTS.users.list);
    // Non-admins can't list every user; the rosters cover the people they see.
    return forkJoin([
      this.read(API_ENDPOINTS.auth.sales),
      this.read(API_ENDPOINTS.auth.developers),
    ]).pipe(map((lists) => lists.flat()));
  }

  private read(endpoint: string): Observable<DirectoryUser[]> {
    return this.api
      .get<DirectoryUser[]>(endpoint, {
        context: withSilentErrors(withSkipLoader(withCache({ ttlMs: CACHE_TTL.MEDIUM }))),
      })
      .pipe(
        map((rows) => (Array.isArray(rows) ? rows : [])),
        catchError(() => of([] as DirectoryUser[])),
      );
  }
}
