import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { CACHE_TTL } from '../../../core/constants/cache-policy.const';
import {
  withCache,
  withCacheInvalidate,
  withInlineHandling,
  withSkipLoader,
} from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import {
  Article,
  ArticleCategoryOption,
  ArticleListQuery,
  PagedResult,
  UpdateArticleBody,
} from '../../../shared/models';

/**
 * HTTP boundary for the `Articles/*` (knowledge-base) endpoints.
 *
 * Create is multipart (text fields + up to 5 attachments) so the caller builds
 * the `FormData`; update is a plain JSON body (no attachments). Every mutation
 * invalidates the cached `Articles` URLs so the list refetches.
 */
@Injectable({ providedIn: 'root' })
export class ArticlesService {
  private readonly api = inject(ApiService);

  list(query: ArticleListQuery = {}): Observable<PagedResult<Article>> {
    return this.api.get<PagedResult<Article>>(API_ENDPOINTS.articles.list, {
      params: query as Record<string, unknown>,
      context: withCache({ ttlMs: CACHE_TTL.SHORT }),
    });
  }

  getById(id: number): Observable<Article> {
    return this.api.get<Article>(API_ENDPOINTS.articles.byId(id), {
      context: withSkipLoader(withCache({ ttlMs: CACHE_TTL.SHORT })),
    });
  }

  create(form: FormData): Observable<Article> {
    return this.api.post<Article>(API_ENDPOINTS.articles.create, form, {
      context: withInlineHandling(withCacheInvalidate(['Articles'])),
    });
  }

  update(id: number, body: UpdateArticleBody): Observable<Article> {
    return this.api.put<Article>(API_ENDPOINTS.articles.update(id), body, {
      context: withInlineHandling(withCacheInvalidate(['Articles'])),
    });
  }

  delete(id: number): Observable<unknown> {
    return this.api.delete<unknown>(API_ENDPOINTS.articles.delete(id), {
      context: withSkipLoader(withCacheInvalidate(['Articles'])),
    });
  }

  // ─────────── category pickers ───────────

  projectOptions(): Observable<ArticleCategoryOption[]> {
    return this.api.get<ArticleCategoryOption[]>(
      API_ENDPOINTS.articles.projectOptions,
      { context: withCache({ ttlMs: CACHE_TTL.LONG }) },
    );
  }

  customerOptions(): Observable<ArticleCategoryOption[]> {
    return this.api.get<ArticleCategoryOption[]>(
      API_ENDPOINTS.articles.customerOptions,
      { context: withCache({ ttlMs: CACHE_TTL.LONG }) },
    );
  }
}
