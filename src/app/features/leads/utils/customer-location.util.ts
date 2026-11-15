import {
  CLEAR_LOCATION_ID,
  CustomerLocation,
  EGYPT_COUNTRY_ID,
} from '../../../shared/models/locations/location.model';

/**
 * Country + governorate rules for the add / edit customer forms. Pure — the
 * form component only wires controls to these.
 *
 *   - Country is optional: empty → the backend infers it from the phone.
 *   - Governorates exist for Egypt only; picking one implies Egypt.
 *   - Edit semantics: omitted/`null` keeps the stored value, `0` clears it.
 */

/** What the two form controls hold (`null` = nothing chosen). */
export interface LocationFormValue {
  countryId: number | null;
  governorateId: number | null;
}

/** The governorate picker applies to Egypt — and to "not chosen yet". */
export function governorateApplies(countryId: number | null): boolean {
  return countryId == null || countryId === EGYPT_COUNTRY_ID;
}

/**
 * Form state for an existing customer. An inferred country is NOT a choice —
 * it stays empty in the form (shown as a hint instead), so saving without
 * touching it never turns a guess into a stored value.
 */
export function locationFormValueOf(customer: CustomerLocation): LocationFormValue {
  return {
    countryId: customer.countryInferred ? null : customer.countryId ?? null,
    governorateId: customer.governorateId ?? null,
  };
}

/** `POST CreateCustomer` fields: send only what the user chose. */
export function createLocationPayload(value: LocationFormValue): Pick<LocationFormValue, 'countryId' | 'governorateId'> {
  const governorateId = governorateApplies(value.countryId) ? value.governorateId : null;
  return {
    countryId: governorateId != null ? EGYPT_COUNTRY_ID : value.countryId,
    governorateId,
  };
}

/**
 * `PUT updateCustomer` fields, diffed against the form's initial state:
 * unchanged → omitted (kept as stored), cleared → `0`, changed → the new id.
 * A non-Egypt country drops the governorate server-side, so it isn't sent.
 */
export function updateLocationPayload(
  initial: LocationFormValue,
  value: LocationFormValue,
): { countryId?: number; governorateId?: number } {
  const payload: { countryId?: number; governorateId?: number } = {};
  const country = diffId(initial.countryId, value.countryId);
  if (country !== undefined) payload.countryId = country;

  if (governorateApplies(value.countryId)) {
    const governorate = diffId(initial.governorateId, value.governorateId);
    if (governorate !== undefined) payload.governorateId = governorate;
    // A governorate always means Egypt (also when the country was only inferred).
    if (value.governorateId != null && value.countryId == null && initial.countryId !== EGYPT_COUNTRY_ID) {
      payload.countryId = EGYPT_COUNTRY_ID;
    }
  }
  return payload;
}

function diffId(initial: number | null, next: number | null): number | undefined {
  if (initial === next) return undefined;
  return next ?? CLEAR_LOCATION_ID;
}
