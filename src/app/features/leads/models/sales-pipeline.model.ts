import { CustomerStatusEnum } from '../../../shared/models';

/** Values of the backend `SalesPipelineSort` enum. */
export type SalesPipelineSort = 'Newest' | 'Oldest' | 'StageAge' | 'NextFollowUp';

/**
 * Query for `GET /Sales/Pipeline`.
 *
 *   - `Search` / `SourceId` / `ServiceId` / `SalesPersonId` narrow the board.
 *   - `OverdueOnly` keeps only customers whose next follow-up is in the past.
 *   - `Sort` orders the cards inside every column.
 *   - `PerColumn` is how many cards each column returns.
 *   - `Status` + `Skip` load the next page of one column ("load more").
 *   - `StaleDays` is how many days in one stage make a card "stale".
 */
export interface SalesPipelineQuery {
  Search?: string;
  SourceId?: number;
  ServiceId?: number;
  SalesPersonId?: string;
  OverdueOnly?: boolean;
  Sort?: SalesPipelineSort;
  PerColumn?: number;
  Status?: number;
  Skip?: number;
  StaleDays?: number;
}

export interface SalesPipelineStats {
  totalCustomers: number;
  inProgress: number;
  buyers: number;
  notBuyers: number;
  /** Percentage: buyers ÷ (buyers + notBuyers) × 100. */
  closeRate: number;
}

export interface SalesPipelineCard {
  id: number;
  fullName: string;
  phone: string | null;
  statusId: number;
  status: CustomerStatusEnum;
  createdAt: string;
  stageEnteredAt: string | null;
  daysInStage: number;
  isStale: boolean;
  nextFollowUpDate: string | null;
  isFollowUpOverdue: boolean;
  source: string | null;
  services: { id: number; name: string }[];
  salesPersonId: string | null;
  salesPersonName: string | null;
  notBuyingReason: string | null;
}

export interface SalesPipelineColumn {
  statusId: number;
  status: CustomerStatusEnum;
  /** Total customers in this stage (not just the loaded cards). */
  count: number;
  hasMore: boolean;
  items: SalesPipelineCard[];
}

export interface SalesPipeline {
  stats: SalesPipelineStats;
  overdueFollowUps: number;
  columns: SalesPipelineColumn[];
}
