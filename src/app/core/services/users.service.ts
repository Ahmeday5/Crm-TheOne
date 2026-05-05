import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { API_ENDPOINTS } from '../constants/api-endpoints.const';
import {
  AddUserRequest,
  AppUser,
  UpdateUserRequest,
} from '../models/user.model';
import {
  withCache,
  withCacheInvalidate,
  withInlineHandling,
} from '../http/http-context.tokens';

/**
 * CRUD over `Auth/*` user endpoints.
 *
 * Caching strategy:
 *   - `list()` is cached for 30 seconds — short TTL because user lists change
 *     often, but long enough that switching tabs / quick navigations are
 *     instant.
 *   - Mutations (`add`, `update`, `delete`) invalidate every cached URL
 *     containing `Auth/Get` so the next list/by-id read refetches.
 *
 * Errors / loaders:
 *   - `list()` & `getById()` use the global loader.
 *   - Mutations use `withInlineHandling()` — the caller (modal/button) shows
 *     its own spinner and surfaces validation errors inline.
 */
@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly api = inject(ApiService);

  list(): Observable<AppUser[]> {
    return this.api.get<AppUser[]>(API_ENDPOINTS.users.list, {
      context: withCache({ ttlMs: 30_000 }),
    });
  }

  getById(id: string): Observable<AppUser> {
    return this.api.get<AppUser>(API_ENDPOINTS.users.byId(id), {
      context: withCache({ ttlMs: 30_000 }),
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
      context: withInlineHandling(withCacheInvalidate(['Auth/Get'])),
    });
  }
}
