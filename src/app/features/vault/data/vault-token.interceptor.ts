import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { VaultSessionService } from '../state/vault-session.service';
import { SEND_VAULT_TOKEN } from './vault-lock-gateway.provider';

/** Vault data calls — but not the lock endpoints themselves (they come before a token exists). */
const VAULT_DATA_URL = /\/Vault(\/(?!lock|unlock)[^?]*)?(\?|$)/i;

/**
 * Adds `X-Vault-Token` to every vault data request while the vault is
 * unlocked. Inert until `SEND_VAULT_TOKEN` is switched on with the real
 * backend (see `vault-lock-gateway.provider.ts`).
 */
export const vaultTokenInterceptor: HttpInterceptorFn = (req, next) => {
  if (!SEND_VAULT_TOKEN || !VAULT_DATA_URL.test(req.url)) return next(req);
  const token = inject(VaultSessionService).token();
  return next(token ? req.clone({ setHeaders: { 'X-Vault-Token': token } }) : req);
};
