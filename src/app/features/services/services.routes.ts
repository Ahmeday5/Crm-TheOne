import { Routes } from '@angular/router';

/**
 * Services management now lives inside System settings
 * (`/settings/services`, see SETTINGS_ROUTES). The old top-level URL is kept
 * as a redirect so bookmarks and links keep working.
 */
export const SERVICES_ROUTES: Routes = [
  { path: 'services', redirectTo: 'settings/services', pathMatch: 'full' },
];
