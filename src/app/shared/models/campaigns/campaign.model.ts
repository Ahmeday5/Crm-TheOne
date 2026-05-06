import {
  CampaignStatus,
  CampaignStatusCode,
  GenderCode,
  GenderName,
} from './campaign-enums';

/**
 * Row shape returned by `GET /Campaigns/GetAllCampaigns`.
 *
 * The list endpoint projects a subset of the detail response — `spent`,
 * `remaining`, `spentPercentage`, `daysElapsed`, `daysRemaining`, and the
 * `appUser*` block only show up in the detail endpoint. They're typed as
 * optional so the same model serves both cases without `as any` casts.
 */
export interface Campaign {
  id: number;
  name: string;
  description: string;
  status: CampaignStatus;
  channelSourceId: number;
  channelSource: string;
  durationDays: number;
  budget: number;
  dailyBudget: number;
  startDate: string;
  endDate: string;
  minAge: number;
  maxAge: number;
  gender: GenderName;
  countries: number[];

  // Detail-only fields — populated by `GET /Campaigns/{id}/getCampaignById`.
  spent?: number;
  remaining?: number;
  spentPercentage?: number;
  daysElapsed?: number;
  daysRemaining?: number;
  appUserId?: string | null;
  appUserName?: string | null;
  createdAt?: string;
}

/** Detail shape — same surface as `Campaign`, all optional fields populated. */
export type CampaignDetails = Campaign;

/**
 * Body for `POST /Campaigns`.
 *
 * `status` is optional — when omitted the backend defaults to `Active`.
 * `endDate` is sent alongside `startDate`/`durationDays` for backends that
 * accept it; harmless on those that don't.
 */
export interface CreateCampaignRequest {
  name: string;
  description: string;
  channelSourceId: number;
  budget: number;
  durationDays: number;
  /** ISO date-time. */
  startDate: string;
  /** ISO date-time. Optional — derivable from `startDate + durationDays`. */
  endDate?: string;
  gender: GenderCode;
  minAge: number;
  maxAge: number;
  countries: number[];
  /** Numeric status code; omit to let the backend default to Active. */
  status?: CampaignStatusCode;
}

/** Query params for `GET /Campaigns/GetAllCampaigns`. */
export interface CampaignListQuery {
  pageIndex?: number;
  pageSize?: number;
  channelSourceId?: number;
  /** Numeric status code (1..4). */
  status?: CampaignStatusCode | number;
  search?: string;
}

/** Lightweight item returned by `GET /Campaigns/dropdown`. */
export interface CampaignDropdownItem {
  id: number;
  name: string;
}

/** Aggregate KPIs returned by `GET /Campaigns/Statistics-Dashboard`. */
export interface CampaignsStatistics {
  totalBudget: number;
  totalSpent: number;
  activeCampaigns: number;
  totalConversions: number;
  // The endpoint may evolve; keep it forgiving so new fields don't break the
  // build. Consumers should fall back to client-side aggregation when a field
  // is missing.
  [key: string]: number | string | null | undefined;
}
