import { Provider } from '@angular/core';
import { ClientPortalGateway } from './client-portal-gateway';
import { MockClientPortalGateway } from './mock-client-portal-gateway';

/**
 * The single switch between client-portal adapters.
 *
 * Today: the in-memory mock. When the HTTP adapter exists
 * (`HttpClientPortalGateway extends ClientPortalGateway`), bind it here —
 * nothing in the pages or the workspace's requests tab changes.
 */
export function provideClientPortalGateway(): Provider[] {
  return [MockClientPortalGateway, { provide: ClientPortalGateway, useExisting: MockClientPortalGateway }];
}
