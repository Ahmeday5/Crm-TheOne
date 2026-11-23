import { ApplicationConfig, isDevMode, provideZoneChangeDetection } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { cacheInterceptor } from './core/interceptors/cache.interceptor';
import { loaderInterceptor } from './core/interceptors/loader.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { provideAnnouncements } from './features/announcements';
import { provideAttendance } from './features/attendance';
import { provideWhatsApp } from './features/whatsapp/whatsapp.providers';
import { providePayments } from './features/payments/payments.providers';
import { provideClientRequests } from './features/client-requests/client-requests.providers';
import { provideSalesFlows } from './features/salesPhases/salesPhases.providers';
import { vaultTokenInterceptor } from './features/vault/data/vault-token.interceptor';
import { portalSessionInterceptor } from './features/client-portal/data/portal-session.interceptor';

/**
 * Interceptor order matters:
 *   1. cache    — short-circuit a cache hit before any other interceptor runs.
 *   2. loader   — show the global overlay for everything that actually hits
 *                 the network.
 *   3. portal   — `ClientPortal/*` gets the client's magic-link JWT (and
 *                 skips the staff token); silent re-exchange on expiry.
 *   4. auth     — attach the bearer token; refresh & retry on 401.
 *   5. vault    — attach `X-Vault-Token` to vault calls (inert while mocked).
 *   6. error    — last so it sees post-refresh failures and normalizes
 *                 every error into `ApiError`.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
        anchorScrolling: 'enabled',
      }),
    ),
    provideHttpClient(
      withInterceptors([
        cacheInterceptor,
        loaderInterceptor,
        portalSessionInterceptor,
        authInterceptor,
        vaultTokenInterceptor,
        errorInterceptor,
      ]),
    ),
    provideAnimations(),
    provideWhatsApp(),
    providePayments(),
    provideClientRequests(),
    // Customer marked as Buyer anywhere → create-contract dialog opens for them.
    provideSalesFlows(),
    // Banner, hub listeners, header time clock and sidebar badges on every page.
    provideAnnouncements(),
    provideAttendance(),
    // PWA — production builds only; registers once the app is idle so it
    // never competes with the first render. API calls are never cached
    // (ngsw-config.json has no dataGroups).
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
