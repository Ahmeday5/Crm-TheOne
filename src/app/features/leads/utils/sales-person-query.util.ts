import { CustomerListQuery } from '../../../shared/models';

/** Select value for "customers with no sales rep" (`Unassigned=true`). */
export const UNASSIGNED_SALES = '__unassigned__';

/**
 * Query params for the "موظف المبيعات" filter — one dropdown, so `SalesPersonId`
 * and `Unassigned` are never sent together (the server returns 400 for that).
 * Works for the customer lists and `Sales/Pipeline` alike.
 */
export function salesPersonQuery(
  selected: string | null,
): Pick<CustomerListQuery, 'SalesPersonId' | 'Unassigned'> {
  if (!selected) return {};
  return selected === UNASSIGNED_SALES ? { Unassigned: true } : { SalesPersonId: selected };
}
