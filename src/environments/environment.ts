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

  /** Storage keys — namespaced so multiple apps on the same domain don't collide. */
  tokenKey: 'crm_one_access_token',
  refreshTokenKey: 'crm_one_refresh_token',
  userKey: 'crm_one_user',
  deviceIdKey: 'crm_one_device_id',
} as const;
