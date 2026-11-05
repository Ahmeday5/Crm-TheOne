import { Routes } from '@angular/router';

export const SALES_PHASES_ROUTES: Routes = [
  {
    // Formerly the "sales line" shell with price-offers / contracts /
    // follow-ups tabs — it is now the price-offers page on its own.
    path: 'price-offers',
    title: 'عروض الأسعار',
    data: { roles: ['Admin', 'Sales'] },
    loadComponent: () =>
      import('./pages/price-offers/price-offers.component').then(
        (m) => m.PriceOffersComponent,
      ),
  },
  // Old tab URLs (bookmarks, notification links) → their current home.
  { path: 'contracts', redirectTo: 'contracts-management', pathMatch: 'full' },
  { path: 'follow-ups', redirectTo: 'price-offers', pathMatch: 'full' },
  {
    path: 'view-details-deal',
    title: 'تفاصيل الصفقة',
    loadComponent: () =>
      import('./pages/sales-line/view-details/view-details.component').then(
        (m) => m.ViewDetailsComponent,
      ),
  },
  {
    path: 'price-offer-contract/:id',
    title: 'عقد عرض السعر',
    loadComponent: () =>
      import(
        './pages/price-offers/price-offer-contract/price-offer-contract.component'
      ).then((m) => m.PriceOfferContractComponent),
  },
  {
    path: 'contracts-management',
    title: 'إدارة العقود والوثائق',
    data: { roles: ['Admin', 'Sales'] },
    loadComponent: () =>
      import(
        './pages/contracts-management/contracts-management.component'
      ).then((m) => m.ContractsManagementComponent),
  },
  {
    path: 'sale-contract/:id',
    title: 'عقد بيع',
    data: { roles: ['Admin', 'Sales'] },
    loadComponent: () =>
      import(
        './pages/contracts-management/sale-contract/sale-contract.component'
      ).then((m) => m.SaleContractComponent),
  },
  {
    path: 'schedule',
    title: 'جدول المواعيد',
    data: { roles: ['Admin', 'Sales', 'Support'] },
    loadComponent: () =>
      import('./pages/appointments/appointments.component').then(
        (m) => m.AppointmentsComponent,
      ),
  },
];
