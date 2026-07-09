import { Check } from 'lucide-react'
import { swatchStyle } from './accent-color-picker.styles'
import styles from './accent-color-picker.module.css'
import type { AccentColorPickerProps } from './accent-color-picker.types'

const CHECK_SIZE = 18

/**
 * Dumb swatch grid for the ten predefined accent colors. Each swatch is a
 * button filled with that color's dark accent; the selected one carries a check
 * + an accent ring. Selection applies instantly (the parent persists + re-themes
 * live) — there is no Save step. Fed entirely by props from `use-settings-modal`.
 */
export function AccentColorPicker({ colors, selectedColorId, onSelect }: AccentColorPickerProps) {
  return (
    <div className={styles.grid} role="group" aria-label="Accent color">
      {colors.map((color) => {
        const isSelected = color.id === selectedColorId
        const swatchClass = isSelected ? `${styles.swatch} ${styles.swatchSelected}` : styles.swatch
        return (
          <button
            key={color.id}
            type="button"
            className={swatchClass}
            style={swatchStyle(color.dark.accent)}
            aria-pressed={isSelected}
            aria-label={`Use ${color.label} as accent color`}
            title={color.label}
            data-testid={`accent-color-${color.id}`}
            onClick={() => onSelect(color.id)}
          >
            {isSelected ? <Check size={CHECK_SIZE} strokeWidth={3} aria-hidden="true" /> : null}
          </button>
        )
      })}
    </div>
  )
}
