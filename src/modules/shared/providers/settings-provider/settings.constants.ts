import type { SettingsSection } from './settings-provider.types'

/**
 * Canonical nav-rail order + labels for the Settings sections. The nav and pane
 * iterate this. Append a row here (plus a `SettingsSection` member and a pane) to
 * add a section.
 */
export const SETTINGS_SECTIONS: ReadonlyArray<{
  readonly id: SettingsSection
  readonly label: string
}> = [
  { id: 'appearance', label: 'Appearance' },
] as const

export const DEFAULT_SETTINGS_SECTION: SettingsSection = 'appearance'
