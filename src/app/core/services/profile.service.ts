import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api-endpoints.const';
import { withCacheInvalidate, withInlineHandling } from '../http/http-context.tokens';
import { AppUser } from '../models/user.model';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

/** Cached user reads that embed `imageUrl` and must refetch after a change. */
const USER_CACHE_KEYS = ['Auth/'] as const;

/**
 * The signed-in user's own profile (`Auth/profile-image`).
 *
 * Every successful call writes the new `imageUrl` back into the session via
 * `AuthService.patchCurrentUser`, so the header avatar and every other
 * `currentUser()` consumer update immediately — no reload, no refetch.
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  /** PUT /Auth/profile-image — multipart field `image` (max 5 MB). */
  uploadImage(image: File): Observable<AppUser> {
    const form = new FormData();
    form.append('image', image, image.name);
    return this.api
      .put<AppUser>(API_ENDPOINTS.auth.profileImage, form, {
        context: withInlineHandling(withCacheInvalidate([...USER_CACHE_KEYS])),
      })
      .pipe(tap((user) => this.auth.patchCurrentUser({ imageUrl: user?.imageUrl ?? null })));
  }

  /** DELETE /Auth/profile-image */
  removeImage(): Observable<unknown> {
    return this.api
      .delete<unknown>(API_ENDPOINTS.auth.profileImage, {
        context: withInlineHandling(withCacheInvalidate([...USER_CACHE_KEYS])),
      })
      .pipe(tap(() => this.auth.patchCurrentUser({ imageUrl: null })));
  }
}
