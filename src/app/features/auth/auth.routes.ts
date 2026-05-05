import { Routes } from '@angular/router';
import { loggedInRedirectGuard } from '../../core/guards/logged-in.guard';

export const AUTH_ROUTES: Routes = [
  {
    path: 'auth',
    // Already logged in? Bounce out before AuthLayout renders.
    canActivate: [loggedInRedirectGuard],
    canActivateChild: [loggedInRedirectGuard],
    loadComponent: () =>
      import('../../core/layouts/auth-layout/auth-layout.component').then(
        (m) => m.AuthLayoutComponent,
      ),
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      {
        path: 'login',
        title: 'تسجيل الدخول',
        loadComponent: () =>
          import('./pages/login/login.component').then((m) => m.LoginComponent),
      },
    ],
  },
];
