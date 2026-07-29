import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';
import { SKIP_ERROR_TOAST } from '../http/http-context.tokens';
import { ApiError, ApiFieldErrors } from '../models/api-response.model';
import { API_ENDPOINTS } from '../constants/api-endpoints.const';
import { environment } from '../../../environments/environment';
import { LanguageService } from '../services/language.service';

/**
 * Normalizes every HTTP failure into an `ApiError` and (unless the caller
 * opted out) surfaces a toast. Components see `ApiError` in their error
 * branch — never the raw `HttpErrorResponse`.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const lang = inject(LanguageService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const isAr = lang.lang() === 'ar';
      const apiError = normalizeError(err, isAr);
      logError(req.method, req.url, err, apiError);

      const silent =
        req.context.get(SKIP_ERROR_TOAST) ||
        req.url.includes(API_ENDPOINTS.auth.refresh) ||
        err.status === 401;

      if (!silent) toast.error(apiError.message);

      return throwError(() => apiError);
    }),
  );
};

/** Unique-constraint / duplicate-key keywords — checked first since "constraint"
 *  alone is ambiguous and would otherwise be swallowed by FK_PATTERN below. */
const DUPLICATE_PATTERN = /duplicate|already exists|unique.*constraint|constraint.*unique|unique.*index|unique.*key/i;
/** Genuine FK-violation keywords in raw backend messages. */
const FK_PATTERN = /FOREIGN KEY|foreign key|REFERENCE constraint|conflicted with the reference|conflicted with the foreign key/i;

function friendlyMessage(raw: string, isAr: boolean): string | null {
  if (DUPLICATE_PATTERN.test(raw)) {
    return isAr
      ? 'هذا السجل موجود مسبقاً، تحقق من البريد الإلكتروني أو رقم الهاتف'
      : 'This record already exists. Check the email or phone number';
  }
  if (FK_PATTERN.test(raw)) {
    return isAr
      ? 'البيانات تحتوي على إشارة لعنصر غير موجود (ربط غير صحيح)'
      : 'The data references a record that does not exist (invalid relation)';
  }
  return null;
}

function normalizeError(err: HttpErrorResponse, isAr: boolean): ApiError {
  const status = err.status ?? 0;
  const body = err.error ?? {};

  const rawMessage: string =
    body?.message ||
    body?.error ||
    body?.detail ||
    body?.title ||
    '';

  const message =
    (rawMessage && friendlyMessage(rawMessage, isAr)) ||
    rawMessage ||
    statusMessage(status, err, isAr);

  const fieldErrors: ApiFieldErrors | undefined =
    body?.errors && typeof body.errors === 'object' && !Array.isArray(body.errors)
      ? body.errors
      : undefined;

  return {
    status,
    code: body?.code,
    message,
    fieldErrors,
    raw: body,
  };
}

function statusMessage(status: number, err: HttpErrorResponse, isAr: boolean): string {
  if (status === 0) {
    if (isAr) {
      return err.message?.includes('Failed to fetch')
        ? 'تعذّر الاتصال بالخادم (CORS أو الإنترنت). راجع الكونسل لتفاصيل أكثر.'
        : 'تعذّر الاتصال بالخادم، تحقق من اتصال الإنترنت';
    }
    return err.message?.includes('Failed to fetch')
      ? 'Could not reach the server (CORS or network). Check the console for details.'
      : 'Could not reach the server. Check your internet connection.';
  }

  const ar: Record<number, string> = {
    400: 'بيانات غير صحيحة',
    401: 'بيانات الدخول غير صحيحة',
    403: 'ليس لديك صلاحية للقيام بهذا الإجراء',
    404: 'المورد المطلوب غير موجود',
    409: 'تعارض في البيانات — السجل موجود مسبقاً',
    422: 'فشل التحقق من البيانات',
    429: 'طلبات كثيرة جداً، يرجى الانتظار قليلاً',
    500: 'خطأ في الخادم، يرجى المحاولة لاحقاً',
    502: 'الخدمة غير متاحة مؤقتاً',
    503: 'الخدمة غير متاحة مؤقتاً',
    504: 'انتهت مهلة الاتصال بالخادم',
  };

  const en: Record<number, string> = {
    400: 'Invalid request data',
    401: 'Invalid credentials',
    403: 'You do not have permission to perform this action',
    404: 'The requested resource was not found',
    409: 'Conflict — this record already exists',
    422: 'Validation failed',
    429: 'Too many requests. Please wait a moment.',
    500: 'Server error. Please try again later.',
    502: 'Service temporarily unavailable',
    503: 'Service temporarily unavailable',
    504: 'Request to server timed out',
  };

  const map = isAr ? ar : en;
  return map[status] ?? (isAr ? `خطأ غير متوقع (${status})` : `Unexpected error (${status})`);
}

function logError(
  method: string,
  url: string,
  err: HttpErrorResponse,
  apiError: ApiError,
): void {
  if (environment.production) {
    console.error(
      `[HTTP ${apiError.status}] ${method} ${url} — ${apiError.message}`,
    );
    return;
  }

  /* eslint-disable no-console */
  const groupLabel = `[HTTP ${apiError.status || 'NETWORK'}] ${method} ${url}`;
  if (typeof console.groupCollapsed === 'function') {
    console.groupCollapsed(groupLabel);
  } else {
    console.error(groupLabel);
  }
  console.error('Message :', apiError.message);
  console.error('Status  :', err.status, err.statusText || '(no statusText)');
  if (apiError.fieldErrors) console.error('Fields  :', apiError.fieldErrors);
  if (err.error) console.error('Body    :', err.error);
  console.error('Raw     :', err);
  if (err.status === 0) {
    console.warn(
      'Browser-level network/CORS failure. Likely causes:\n' +
        '  • Backend CORS rejected the origin\n' +
        '  • DNS / connection failure\n' +
        '  • Mixed-content (HTTPS page calling HTTP API)\n' +
        '  • Browser/extension blocked the request',
    );
  }
  if (typeof console.groupEnd === 'function') console.groupEnd();
  /* eslint-enable no-console */
}
