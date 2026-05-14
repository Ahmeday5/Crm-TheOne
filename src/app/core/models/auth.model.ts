/** Backend roles — keep in sync with `roles.const.ts`. */
export type UserRole =
  | 'Admin'
  | 'Developer'
  | 'Sales'
  | 'Marketing'
  | 'Support';

/** Body of POST /Auth/login */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Body of POST /Auth/refresh-token */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Inner `data` payload for both login and refresh-token endpoints.
 * The outer `{ statusCode, message, data }` envelope is unwrapped by `ApiService`.
 */
export interface AuthResponseData {
  isSuccess: boolean;
  message: string;
  accessToken: string;
  refreshToken: string;
  role: UserRole;
  userId: string;
  email: string;
}

/** What the rest of the app reads from `AuthService.currentUser()`. */
export interface User {
  userId: string;
  email: string;
  role: UserRole;
  fullName?: string | null;
  phone?: string | null;
}

/** Tokens returned by login / refresh — consumed by the auth interceptor. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
