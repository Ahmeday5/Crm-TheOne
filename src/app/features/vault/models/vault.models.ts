/**
 * Accounts vault (`/api/Vault`, Admin only) — email and server credentials.
 *
 * Reads never include the password: `hasPassword` says whether one exists,
 * and `GET /Vault/{id}/password` is the only way to read it (logged
 * server-side). The client never stores it anywhere.
 */

export type VaultAccountType = 'Email' | 'Server';

export const VAULT_TYPES: readonly VaultAccountType[] = ['Email', 'Server'];

export interface VaultAccount {
  id: number;
  type: VaultAccountType;
  /** Localised by the backend: "إيميل" | "سيرفر". */
  typeName: string;
  title: string;
  email: string | null;
  host: string | null;
  port: number | null;
  username: string | null;
  hasPassword: boolean;
  url: string | null;
  notes: string | null;
  customerId: number | null;
  customerName: string | null;
  projectId: number | null;
  projectTitle: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedByName: string | null;
  updatedAt: string | null;
}

/**
 * Create / update body. On update `password` means:
 * omitted / `null` → keep, `""` → remove, text → replace.
 */
export interface VaultAccountInput {
  type: VaultAccountType;
  title: string;
  email?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string | null;
  url?: string;
  notes?: string;
  customerId?: number;
  projectId?: number;
}

export interface VaultPassword {
  id: number;
  password: string;
}

export interface VaultListQuery {
  type?: VaultAccountType | null;
  search?: string | null;
  customerId?: number | null;
  projectId?: number | null;
  pageIndex: number;
  pageSize: number;
}

/** Validation limits — mirrored from the backend. */
export const VAULT_LIMITS = {
  title: 150,
  email: 254,
  host: 255,
  username: 150,
  password: 500,
  url: 500,
  notes: 2000,
  portMin: 1,
  portMax: 65535,
} as const;
