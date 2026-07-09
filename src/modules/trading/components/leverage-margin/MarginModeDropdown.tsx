import { IconSelect } from '@/modules/shared/components/icon-select'
import { MARGIN_MODE_OPTIONS } from './leverage-margin.constants'
import styles from './leverage-margin.module.css'
import type { MarginModeDropdownProps } from './leverage-margin.types'

/** Cross/Isolated dropdown (pixel-art listbox), sibling of the leverage chip.
 *  Applies the margin mode immediately on select via the signed controller. */
export function MarginModeDropdown({ marginMode, onChange }: MarginModeDropdownProps) {
  return (
    <IconSelect
      options={MARGIN_MODE_OPTIONS}
      value={marginMode}
      ariaLabel="Margin mode"
      className={styles.marginDropdown}
      onChange={(value) => onChange(value === 'isolated' ? 'isolated' : 'cross')}
    />
  )
}
