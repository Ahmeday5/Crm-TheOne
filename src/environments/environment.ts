/**
 * Production environment.
 *
 * Override per-build via `angular.json` -> projects.<name>.architect.build.configurations.<env>.fileReplacements
 * if/when a `environment.development.ts` is added.
 */
export const environment = {
  production: true,

  /** Backend API base — endpoints in `api-endpoints.const.ts` are relative to this. */
  apiUrl: 'https://crmproject.runasp.net/api',

  /** WhatsApp gateway base — the sessions module talks to a separate service. */
  whatsappApiUrl: 'https://whatsapp.theonesystemco.com/api/v1',

  /**
   * WhatsApp gateway API token. This host authenticates with its own token —
   * NOT the CRM bearer — so requests carry it explicitly and opt out of the
   * CRM auth interceptor.
   */
  whatsappApiToken: 'wavex_X2GO4pnn_8coxpiWnGecdB1N4eEghO2V7ojkOOWnPPvwX0TBooeyl1nKW',

  /**
   * Firebase Cloud Messaging web config — drives real-time push notifications.
   *
   * Fill these from Firebase Console → Project settings → General (web app
   * config) + Cloud Messaging → Web Push certificates (`vapidKey`). The SAME
   * values (except `vapidKey`) must also be copied into
   * `public/firebase-messaging-sw.js`. While `apiKey`/`vapidKey` are empty the
   * push integration stays dormant and the app falls back to polling.
   */
  firebase: {
    apiKey: 'AIzaSyD3jrSMr364-FbMcn1uT1fEcrp6NJZJ_Ik',
    authDomain: 'theonecrm-c6fc5.firebaseapp.com',
    projectId: 'theonecrm-c6fc5',
    storageBucket: 'theonecrm-c6fc5.firebasestorage.app',
    messagingSenderId: '577955000613',
    appId: '1:577955000613:web:54dca1c7b8f6d278e96acc',
    vapidKey:
      'BMd0Ttui0v0R5Ksp55y2hBzlex0VdbWeHpdrKQxd4Y9tTe9wsC1aEGH91zfqJPr6CrLGt9lCC0C4eDP4dbXz5sc',
  },

  /** Storage keys — namespaced so multiple apps on the same domain don't collide. */
  tokenKey: 'crm_one_access_token',
  refreshTokenKey: 'crm_one_refresh_token',
  userKey: 'crm_one_user',
  deviceIdKey: 'crm_one_device_id',
} as const;
