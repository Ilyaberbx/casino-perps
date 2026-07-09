import type { TradingMode } from './trading-mode.types'

/** localStorage key for the persisted global Trading Mode (one value per browser). */
export const TRADING_MODE_STORAGE_KEY = 'perps-dex-trading-mode'

/** Pro (full, detailed surfaces) is the shipped look, so it stays the default. */
export const DEFAULT_TRADING_MODE: TradingMode = 'pro'

/** The selectable modes, in toggle order, with their human labels. */
export const TRADING_MODES: ReadonlyArray<{ readonly id: TradingMode; readonly label: string }> = [
  { id: 'pro', label: 'Pro' },
  { id: 'simple', label: 'Simple' },
] as const
