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

/**
 * Interceptor order matters:
 *   1. cache    — short-circuit a cache hit before any other interceptor runs.
 *   2. loader   — show the global overlay for everything that actually hits
 *                 the network.
 *   3. auth     — attach the bearer token; refresh & retry on 401.
 *   4. error    — last so it sees post-refresh failures and normalizes
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
        authInterceptor,
        errorInterceptor,
      ]),
    ),
    provideAnimations(),
    provideWhatsApp(),
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
