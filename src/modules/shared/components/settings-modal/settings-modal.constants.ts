import { Palette } from 'lucide-react'
import type { FC } from 'react'
import type { SettingsSection } from '../../providers/settings-provider'
import type { ThemeVariant } from '../../providers/theme-provider'
import type { SegmentedControlOption } from '../segmented-control'

export const SETTINGS_MODAL_TITLE = 'Settings'
export const SETTINGS_MODAL_ARIA_LABEL = 'Settings'

/** lucide icon per section. */
export const SETTINGS_SECTION_ICONS: Record<SettingsSection, FC<{ size?: number }>> = {
  appearance: Palette,
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
