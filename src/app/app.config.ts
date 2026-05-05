import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { cacheInterceptor } from './core/interceptors/cache.interceptor';
import { loaderInterceptor } from './core/interceptors/loader.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

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
  ],
};
