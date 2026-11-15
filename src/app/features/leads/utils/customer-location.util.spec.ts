import { EGYPT_COUNTRY_ID } from '../../../shared/models/locations/location.model';
import { flagUrl } from '../../../shared/components/country-flag/country-flag.component';
import {
  createLocationPayload,
  governorateApplies,
  locationFormValueOf,
  updateLocationPayload,
} from './customer-location.util';

const SAUDI = 4;
const CAIRO = 1;
const GIZA = 2;

describe('customer location rules', () => {
  it('offers governorates for Egypt and for "no country yet" only', () => {
    expect(governorateApplies(null)).toBeTrue();
    expect(governorateApplies(EGYPT_COUNTRY_ID)).toBeTrue();
    expect(governorateApplies(SAUDI)).toBeFalse();
  });

  it('never turns an inferred country into a form value', () => {
    expect(locationFormValueOf({ countryId: EGYPT_COUNTRY_ID, countryInferred: true, governorateId: null }))
      .toEqual({ countryId: null, governorateId: null });
    expect(locationFormValueOf({ countryId: SAUDI, countryInferred: false }))
      .toEqual({ countryId: SAUDI, governorateId: null });
  });

  describe('create', () => {
    it('leaves both empty so the backend infers the country from the phone', () => {
      expect(createLocationPayload({ countryId: null, governorateId: null })).toEqual({ countryId: null, governorateId: null });
    });

    it('a governorate implies Egypt', () => {
      expect(createLocationPayload({ countryId: null, governorateId: CAIRO }))
        .toEqual({ countryId: EGYPT_COUNTRY_ID, governorateId: CAIRO });
    });

    it('drops a governorate left over from a non-Egypt country', () => {
      expect(createLocationPayload({ countryId: SAUDI, governorateId: CAIRO })).toEqual({ countryId: SAUDI, governorateId: null });
    });
  });

  describe('edit', () => {
    const stored = { countryId: EGYPT_COUNTRY_ID, governorateId: CAIRO };

    it('omits untouched fields (the backend keeps them)', () => {
      expect(updateLocationPayload(stored, { ...stored })).toEqual({});
    });

    it('sends 0 for a cleared value, never null', () => {
      expect(updateLocationPayload(stored, { countryId: EGYPT_COUNTRY_ID, governorateId: null })).toEqual({ governorateId: 0 });
      expect(updateLocationPayload(stored, { countryId: null, governorateId: null })).toEqual({ countryId: 0, governorateId: 0 });
    });

    it('sends the new ids when changed', () => {
      expect(updateLocationPayload(stored, { countryId: EGYPT_COUNTRY_ID, governorateId: GIZA })).toEqual({ governorateId: GIZA });
    });

    it('does not send a governorate with a non-Egypt country (cleared server-side)', () => {
      expect(updateLocationPayload(stored, { countryId: SAUDI, governorateId: null })).toEqual({ countryId: SAUDI });
    });

    it('a governorate on an inferred-country customer also sets Egypt', () => {
      const inferred = { countryId: null, governorateId: null };
      expect(updateLocationPayload(inferred, { countryId: null, governorateId: GIZA }))
        .toEqual({ governorateId: GIZA, countryId: EGYPT_COUNTRY_ID });
    });
  });

  it('builds flag paths only for valid ISO-2 codes', () => {
    expect(flagUrl('EG')).toBe('assets/flags/eg.svg');
    expect(flagUrl('egy')).toBeNull();
    expect(flagUrl(null)).toBeNull();
  });
});
