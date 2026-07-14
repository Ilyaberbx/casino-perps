import type { ReactNode } from 'react'

/**
 * The sections of the Settings modal, in nav-rail order (#256). `appearance`
 * holds the Theme switch + Accent Color picker; `trading` holds the global
 * Simple/Pro Trading Mode toggle. The union is the extension point — new
 * settings drop in as new members + a `SETTINGS_SECTIONS` entry + a pane.
 */
export type SettingsSection = 'appearance' | 'trading'

export interface SettingsContextValue {
  readonly isOpen: boolean
  readonly activeSection: SettingsSection
  /** Opens the modal; an explicit section deep-links that pane. */
  open(section?: SettingsSection): void
  close(): void
  setActiveSection(section: SettingsSection): void
}

export interface SettingsProviderProps {
  readonly children: ReactNode
  readonly defaultOpen?: boolean
  readonly defaultSection?: SettingsSection
}
