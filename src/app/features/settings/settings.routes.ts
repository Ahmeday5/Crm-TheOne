import { Routes } from '@angular/router';

/**
 * Settings is Admin-only. The shell-level role guard catches the URL segment
 * `settings` (defined in `ROUTE_ROLE_MAP`) but we add `data.roles` here too
 * so the rule is co-located with the route definition.
 */
export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    data: { roles: ['Admin'] },
    loadComponent: () =>
      import('./settings.component').then((m) => m.SettingsComponent),
    children: [
      { path: '', redirectTo: 'users', pathMatch: 'full' },
      {
        path: 'users',
        title: 'إدارة المستخدمين',
        loadComponent: () =>
          import('./pages/user-management/user-management.component').then(
            (m) => m.UserManagementComponent,
          ),
      },
      {
        path: 'roles',
        title: 'الأدوار والصلاحيات',
        loadComponent: () =>
          import('./pages/roles-permissions/roles-permissions.component').then(
            (m) => m.RolesPermissionsComponent,
          ),
        data: { titleKey: 'settings.tabs.roles', icon: 'fa-solid fa-shield-halved' },
      },
      {
        path: 'system',
        title: 'إعدادات النظام',
        loadComponent: () =>
          import('./pages/company-settings/company-settings.component').then(
            (m) => m.CompanySettingsComponent,
          ),
        data: { titleKey: 'settings.tabs.system', icon: 'fa-solid fa-gear' },
      },
      {
        path: 'activity',
        title: 'سجل الأنشطة',
        loadComponent: () =>
          import('./pages/placeholder/settings-placeholder.component').then(
            (m) => m.SettingsPlaceholderComponent,
          ),
        data: { titleKey: 'settings.tabs.activity', icon: 'fa-solid fa-bolt' },
      },
      {
        path: 'audit',
        title: 'سجل التدقيق',
        loadComponent: () =>
          import('./pages/placeholder/settings-placeholder.component').then(
            (m) => m.SettingsPlaceholderComponent,
          ),
        data: { titleKey: 'settings.tabs.audit', icon: 'fa-solid fa-file-magnifying-glass' },
      },
      {
        path: 'notifications',
        title: 'الإشعارات والتنبيهات',
        loadComponent: () =>
          import('./pages/placeholder/settings-placeholder.component').then(
            (m) => m.SettingsPlaceholderComponent,
          ),
        data: { titleKey: 'settings.tabs.notifications', icon: 'fa-solid fa-bell' },
      },
      {
        path: 'backup',
        title: 'النسخ الاحتياطي والبيانات',
        loadComponent: () =>
          import('./pages/placeholder/settings-placeholder.component').then(
            (m) => m.SettingsPlaceholderComponent,
          ),
        data: { titleKey: 'settings.tabs.backup', icon: 'fa-solid fa-database' },
      },
    ],
  },
];
