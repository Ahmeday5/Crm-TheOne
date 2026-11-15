import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { VAULT_LIMITS, VaultAccountInput, VaultAccountType } from '../models/vault.models';

/** Pure rules of the vault form — mirrored from the backend validation. */

/** IPv4, bracket-less IPv6, or an RFC-1123 hostname (`imap.gmail.com`, `srv-01`). */
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6 = /^[0-9a-f:]+$/i;
const HOSTNAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;

export function isValidHost(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (IPV4.test(v)) return true;
  if (v.includes(':')) return IPV6.test(v) && v.split(':').length >= 3;
  return HOSTNAME.test(v);
}

export function isValidUrl(value: string): boolean {
  return /^https?:\/\/[^\s/$.?#][^\s]*$/i.test(value.trim());
}

/** Empty is fine (pair with `required` when needed). */
export const hostValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  typeof c.value === 'string' && c.value.trim() && !isValidHost(c.value) ? { host: true } : null;

export const urlValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  typeof c.value === 'string' && c.value.trim() && !isValidUrl(c.value) ? { url: true } : null;

export const portValidator: ValidatorFn = (c: AbstractControl): ValidationErrors | null => {
  const v = c.value;
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= VAULT_LIMITS.portMin && n <= VAULT_LIMITS.portMax ? null : { port: true };
};

/** Which fields a type makes mandatory. */
export function requiredFieldsFor(type: VaultAccountType): { email: boolean; host: boolean } {
  return { email: type === 'Email', host: type === 'Server' };
}

export interface VaultFormValue {
  type: VaultAccountType;
  title: string;
  email: string;
  host: string;
  port: number | string | null;
  username: string;
  password: string;
  url: string;
  notes: string;
  customerId: number | null;
  projectId: number | null;
}

/**
 * Password on edit:
 *   keep    → field omitted (backend keeps the current one)
 *   remove  → `""`
 *   replace → the typed text
 * On create an empty password is simply not sent.
 */
export type PasswordIntent = 'keep' | 'remove' | 'replace';

export function passwordIntent(mode: 'create' | 'edit', typed: string, removeRequested: boolean): PasswordIntent {
  if (mode === 'edit' && removeRequested) return 'remove';
  return typed ? 'replace' : 'keep';
}

export function buildVaultInput(v: VaultFormValue, intent: PasswordIntent): VaultAccountInput {
  const text = (s: string) => s.trim() || undefined;
  const port = v.port === null || v.port === '' ? undefined : Number(v.port);
  const input: VaultAccountInput = {
    type: v.type,
    title: v.title.trim(),
    email: text(v.email),
    host: text(v.host),
    port: Number.isInteger(port) ? port : undefined,
    username: text(v.username),
    url: text(v.url),
    notes: text(v.notes),
    customerId: v.customerId ?? undefined,
    projectId: v.projectId ?? undefined,
  };
  // Passwords are sent exactly as typed — leading/trailing spaces can be part of one.
  if (intent === 'replace') input.password = v.password;
  else if (intent === 'remove') input.password = '';
  return input;
}

/** `host:port` (or just the host) for the list. */
export function endpointLabel(host: string | null, port: number | null): string | null {
  if (!host) return null;
  const h = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  return port ? `${h}:${port}` : host;
}
