import { InjectionToken, inject } from '@angular/core';
import { MockSmartAnalyticsRepository } from './mock-smart-analytics.repository';
import { SmartAnalyticsRepository } from './smart-analytics.repository';
// import { HttpSmartAnalyticsRepository } from './http-smart-analytics.repository';

/**
 * The single switch between persistence adapters.
 *
 * Today the backend has no `/SmartAnalytics` endpoints, so the seeded mock
 * adapter is active. When the API in `docs/api/smart-analytics.md` is
 * deployed, replace the factory body with:
 *
 *     factory: () => inject(HttpSmartAnalyticsRepository),
 *
 * — nothing else in the app changes.
 */
export const SMART_ANALYTICS_REPOSITORY = new InjectionToken<SmartAnalyticsRepository>(
  'SMART_ANALYTICS_REPOSITORY',
  {
    providedIn: 'root',
    factory: () => inject(MockSmartAnalyticsRepository),
  },
);
