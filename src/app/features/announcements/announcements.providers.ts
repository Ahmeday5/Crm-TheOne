import { ENVIRONMENT_INITIALIZER, EnvironmentProviders, inject, makeEnvironmentProviders } from '@angular/core';
import { AnnouncementsStore } from './state/announcements.store';

/**
 * Boots announcements with the app: the banner list, hub listeners, day
 * rollover and the sidebar unread badge are live on every page — not only
 * once the board is opened. The store follows the session by itself.
 */
export function provideAnnouncements(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => inject(AnnouncementsStore).start(),
    },
  ]);
}
