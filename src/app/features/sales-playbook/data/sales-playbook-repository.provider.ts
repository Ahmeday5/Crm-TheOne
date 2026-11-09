import { InjectionToken, inject } from '@angular/core';
import { HttpSalesPlaybookRepository } from './http-sales-playbook.repository';
import { SalesPlaybookRepository } from './sales-playbook.repository';

/**
 * The single binding of the playbook's persistence port. Tests (or a future
 * offline adapter) override this token; nothing else in the app changes.
 */
export const SALES_PLAYBOOK_REPOSITORY = new InjectionToken<SalesPlaybookRepository>(
  'SALES_PLAYBOOK_REPOSITORY',
  {
    providedIn: 'root',
    factory: () => inject(HttpSalesPlaybookRepository),
  },
);
