import { ENVIRONMENT_INITIALIZER, EnvironmentProviders, inject, makeEnvironmentProviders } from '@angular/core';
import { ClientRequestsInboxStore } from './state/client-requests-inbox.store';

/**
 * Boots the client-requests inbox with the app, so the Admin's "waiting for
 * your decision" badge is live before the inbox page is ever opened.
 */
export function provideClientRequests(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => inject(ClientRequestsInboxStore).start(),
    },
  ]);
}
