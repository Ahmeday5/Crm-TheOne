import { Provider } from '@angular/core';
import { HttpVaultLockGateway } from './http-vault-lock-gateway';
import { VaultLockGateway } from './vault-lock-gateway';

/** The vault-lock adapter (real API). */
export function provideVaultLockGateway(): Provider[] {
  return [HttpVaultLockGateway, { provide: VaultLockGateway, useExisting: HttpVaultLockGateway }];
}
