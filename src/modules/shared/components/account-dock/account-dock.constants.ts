export const DOCK_TABS = [
  { label: 'Balances', value: 'balances' },
  { label: 'Positions', value: 'positions' },
  { label: 'Open Orders', value: 'openOrders' },
  { label: 'TWAP', value: 'twap' },
  { label: 'Trade History', value: 'tradeHistory' },
  { label: 'Funding History', value: 'fundingHistory' },
  { label: 'Order History', value: 'orderHistory' },
  { label: 'Interest History', value: 'interestHistory' },
  { label: 'Account Activity', value: 'accountActivity' },
] as const

export const DEFAULT_TAB = 'positions' as const

/** Rows per page for the dock's paginated history tabs. */
export const DOCK_HISTORY_PAGE_SIZE = 10

/** Skeleton placeholder rows per dock table while a snapshot/page loads. */
export const DOCK_SKELETON_ROWS = 6

/**
 * Column count per dock table — drives the loading skeleton's cell count so each
 * shimmer row matches its table's header. Must stay in sync with the matching
 * `--*-grid` template in `account-dock.module.css`.
 */
export const DOCK_TABLE_COLUMNS = {
  positions: 11,
  openOrders: 11,
  twapActive: 11,
  twapHistory: 10,
  twapFill: 8,
  tradeHistory: 9,
  orderHistory: 12,
  funding: 5,
  interest: 3,
  accountActivity: 10,
} as const
