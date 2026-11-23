import { ENVIRONMENT_INITIALIZER, EnvironmentProviders, inject, makeEnvironmentProviders } from '@angular/core';
import { NewBuyerContractService } from './services/new-buyer-contract.service';

/**
 * App-wide sales flows that must be live before any sales page is opened:
 * marking a customer as Buyer anywhere opens the create-contract dialog.
 */
export function provideSalesFlows(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => inject(NewBuyerContractService).start(),
    },
  ]);
}
