import { Provider } from '@angular/core';
import { MockVaultLockGateway } from './mock-vault-lock-gateway';
import { VaultLockGateway } from './vault-lock-gateway';

/**
 * The switch for the vault page lock.
 *
 * Going live needs exactly two edits, both in this file:
 *   1. bind `HttpVaultLockGateway` below instead of the mock;
 *   2. flip `SEND_VAULT_TOKEN` to `true` so `vaultTokenInterceptor` adds
 *      `X-Vault-Token` to every vault API call.
 * (Kept `false` while mocked: the current backend doesn't expect the header,
 * and an unknown custom header could fail its CORS preflight.)
 */
export const SEND_VAULT_TOKEN = false;

export function provideVaultLockGateway(): Provider[] {
  return [MockVaultLockGateway, { provide: VaultLockGateway, useExisting: MockVaultLockGateway }];
}
