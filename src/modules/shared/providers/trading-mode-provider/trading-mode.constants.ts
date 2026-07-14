import type { TradingMode } from './trading-mode.types'

/** localStorage key for the persisted global Trading Mode (one value per browser). */
export const TRADING_MODE_STORAGE_KEY = 'perps-dex-trading-mode'

/** Simple is the shipped trade experience, so it is the default. Pro layers the
 * orderbook / trades tape / full order ticket on top for users who ask for it. */
export const DEFAULT_TRADING_MODE: TradingMode = 'simple'

/** The selectable modes, in toggle order, with their human labels. */
export const TRADING_MODES: ReadonlyArray<{ readonly id: TradingMode; readonly label: string }> = [
  { id: 'simple', label: 'Simple' },
  { id: 'pro', label: 'Pro' },
] as const
