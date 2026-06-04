import { HttpContext, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import {
  withInlineHandling,
  withSkipAuth,
} from '../../../core/http/http-context.tokens';

/**
 * Shared request options for every WhatsApp-gateway call.
 *
 * The gateway authenticates with its OWN token (`environment.whatsappApiToken`),
 * not the CRM bearer — so we:
 *   1. attach `Authorization: Bearer <whatsapp token>` explicitly, and
 *   2. set `SKIP_AUTH` so the CRM `authInterceptor` doesn't overwrite it.
 *
 * `withInlineHandling()` also silences the global loader + error toast so each
 * feature store owns its own loading / error / success feedback.
 */
export function whatsappHeaders(): HttpHeaders {
  return new HttpHeaders({
    Authorization: `Bearer ${environment.whatsappApiToken}`,
  });
}

export function whatsappContext(): HttpContext {
  return withSkipAuth(withInlineHandling());
}

export function whatsappOptions(): {
  headers: HttpHeaders;
  context: HttpContext;
} {
  return { headers: whatsappHeaders(), context: whatsappContext() };
}
