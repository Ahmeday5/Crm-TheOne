/**
 * Standard envelope returned by the backend:
 *   { statusCode, message, data: <payload> }
 *
 * `ApiService.unwrap()` peels this off so call-sites only ever see the payload.
 */
export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}

/** Map of field-name → array of validation messages. */
export type ApiFieldErrors = Record<string, string[]>;

/**
 * Normalized error shape the rest of the app sees in `.error` branches.
 * Built by `errorInterceptor` from any backend / network failure.
 */
export interface ApiError {
  status: number;
  code?: string;
  message: string;
  fieldErrors?: ApiFieldErrors;
  raw?: unknown;
}
