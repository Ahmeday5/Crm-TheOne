import { FormControl, Validators } from '@angular/forms';
import { ApiError } from '../../../core/models/api-response.model';
import {
  DUPLICATE_PHONE_ERROR,
  DUPLICATE_PHONE_MESSAGES,
  flagDuplicatePhone,
  isDuplicatePhoneError,
} from './duplicate-phone.util';

/** The exact message shape the backend returns for a duplicate phone. */
const SERVER_MESSAGE = "رقم التليفون '01012345678' مسجل بالفعل للعميل 'أحمد محمد'";

describe('duplicate-phone.util', () => {
  describe('isDuplicatePhoneError', () => {
    it('matches a 400 carrying the "مسجل بالفعل" message', () => {
      expect(isDuplicatePhoneError({ status: 400, message: SERVER_MESSAGE })).toBeTrue();
    });

    it('ignores other 400s (they go to the generic toast)', () => {
      const err: ApiError = { status: 400, message: 'الاسم مطلوب' };
      expect(isDuplicatePhoneError(err)).toBeFalse();
    });

    it('ignores the marker on non-400 statuses', () => {
      expect(isDuplicatePhoneError({ status: 409, message: SERVER_MESSAGE })).toBeFalse();
      expect(isDuplicatePhoneError({ status: 500, message: SERVER_MESSAGE })).toBeFalse();
    });

    it('is null-safe', () => {
      expect(isDuplicatePhoneError(null)).toBeFalse();
      expect(isDuplicatePhoneError(undefined)).toBeFalse();
    });
  });

  describe('flagDuplicatePhone', () => {
    it('pins the server message on the control and marks it touched', () => {
      const phone = new FormControl('01012345678', { nonNullable: true, validators: Validators.required });

      flagDuplicatePhone(phone, SERVER_MESSAGE);

      expect(phone.hasError(DUPLICATE_PHONE_ERROR)).toBeTrue();
      expect(phone.getError(DUPLICATE_PHONE_ERROR)).toBe(SERVER_MESSAGE);
      expect(phone.touched).toBeTrue();
      expect(phone.invalid).toBeTrue();
    });

    it('keeps the value the user typed', () => {
      const phone = new FormControl('01012345678', { nonNullable: true });
      flagDuplicatePhone(phone, SERVER_MESSAGE);
      expect(phone.value).toBe('01012345678');
    });

    it('clears as soon as the phone changes', () => {
      const phone = new FormControl('01012345678', { nonNullable: true, validators: Validators.required });
      flagDuplicatePhone(phone, SERVER_MESSAGE);

      phone.setValue('01099999999');

      expect(phone.hasError(DUPLICATE_PHONE_ERROR)).toBeFalse();
      expect(phone.valid).toBeTrue();
    });

    it('keeps existing validator errors alongside the duplicate error', () => {
      const phone = new FormControl('', { nonNullable: true, validators: Validators.required });
      flagDuplicatePhone(phone, SERVER_MESSAGE);
      expect(phone.hasError('required')).toBeTrue();
      expect(phone.hasError(DUPLICATE_PHONE_ERROR)).toBeTrue();
    });
  });

  it('the <app-form-error> resolver shows the server message as-is', () => {
    expect(DUPLICATE_PHONE_MESSAGES[DUPLICATE_PHONE_ERROR](SERVER_MESSAGE)).toBe(SERVER_MESSAGE);
  });
});
