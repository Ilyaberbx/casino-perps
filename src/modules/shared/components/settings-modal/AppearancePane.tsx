import { AccentColorPicker } from '../accent-color-picker'
import { SegmentedControl } from '../segmented-control'
import type { ThemeVariant } from '../../providers/theme-provider'
import styles from './settings-modal.module.css'
import {
  ACCENT_COLOR_FIELD_DESCRIPTION,
  ACCENT_COLOR_FIELD_LABEL,
  THEME_FIELD_DESCRIPTION,
  THEME_FIELD_LABEL,
  THEME_OPTIONS,
} from './settings-modal.constants'
import type { AppearancePaneProps } from './settings-modal.types'

/**
 * Dumb Appearance section: the Theme (Dark / Light) switch plus the Accent Color
 * picker. Both apply + persist live through the theme provider — no Save step.
 */
export function AppearancePane({
  theme,
  onSelectTheme,
  colors,
  selectedColorId,
  onSelectColor,
}: AppearancePaneProps) {
  return (
    <div className={styles.section}>
      <div className={styles.field}>
        <h3 className={styles.fieldLabel}>{THEME_FIELD_LABEL}</h3>
        <p className={styles.fieldDescription}>{THEME_FIELD_DESCRIPTION}</p>
        <SegmentedControl<ThemeVariant>
          options={THEME_OPTIONS}
          value={theme}
          onChange={onSelectTheme}
          ariaLabel="Theme"
          className={styles.tradingModeToggle}
        />
      </div>
      <div className={styles.field}>
        <h3 className={styles.fieldLabel}>{ACCENT_COLOR_FIELD_LABEL}</h3>
        <p className={styles.fieldDescription}>{ACCENT_COLOR_FIELD_DESCRIPTION}</p>
        <AccentColorPicker
          colors={colors}
          selectedColorId={selectedColorId}
          onSelect={onSelectColor}
        />
      </div>
    </div>
  )
}
