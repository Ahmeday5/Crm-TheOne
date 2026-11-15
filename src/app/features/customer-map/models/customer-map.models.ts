/** Query of `GET /Customers/map` — every filter optional. */
export interface CustomerMapQuery {
  /** 1 جديد, 3 تفاوض, 4 مشتري, 5 غير مشتري (`GET /Customers/statuses`). */
  customerStatusId?: number | null;
  sourceId?: number | null;
  campaignId?: number | null;
  serviceId?: number | null;
  /** `0` = Egyptian customers without a governorate. */
  governorateId?: number | null;
  /** Admin only — ignored for Sales. */
  salesPersonId?: string | null;
  /** Customer creation date, `yyyy-MM-dd`, inclusive. */
  from?: string | null;
  to?: string | null;
}
