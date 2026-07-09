import { Palette, CandlestickChart } from 'lucide-react'
import type { FC } from 'react'
import type { SettingsSection } from '../../providers/settings-provider'
import type { ThemeVariant } from '../../providers/theme-provider'
import { TRADING_MODES } from '../../providers/trading-mode-provider'
import type { TradingMode } from '../../providers/trading-mode-provider'
import type { SegmentedControlOption } from '../segmented-control'

export const SETTINGS_MODAL_TITLE = 'Settings'
export const SETTINGS_MODAL_ARIA_LABEL = 'Settings'

/** lucide icon per section. */
export const SETTINGS_SECTION_ICONS: Record<SettingsSection, FC<{ size?: number }>> = {
  appearance: Palette,
  trading: CandlestickChart,
}

export const THEME_FIELD_LABEL = 'Theme'
export const THEME_FIELD_DESCRIPTION =
  'Switch between the dark and light appearance. Saved on this device.'

/** Dark / Light segments for the Theme toggle. */
export const THEME_OPTIONS: ReadonlyArray<SegmentedControlOption<ThemeVariant>> = [
  { value: 'dark', label: 'Dark' },
  { value: 'white', label: 'Light' },
]

export const ACCENT_COLOR_FIELD_LABEL = 'Accent color'
export const ACCENT_COLOR_FIELD_DESCRIPTION =
  'Applied across the app and saved on this device.'

export const TRADING_MODE_FIELD_LABEL = 'Trading layout'
export const TRADING_MODE_FIELD_DESCRIPTION =
  'Simple condenses the funds, equity, and portfolio surfaces on every device, and strips the mobile trade screen to a bare chart, balance, and positions. Pro keeps the full terminal. Saved on this device.'

/** Pro / Simple segments for the Trading-layout toggle. */
export const TRADING_MODE_OPTIONS: ReadonlyArray<SegmentedControlOption<TradingMode>> =
  TRADING_MODES.map((mode) => ({ value: mode.id, label: mode.label }))
