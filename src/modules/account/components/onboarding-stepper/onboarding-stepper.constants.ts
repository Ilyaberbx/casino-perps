import { TRADING_MODES } from '@/modules/shared/providers/trading-mode-provider'
import type { ThemeVariant } from '@/modules/shared/providers/theme-provider'
import type { TradingMode } from '@/modules/shared/providers/trading-mode-provider'

export const RESEND_LOCKOUT_SECONDS = 60
export const HANDLE_DEBOUNCE_MS = 300
export const TOTAL_STEPS = 5

/** Theme segments for the Personalize step (the app theme is dark / white). */
export const THEME_OPTIONS: ReadonlyArray<{ readonly value: ThemeVariant; readonly label: string }> = [
  { value: 'dark', label: 'Dark' },
  { value: 'white', label: 'Light' },
] as const

/** Pro / Simple segments for the Personalize step's mobile-layout picker. */
export const TRADING_MODE_OPTIONS: ReadonlyArray<{ readonly value: TradingMode; readonly label: string }> =
  TRADING_MODES.map((mode) => ({ value: mode.id, label: mode.label }))
