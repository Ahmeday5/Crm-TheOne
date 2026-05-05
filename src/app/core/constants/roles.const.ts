import { UserRole } from '../models/auth.model';

/** Compile-time list of all roles — single source of truth. */
export const ALL_ROLES: ReadonlyArray<UserRole> = [
  'Admin',
  'Developer',
  'Sales',
  'Marketing',
  'Support',
];

/** Display labels — used in topbar profile + role guards. */
export const ROLE_LABELS_AR: Record<UserRole, string> = {
  Admin: 'مدير النظام',
  Developer: 'مطور',
  Sales: 'مبيعات',
  Marketing: 'تسويق',
  Support: 'الدعم الفني',
};

export const ROLE_LABELS_EN: Record<UserRole, string> = {
  Admin: 'Admin',
  Developer: 'Developer',
  Sales: 'Sales',
  Marketing: 'Marketing',
  Support: 'Support',
};

export function roleLabel(role: UserRole | null | undefined, lang: 'ar' | 'en' = 'ar'): string {
  if (!role) return '';
  return (lang === 'en' ? ROLE_LABELS_EN : ROLE_LABELS_AR)[role] ?? role;
}
