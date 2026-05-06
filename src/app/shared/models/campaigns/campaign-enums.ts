/**
 * Backend campaign status — strings the API returns and accepts.
 * Source of truth: TheOneCRM.Domain enum.
 *
 *   Active    → 1
 *   NotActive → 2
 *   Completed → 3
 *   Cancelled → 4
 */
export type CampaignStatus = 'Active' | 'NotActive' | 'Completed' | 'Cancelled';

/** Numeric form expected by query params (e.g. `?Status=1`) and create body. */
export enum CampaignStatusCode {
  Active = 1,
  NotActive = 2,
  Completed = 3,
  Cancelled = 4,
}

export const CAMPAIGN_STATUSES: ReadonlyArray<CampaignStatus> = [
  'Active',
  'NotActive',
  'Completed',
  'Cancelled',
];

export const CAMPAIGN_STATUS_CODE: Record<CampaignStatus, CampaignStatusCode> = {
  Active: CampaignStatusCode.Active,
  NotActive: CampaignStatusCode.NotActive,
  Completed: CampaignStatusCode.Completed,
  Cancelled: CampaignStatusCode.Cancelled,
};

/**
 * Backend gender enum — sent as 0/1/2 on create. The detail/list endpoints
 * project it back as a string.
 */
export enum GenderCode {
  All = 0,
  Male = 1,
  Female = 2,
}

/** String form returned by GET endpoints. */
export type GenderName = 'All' | 'Male' | 'Female';

export const GENDER_CODE_TO_NAME: Record<GenderCode, GenderName> = {
  [GenderCode.All]: 'All',
  [GenderCode.Male]: 'Male',
  [GenderCode.Female]: 'Female',
};

export const GENDER_NAME_TO_CODE: Record<GenderName, GenderCode> = {
  All: GenderCode.All,
  Male: GenderCode.Male,
  Female: GenderCode.Female,
};
