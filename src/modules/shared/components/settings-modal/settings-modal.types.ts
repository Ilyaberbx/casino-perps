import type { FC } from 'react'
import type { SettingsSection } from '../../providers/settings-provider'
import type { AccentColor, AccentColorId, ThemeVariant } from '../../providers/theme-provider'

/** One nav entry: id, label, and lucide icon. */
export interface SettingsNavSection {
  readonly id: SettingsSection
  readonly label: string
  readonly Icon: FC<{ size?: number }>
}

export interface SettingsModalContent {
  readonly isOpen: boolean
  readonly activeSection: SettingsSection
  close(): void
  onSelectSection(section: SettingsSection): void
  readonly sections: ReadonlyArray<SettingsNavSection>
  readonly isMobile: boolean
  readonly theme: ThemeVariant
  onSelectTheme(theme: ThemeVariant): void
  readonly colors: ReadonlyArray<AccentColor>
  readonly selectedColorId: AccentColorId
  onSelectColor(id: AccentColorId): void
}

export interface SettingsNavProps {
  readonly sections: ReadonlyArray<SettingsNavSection>
  readonly activeSection: SettingsSection
  onSelect(section: SettingsSection): void
  readonly isMobile: boolean
}

export interface SettingsPaneProps {
  readonly activeSection: SettingsSection
  readonly theme: ThemeVariant
  onSelectTheme(theme: ThemeVariant): void
  readonly colors: ReadonlyArray<AccentColor>
  readonly selectedColorId: AccentColorId
  onSelectColor(id: AccentColorId): void
}

export interface AppearancePaneProps {
  readonly theme: ThemeVariant
  onSelectTheme(theme: ThemeVariant): void
  readonly colors: ReadonlyArray<AccentColor>
  readonly selectedColorId: AccentColorId
  onSelectColor(id: AccentColorId): void
}
