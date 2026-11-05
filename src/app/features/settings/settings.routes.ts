import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { UserRole } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth.service';

const ADMIN: UserRole[] = ['Admin'];
/** Services master data is also maintained by Marketing. */
export const SETTINGS_SERVICES_ROLES: UserRole[] = ['Admin', 'Marketing'];

/**
 * System settings.
 *
 * Every tab carries its own `data.roles` (checked by the shell's role guard on
 * each child): everything is Admin-only except "Services management", which
 * Marketing also maintains. The landing tab therefore depends on the role.
 */
export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    data: { roles: SETTINGS_SERVICES_ROLES },
    loadComponent: () =>
      import('./settings.component').then((m) => m.SettingsComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: () => (inject(AuthService).currentRole() === 'Admin' ? 'users' : 'services'),
      },
      {
        path: 'users',
        title: 'إدارة المستخدمين',
        data: { roles: ADMIN },
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
        data: { roles: ADMIN, titleKey: 'settings.tabs.roles', icon: 'fa-solid fa-shield-halved' },
      },
      {
        path: 'system',
        title: 'إعدادات النظام',
        loadComponent: () =>
          import('./pages/company-settings/company-settings.component').then(
            (m) => m.CompanySettingsComponent,
          ),
        data: { roles: ADMIN, titleKey: 'settings.tabs.system', icon: 'fa-solid fa-gear' },
      },
      {
        // Moved here from the top-level `/services` page (old URL redirects).
        path: 'services',
        title: 'إدارة الخدمات',
        data: { roles: SETTINGS_SERVICES_ROLES, titleKey: 'settings.tabs.services', icon: 'fa-solid fa-screwdriver-wrench' },
        loadComponent: () =>
          import('../services/pages/services-list/services-list.component').then(
            (m) => m.ServicesListComponent,
          ),
      },
      // WhatsApp numbers moved next to the inbox; keep old bookmarks working.
      { path: 'whatsapp', redirectTo: '/whatsapp/numbers', pathMatch: 'full' },
      {
        path: 'activity',
        title: 'سجل الأنشطة',
        loadComponent: () =>
          import('./pages/placeholder/settings-placeholder.component').then(
            (m) => m.SettingsPlaceholderComponent,
          ),
        data: { roles: ADMIN, titleKey: 'settings.tabs.activity', icon: 'fa-solid fa-bolt' },
      },
      {
        path: 'audit',
        title: 'سجل التدقيق',
        loadComponent: () =>
          import('./pages/placeholder/settings-placeholder.component').then(
            (m) => m.SettingsPlaceholderComponent,
          ),
        data: { roles: ADMIN, titleKey: 'settings.tabs.audit', icon: 'fa-solid fa-file-magnifying-glass' },
      },
      {
        path: 'notifications',
        title: 'الإشعارات والتنبيهات',
        loadComponent: () =>
          import('./pages/placeholder/settings-placeholder.component').then(
            (m) => m.SettingsPlaceholderComponent,
          ),
        data: { roles: ADMIN, titleKey: 'settings.tabs.notifications', icon: 'fa-solid fa-bell' },
      },
      {
        path: 'backup',
        title: 'النسخ الاحتياطي والبيانات',
        loadComponent: () =>
          import('./pages/placeholder/settings-placeholder.component').then(
            (m) => m.SettingsPlaceholderComponent,
          ),
        data: { roles: ADMIN, titleKey: 'settings.tabs.backup', icon: 'fa-solid fa-database' },
      },
    ],
  },
];
