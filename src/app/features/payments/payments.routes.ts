import { Routes } from '@angular/router';
import { PAYMENT_ROLES } from './payments.constants';

/**
 * `/pay/:token` — anonymous page the customer opens from WhatsApp. Registered
 * BEFORE the staff shell (no auth guard, no staff chrome).
 */
export const PAYMENTS_PUBLIC_ROUTES: Routes = [
  {
    path: 'pay/:token',
    title: 'TheOne — Payment',
    loadComponent: () => import('./pages/public-pay/public-pay.component').then((m) => m.PublicPayComponent),
  },
];

/** `/payments` — staff list of payment requests (same roles as WhatsApp). */
export const PAYMENTS_STAFF_ROUTES: Routes = [
  {
    path: 'payments',
    title: 'طلبات الدفع',
    data: { roles: [...PAYMENT_ROLES] },
    loadComponent: () =>
      import('./pages/payment-requests/payment-requests.component').then((m) => m.PaymentRequestsComponent),
  },
];
