import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

/** Required + not whitespace-only + max length — the standard text field rule. */
export function textRules(max: number, required = true): ValidatorFn[] {
  const rules = [Validators.maxLength(max)];
  return required ? [Validators.required, Validators.pattern(/\S/), ...rules] : rules;
}

/** A `string[]` control needs at least `min` non-blank entries. */
export function minLines(min: number): ValidatorFn {
  return (control: AbstractControl<string[] | null>): ValidationErrors | null => {
    const filled = (control.value ?? []).filter((s) => s?.trim()).length;
    return filled < min ? { minLines: { min, actual: filled } } : null;
  };
}
