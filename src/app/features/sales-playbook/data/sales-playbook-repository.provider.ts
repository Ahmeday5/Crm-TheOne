import { InjectionToken, inject } from '@angular/core';
import { MockSalesPlaybookRepository } from './mock-sales-playbook.repository';
import { SalesPlaybookRepository } from './sales-playbook.repository';
// import { HttpSalesPlaybookRepository } from './http-sales-playbook.repository';

/**
 * The single switch between persistence adapters.
 *
 * Today the backend has no `/SalesPlaybook` endpoints, so the mock adapter is
 * active. When the API in `docs/api/sales-playbook.md` is deployed, replace
 * the factory body with `inject(HttpSalesPlaybookRepository)` — nothing else
 * in the app changes.
 */
export const SALES_PLAYBOOK_REPOSITORY = new InjectionToken<SalesPlaybookRepository>(
  'SALES_PLAYBOOK_REPOSITORY',
  {
    providedIn: 'root',
    factory: () => inject(MockSalesPlaybookRepository),
  },
);
