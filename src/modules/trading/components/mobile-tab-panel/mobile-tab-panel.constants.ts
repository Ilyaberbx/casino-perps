import type { MobileTabOption } from './mobile-tab-panel.types'

export const MOBILE_TABS = [
  { label: 'Chart', value: 'chart' },
  { label: 'Order Book', value: 'orderbook' },
  { label: 'Trades', value: 'trades' },
] as const

export const DEFAULT_MOBILE_TAB = 'chart' as const

export const TAB_OPTIONS: ReadonlyArray<MobileTabOption> = MOBILE_TABS.map((tab) => ({
  value: tab.value,
  label: tab.label,
}))
