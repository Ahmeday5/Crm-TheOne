import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api-endpoints.const';
import { CACHE_TTL } from '../constants/cache-policy.const';
import {
  withCache,
  withCacheBypass,
  withCacheInvalidate,
  withInlineHandling,
  withSkipLoader,
} from '../http/http-context.tokens';
import {
  AddUserRequest,
  AppUser,
  UpdateUserRequest,
} from '../models/user.model';
import { ApiService } from './api.service';

/**
 * CRUD over `Auth/*` user endpoints.
 *
 * Caching:
 *   - `list()` and `getById()` are cached for the medium TTL (5 min) and
 *     persist to `localStorage`, so a refresh keeps the cache warm.
 *   - Mutations (`add`, `update`, `delete`) invalidate every cached URL
 *     containing `Auth/Get` so the next list/by-id read refetches.
 *
 * Errors / loaders:
 *   - Add / update use `withInlineHandling()` — the modal owns the spinner
 *     and surfaces validation errors inline.
 *   - Delete only skips the global loader; errors fall through to the toast
 *     because the page has no inline error slot for delete.
 */
@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly api = inject(ApiService);

  list(force = false): Observable<AppUser[]> {
    const ctx = force
      ? withCacheBypass(withCache({ ttlMs: CACHE_TTL.MEDIUM }))
      : withCache({ ttlMs: CACHE_TTL.MEDIUM });
    return this.api.get<AppUser[]>(API_ENDPOINTS.users.list, { context: ctx });
  }

  /** Available role names (`["Marketing","Sales",…]`) for the role pickers. */
  roles(): Observable<string[]> {
    return this.api.get<string[]>(API_ENDPOINTS.users.roles, {
      context: withCache({ ttlMs: CACHE_TTL.LONG }),
    });
  }

  getById(id: string): Observable<AppUser> {
    return this.api.get<AppUser>(API_ENDPOINTS.users.byId(id), {
      context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.MEDIUM })),
    });
  }

  add(payload: AddUserRequest): Observable<unknown> {
    return this.api.post<unknown>(API_ENDPOINTS.users.add, payload, {
      context: withInlineHandling(withCacheInvalidate(['Auth/Get'])),
    });
  }

  update(id: string, payload: UpdateUserRequest): Observable<AppUser> {
    return this.api.put<AppUser>(API_ENDPOINTS.users.update(id), payload, {
      context: withInlineHandling(withCacheInvalidate(['Auth/Get'])),
    });
  }

  delete(id: string): Observable<unknown> {
    return this.api.delete<unknown>(API_ENDPOINTS.users.delete(id), {
      context: withSkipLoader(withCacheInvalidate(['Auth/Get'])),
    });
  }
}
