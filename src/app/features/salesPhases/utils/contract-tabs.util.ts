import { ContractListQuery, ContractStatistics } from '../../../shared/models';

/**
 * The contracts-management tabs and how each maps onto the server.
 *
 * One table drives both sides of a tab — the `GetContracts` filter and the
 * `ContractStatistics` field shown as its badge — so a tab's badge always
 * equals the `count` the server reports for that tab's list.
 */
export type ContractTab = 'all' | 'active' | 'expiring' | 'expired' | 'cancelled';

type TabFilter = Pick<ContractListQuery, 'status' | 'expiringSoon'>;

interface ContractTabDef {
  readonly key: ContractTab;
  readonly icon: string;
  readonly filter: TabFilter;
  readonly statKey: keyof ContractStatistics;
}

export const CONTRACT_TABS: ReadonlyArray<ContractTabDef> = [
  { key: 'all', icon: 'fa-solid fa-folder-open', filter: {}, statKey: 'totalContracts' },
  { key: 'active', icon: 'fa-solid fa-file-circle-check', filter: { status: 'Active' }, statKey: 'activeContracts' },
  { key: 'expiring', icon: 'fa-solid fa-circle-exclamation', filter: { expiringSoon: true }, statKey: 'expiringSoonContracts' },
  { key: 'expired', icon: 'fa-solid fa-file-circle-xmark', filter: { status: 'Expired' }, statKey: 'expiredContracts' },
  { key: 'cancelled', icon: 'fa-solid fa-ban', filter: { status: 'Cancelled' }, statKey: 'cancelledContracts' },
];

const BY_KEY = new Map(CONTRACT_TABS.map((t) => [t.key, t]));

/** Server filter params for a tab (`all` → none). */
export function contractTabFilter(tab: ContractTab): TabFilter {
  return BY_KEY.get(tab)?.filter ?? {};
}

/** The tab's badge number; null while statistics are not loaded. */
export function contractTabCount(tab: ContractTab, stats: ContractStatistics | null): number | null {
  const def = BY_KEY.get(tab);
  return stats && def ? stats[def.statKey] : null;
}
