import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { withInlineHandling, withSkipLoader } from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import { CustomerDropdownItem, PagedResult } from '../../../shared/models';
import { VaultAccount, VaultAccountInput, VaultListQuery, VaultPassword } from '../models/vault.models';

/**
 * `/api/Vault` — deliberately uncached. The HTTP cache mirrors responses to
 * localStorage, so no vault request (not even the lists, which expose hosts
 * and usernames) opts into it. Errors are handled inline by the callers.
 */
@Injectable({ providedIn: 'root' })
export class VaultService {
  private readonly api = inject(ApiService);

  list(query: VaultListQuery): Observable<PagedResult<VaultAccount>> {
    return this.api
      .get<PagedResult<VaultAccount>>(API_ENDPOINTS.vault.list, {
        params: {
          type: query.type || undefined,
          search: query.search?.trim() || undefined,
          customerId: query.customerId ?? undefined,
          projectId: query.projectId ?? undefined,
          pageIndex: query.pageIndex,
          pageSize: query.pageSize,
        },
        context: withInlineHandling(),
      })
      .pipe(
        map((page) => ({
          pageIndex: page?.pageIndex ?? query.pageIndex,
          pageSize: page?.pageSize ?? query.pageSize,
          count: page?.count ?? 0,
          data: page?.data ?? [],
        })),
      );
  }

  getById(id: number): Observable<VaultAccount> {
    return this.api.get<VaultAccount>(API_ENDPOINTS.vault.byId(id), { context: withInlineHandling() });
  }

  /** On demand only — the caller holds it briefly and never persists it. */
  revealPassword(id: number): Observable<string> {
    return this.api
      .get<VaultPassword>(API_ENDPOINTS.vault.password(id), { context: withInlineHandling() })
      .pipe(map((res) => res?.password ?? ''));
  }

  create(input: VaultAccountInput): Observable<VaultAccount> {
    return this.api.post<VaultAccount>(API_ENDPOINTS.vault.list, input, { context: withInlineHandling() });
  }

  update(id: number, input: VaultAccountInput): Observable<VaultAccount> {
    return this.api.put<VaultAccount>(API_ENDPOINTS.vault.byId(id), input, { context: withInlineHandling() });
  }

  delete(id: number): Observable<unknown> {
    return this.api.delete<unknown>(API_ENDPOINTS.vault.byId(id), { context: withInlineHandling() });
  }

  // ── pickers (reference data, not secrets) ──

  customerOptions(): Observable<CustomerDropdownItem[]> {
    return this.api
      .get<CustomerDropdownItem[]>(API_ENDPOINTS.customers.dropdown, { context: withSkipLoader() })
      .pipe(map((rows) => (Array.isArray(rows) ? rows : [])));
  }

  projectsPage(params: { search: string; pageIndex: number; pageSize: number }): Observable<PagedResult<{ id: number; title: string }>> {
    return this.api.get<PagedResult<{ id: number; title: string }>>(API_ENDPOINTS.managerProjects.list, {
      params: { Search: params.search || undefined, PageIndex: params.pageIndex, PageSize: params.pageSize },
      context: withSkipLoader(),
    });
  }
}
