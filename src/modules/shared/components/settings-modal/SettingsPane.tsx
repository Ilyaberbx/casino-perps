import { AppearancePane } from './AppearancePane'
import { TradingPane } from './TradingPane'
import type { SettingsPaneProps } from './settings-modal.types'

/**
 * Dumb pane router that mounts only the active section's content (#256):
 * Appearance (Theme switch + Accent Color picker) and Trading (the global
 * Simple/Pro trade-layout toggle).
 */
export function SettingsPane({
  activeSection,
  theme,
  onSelectTheme,
  colors,
  selectedColorId,
  onSelectColor,
  tradingMode,
  onSelectTradingMode,
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
  if (activeSection === 'trading')
    return <TradingPane tradingMode={tradingMode} onSelectTradingMode={onSelectTradingMode} />
  return null
}
