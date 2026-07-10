import { useCallback } from 'react'
import { useSettings, SETTINGS_SECTIONS } from '../../providers/settings-provider'
import { useThemeContext } from '../../providers/theme-provider'
import type { ThemeVariant } from '../../providers/theme-provider'
import { useIsMobile } from '../../hooks/use-is-mobile'
import { SETTINGS_SECTION_ICONS } from './settings-modal.constants'
import type { SettingsModalContent, SettingsNavSection } from './settings-modal.types'

/**
 * Smart hook for `<SettingsModal>`. Reads the open/active-section controller
 * (`useSettings`), the theme state (`useThemeContext`, which owns the theme +
 * accent color), and projects the nav rail + each section's data. The Appearance
 * section owns the Theme switch + Accent Color picker. Dumb components below
 * consume only prop slices.
 */
export function useSettingsModal(): SettingsModalContent {
  const { isOpen, activeSection, close, setActiveSection } = useSettings()
  const { theme, toggleTheme, accentColorId, accentColors, setAccentColor } = useThemeContext()
  const isMobile = useIsMobile()

  // Theme has exactly two variants, so selecting the other one is a toggle.
  const onSelectTheme = useCallback(
    (next: ThemeVariant) => {
      if (next !== theme) toggleTheme()
    },
    [theme, toggleTheme],
  )

  const sections: ReadonlyArray<SettingsNavSection> = SETTINGS_SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    Icon: SETTINGS_SECTION_ICONS[section.id],
  }))

  return {
    isOpen,
    activeSection,
    close,
    onSelectSection: setActiveSection,
    sections,
    isMobile,
    theme,
    onSelectTheme,
    colors: accentColors,
    selectedColorId: accentColorId,
    onSelectColor: setAccentColor,
  }
}
