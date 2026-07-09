import type { TabBarTab } from '@/modules/shared/components/tab-bar'
import type { TwapSubTab } from './twap-panel.types'

/** Re-derive `now` for the Active rows' Time Remaining countdown this often. */
export const TWAP_TICK_INTERVAL_MS = 1_000

export const TWAP_SUB_TABS: ReadonlyArray<TabBarTab<TwapSubTab>> = [
  { value: 'active', label: 'Active' },
  { value: 'history', label: 'History' },
  { value: 'fillHistory', label: 'Fill History' },
]

export const DEFAULT_TWAP_SUB_TAB: TwapSubTab = 'active'
