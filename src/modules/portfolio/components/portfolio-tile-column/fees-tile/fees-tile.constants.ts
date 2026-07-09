import type { FeesMarket } from './fees-tile.types'

/** Perps / Spot options for the Simple-mode fees selector (#274). */
export const FEES_MARKET_OPTIONS: ReadonlyArray<{ value: FeesMarket; label: string }> = [
  { value: 'perps', label: 'Perps' },
  { value: 'spot', label: 'Spot' },
] as const

/** Default market shown when the compact selector first renders. */
export const DEFAULT_FEES_MARKET: FeesMarket = 'perps'
