import { UserRole } from '../../core/models/auth.model';

/** Staff list of payment requests. */
export const PAYMENTS_PATH = '/payments';

/** Roles that send payment links from the chat (same as WhatsApp). */
export const PAYMENT_ROLES: readonly UserRole[] = ['Admin', 'Sales', 'Support'];
