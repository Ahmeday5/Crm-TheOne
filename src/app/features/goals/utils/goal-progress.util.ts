import { ValidatorFn, Validators } from '@angular/forms';
import { noWhitespaceValidator } from '../../../shared/utils/custom-validators.util';

/** Server limit for `Details` on a logged amount. */
export const PROGRESS_DETAILS_MAX = 1000;

/** `Value` must be a whole number ≥ 1. */
export const progressAmountValidators: ValidatorFn[] = [
  Validators.required,
  Validators.min(1),
  Validators.pattern(/^\d+$/),
];

/** `Details` is required, non-blank and ≤ 1000 chars. */
export const progressDetailsValidators: ValidatorFn[] = [
  Validators.required,
  noWhitespaceValidator(),
  Validators.maxLength(PROGRESS_DETAILS_MAX),
];

/** Commission threshold: optional whole number 1–100. */
export const commissionThresholdValidators: ValidatorFn[] = [
  Validators.min(1),
  Validators.max(100),
  Validators.pattern(/^\d+$/),
];

/** Clamped 0–100 achievement percentage for progress bars. */
export function achievementPercent(current: number, target: number): number {
  if (!target) return 0;
  return Math.min(100, Math.max(0, Math.round((current / target) * 100)));
}
