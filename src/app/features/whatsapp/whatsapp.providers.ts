import { ENVIRONMENT_INITIALIZER, EnvironmentProviders, inject, makeEnvironmentProviders } from '@angular/core';
import { WhatsAppRealtimeService } from './services/whatsapp-realtime.service';
import { WhatsAppSessionStore } from './state/whatsapp-session.store';

/**
 * Starts the WhatsApp session at app boot: the SignalR hub connects as soon
 * as a WhatsApp role signs in (and stops on logout), and the sidebar unread
 * badge is live on every page — not only once the inbox is opened.
 * Both services decide for themselves whether the current user qualifies.
 */
export function provideWhatsApp(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        inject(WhatsAppRealtimeService);
        inject(WhatsAppSessionStore);
      },
    },
  ]);
}
