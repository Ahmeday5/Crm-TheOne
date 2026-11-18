import { ENVIRONMENT_INITIALIZER, EnvironmentProviders, inject, makeEnvironmentProviders } from '@angular/core';
import { PaymentsInboxStore } from './state/payments-inbox.store';

/**
 * Boots payment links with the app, so the "needs review" badge and the
 * reaction to "customer confirmed" notifications are live before the
 * payments page is ever opened. The store follows the session by itself.
 */
export function providePayments(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => inject(PaymentsInboxStore).start(),
    },
  ]);
}
