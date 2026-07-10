import { AppearancePane } from './AppearancePane'
import type { SettingsPaneProps } from './settings-modal.types'

/**
 * Dumb pane router that mounts only the active section's content (#256): the
 * Appearance section (Theme switch + Accent Color picker). (The Trading section
 * was removed with pro mode — PRD-0008 D7.)
 */
export function SettingsPane({
  activeSection,
  theme,
  onSelectTheme,
  colors,
  selectedColorId,
  onSelectColor,
}: SettingsPaneProps) {
  if (activeSection === 'appearance')
    return (
      <AppearancePane
        theme={theme}
        onSelectTheme={onSelectTheme}
        colors={colors}
        selectedColorId={selectedColorId}
        onSelectColor={onSelectColor}
      />
    )
  return null
}
