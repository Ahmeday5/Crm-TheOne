import { AbstractControl, ValidationErrors } from '@angular/forms';
import { TRANSLATIONS, resolveKey } from '../../core/i18n';
import { Lang } from '../../core/services/language.service';

/**
 * Maps a control's first failing validator into a localized message.
 *
 * Use via the `<app-form-error>` component or call directly:
 *   firstError(form.controls.email, 'البريد الإلكتروني', 'ar');
 *
 * Order matters — `required` is checked first so an empty field never gets
 * a "wrong format" message.
 *
 * Custom keys win over the built-ins:
 *   firstError(ctrl, 'كلمة المرور', 'ar', { mismatch: () => 'كلمتا المرور غير متطابقتين' })
 */
export function firstError(
  control: AbstractControl | null | undefined,
  label: string,
  lang: Lang,
  custom?: Record<string, (e: unknown) => string>,
): string | null {
  if (!control) return null;
  if (!(control.dirty || control.touched)) return null;
  if (!control.errors) return null;
  return resolveMessage(control.errors, label, lang, custom);
}

/** Same as `firstError` but ignores touched/dirty. Use after submit attempts. */
export function firstErrorAlways(
  control: AbstractControl | null | undefined,
  label: string,
  lang: Lang,
  custom?: Record<string, (e: unknown) => string>,
): string | null {
  if (!control?.errors) return null;
  return resolveMessage(control.errors, label, lang, custom);
}

function resolveMessage(
  errors: ValidationErrors,
  label: string,
  lang: Lang,
  custom?: Record<string, (e: unknown) => string>,
): string {
  if (custom) {
    for (const key of Object.keys(custom)) {
      if (errors[key] !== undefined) return custom[key](errors[key]);
    }
  }

  if (errors['required'] !== undefined) return msg('required', { label }, lang);
  if (errors['email'] !== undefined) return msg('email', { label }, lang);
  if (errors['minlength']) {
    return msg('minLength', { label, n: errors['minlength'].requiredLength }, lang);
  }
  if (errors['maxlength']) {
    return msg('maxLength', { label, n: errors['maxlength'].requiredLength }, lang);
  }
  if (errors['min'] !== undefined) {
    return msg('min', { label, n: errors['min'].min }, lang);
  }
  if (errors['max'] !== undefined) {
    return msg('max', { label, n: errors['max'].max }, lang);
  }
  if (errors['pattern'] !== undefined) return msg('pattern', { label }, lang);
  if (errors['mismatch'] !== undefined) return msg('mismatch', { label }, lang);

  // Unknown validator — fall back to a string error if the validator gave one.
  const firstKey = Object.keys(errors)[0];
  const value = errors[firstKey];
  if (typeof value === 'string') return value;
  return msg('invalid', { label }, lang);
}

function msg(
  key: string,
  vars: Record<string, string | number>,
  lang: Lang,
): string {
  const template = resolveKey(TRANSLATIONS[lang], `common.validation.${key}`);
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    template,
  );
}
