import { Routes } from '@angular/router';

export const SALES_PHASES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/sales-phase/sales-phase.component').then(
        (m) => m.SalesPhaseComponent,
      ),
    children: [
      { path: '', redirectTo: 'price-offers', pathMatch: 'full' },
      {
        path: 'price-offers',
        title: 'عروض الاسعار',
        loadComponent: () =>
          import('./pages/price-offers/price-offers.component').then(
            (m) => m.PriceOffersComponent,
          ),
      },
      {
        path: 'contracts',
        title: 'العقود',
        loadComponent: () =>
          import('./pages/contracts/contracts.component').then(
            (m) => m.ContractsComponent,
          ),
      },
      {
        path: 'follow-ups',
        title: 'المتابعات',
        loadComponent: () =>
          import('./pages/follow-ups/follow-ups.component').then(
            (m) => m.FollowUpsComponent,
          ),
      },
    ],
  },
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
