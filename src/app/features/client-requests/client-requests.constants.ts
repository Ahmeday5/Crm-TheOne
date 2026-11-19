import { UserRole } from '../../core/models/auth.model';

/** The Admin's cross-project inbox of client requests. */
export const CLIENT_REQUESTS_PATH = '/client-requests';

/** Only the Admin triages (approve / reject / ask the client). */
export const CLIENT_REQUESTS_ROLES: ReadonlyArray<UserRole> = ['Admin'];
