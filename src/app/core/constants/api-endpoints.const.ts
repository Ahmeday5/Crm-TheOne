/**
 * Single source of truth for backend endpoints.
 * Paths are relative to `environment.apiUrl` — `ApiService` strips/adds the
 * leading slash so both forms work.
 */
export const API_ENDPOINTS = {
  auth: {
    login: 'Auth/login',
    refresh: 'Auth/refresh-token',
    logout: 'Auth/logout',
    me: 'Auth/me',
  },
  users: {
    list: 'Auth/GetAllUsers',
    byId: (id: string) => `Auth/GetUserbyId?userid=${encodeURIComponent(id)}`,
    add: 'Auth/AddApplicationUser',
    update: (id: string) => `Auth/update-user/${encodeURIComponent(id)}`,
    delete: (id: string) => `Auth/delete-user/${encodeURIComponent(id)}`,
  },
} as const;
