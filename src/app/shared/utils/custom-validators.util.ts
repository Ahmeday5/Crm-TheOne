import { AbstractControl, ValidatorFn, ValidationErrors } from '@angular/forms';

/**
 * Validates a phone string: at least 7 digits, allows leading `+`,
 * spaces, dashes, and parentheses for international formats.
 *
 *   phone: ['', [Validators.required, phoneValidator()]]
 */
export function phoneValidator(): ValidatorFn {
  const pattern = /^\+?[\d\s\-()]{7,}$/;
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value ?? '').toString().trim();
    if (!value) return null;
    const digits = value.replace(/\D/g, '');
    if (digits.length < 7 || !pattern.test(value)) return { phone: true };
    return null;
  };
}

/**
 * Rejects values that are non-empty but consist only of whitespace.
 * Used alongside `Validators.required` so users can't bypass it with spaces.
 */
export function noWhitespaceValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (typeof value !== 'string' || value.length === 0) return null;
    return value.trim().length === 0 ? { whitespace: true } : null;
  };
}

/**
 * Requires the value (an array) to contain at least `min` items.
 * Pairs with bound signals through a hidden `FormControl<number[]>`.
 *
 *   serviceIds: [[] as number[], [minSelected(1)]]
 */
export function minSelected(min = 1): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    const length = Array.isArray(value) ? value.length : 0;
    return length >= min ? null : { atLeastOne: { required: min, actual: length } };
  };
}

/**
 * Group validator: the `end` control must be strictly after `start`.
 * Sets `{ endBeforeStart: true }` on the *end control* (so `<app-form-error>`
 * on that field shows it) and clears it again once the range is valid.
 * Empty values are left to `Validators.required`.
 *
 *   this.fb.group({ startDate: [''], endDate: [''] }, { validators: dateRangeValidator('startDate', 'endDate') })
 */
export function dateRangeValidator(startKey: string, endKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const start = group.get(startKey);
    const end = group.get(endKey);
    if (!start || !end) return null;

    const startMs = start.value ? new Date(start.value).getTime() : NaN;
    const endMs = end.value ? new Date(end.value).getTime() : NaN;
    const invalid = !Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs <= startMs;

    const { endBeforeStart: _, ...rest } = end.errors ?? {};
    if (invalid) {
      end.setErrors({ ...rest, endBeforeStart: true });
    } else if (end.hasError('endBeforeStart')) {
      end.setErrors(Object.keys(rest).length ? rest : null);
    }
    return invalid ? { endBeforeStart: true } : null;
  };
}
