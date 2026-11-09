import { ApiError } from '../../../core/models/api-response.model';

/**
 * User-facing message for a failed playbook request.
 *
 * 401 here is the backend's *permission* answer ("Unauthorized access." —
 * e.g. a rep touching a customer that isn't theirs), never a logout; the
 * request opts into `withUnauthorizedAsForbidden` so the session survives.
 */
export function playbookErrorMessage(err: ApiError | null | undefined, t: (key: string) => string): string {
  switch (err?.status) {
    case 401:
      return t('salesPlaybook.messages.noCustomerAccess');
    case 403:
      return t('salesPlaybook.messages.forbidden');
    case 404:
      return err.message?.trim() || t('salesPlaybook.messages.notFound');
    default:
      return err?.message?.trim() || t('salesPlaybook.messages.saveFailed');
  }
}
