import { UserRole } from '../../core/models/auth.model';

/**
 * Who may do what in the sales playbook — mirrors the backend's
 * `[Authorize(Roles)]` on `api/SalesPlaybook`. Change a role here and the
 * route, the buttons and the store all follow; the backend must agree,
 * otherwise the request is rejected with 403.
 */

/** Open the page and read every tab. */
export const PLAYBOOK_READER_ROLES: readonly UserRole[] = ['Admin', 'Sales', 'Support', 'Marketing'];

/** Create / edit / delete content and load the ready-made content. */
export const PLAYBOOK_MANAGER_ROLES: readonly UserRole[] = ['Admin'];

/** Link a customer to a competitor (and remove that link). */
export const PLAYBOOK_MENTION_ROLES: readonly UserRole[] = ['Admin', 'Sales', 'Support'];

function hasRole(roles: readonly UserRole[], role: UserRole | null | undefined): boolean {
  return !!role && roles.includes(role);
}

export const canManagePlaybook = (role: UserRole | null | undefined): boolean =>
  hasRole(PLAYBOOK_MANAGER_ROLES, role);

export const canMentionCompetitors = (role: UserRole | null | undefined): boolean =>
  hasRole(PLAYBOOK_MENTION_ROLES, role);
