import type { MarginMode } from '@/modules/shared/domain'

/** Leverage floor for every market — venues clamp the ceiling per market. */
export const MIN_LEVERAGE = 1 as const

/** Fallback ceiling when a market omits `maxLeverage` (spot / legacy mock). */
export const FALLBACK_MAX_LEVERAGE = 50 as const

/** Notable integer leverage stops the slider notches snap to, below each
 *  market's ceiling (LOCKED DECISION b). The ceiling is always appended. */
export const LEVERAGE_NOTCHES = [1, 5, 10, 20] as const

/** Seed state when the user has no open position in the selected market. */
export const DEFAULT_LEVERAGE = 1 as const
export const DEFAULT_MARGIN_MODE: MarginMode = 'cross'

/** Cross/Isolated segmented-control options (label + value). */
export const MARGIN_MODE_OPTIONS = [
  { value: 'cross', label: 'Cross' },
  { value: 'isolated', label: 'Isolated' },
] as const
