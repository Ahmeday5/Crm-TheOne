import { Routes } from '@angular/router';

export const SALES_PHASES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/sales-phase/sales-phase.component').then(
        (m) => m.SalesPhaseComponent,
      ),
    children: [
      { path: '', redirectTo: 'line', pathMatch: 'full' },
      {
        path: 'line',
        title: 'خط المبيعات',
        loadComponent: () =>
          import('./pages/sales-line/sales-line.component').then(
            (m) => m.SalesLineComponent,
          ),
      },
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
    path: 'add-price-offer',
    title: 'إضافة عرض السعر',
    loadComponent: () =>
      import('./pages/price-offers/add-price-offer/add-price-offer.component').then(
        (m) => m.AddPriceOfferComponent,
      ),
  },
];
