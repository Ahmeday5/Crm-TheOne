import { AbstractControl } from '@angular/forms';
import { ApiError } from '../../../core/models/api-response.model';

/** Validation key set on the phone control when the server reports a duplicate. */
export const DUPLICATE_PHONE_ERROR = 'duplicate';

/** Marker in the server's Arabic message: "رقم التليفون '…' مسجل بالفعل للعميل '…'". */
const DUPLICATE_MARKER = 'مسجل بالفعل';

/** `400` from CreateCustomer / updateCustomer saying the phone belongs to another customer. */
export function isDuplicatePhoneError(err: ApiError | null | undefined): boolean {
  return err?.status === 400 && !!err.message?.includes(DUPLICATE_MARKER);
}

/**
 * Pins the server message on the phone control. Angular re-runs the
 * validators on the next value change, which drops this error by itself, so
 * editing the number clears it with no extra wiring.
 */
export function flagDuplicatePhone(control: AbstractControl, message: string): void {
  control.setErrors({ ...(control.errors ?? {}), [DUPLICATE_PHONE_ERROR]: message });
  control.markAsTouched();
}

/** `[custom]` resolver for `<app-form-error>`: show the server message as-is. */
export const DUPLICATE_PHONE_MESSAGES: Record<string, (e: unknown) => string> = {
  [DUPLICATE_PHONE_ERROR]: (e) => String(e),
};
