import { PixelCheckbox } from '@/modules/shared/components/pixel-checkbox'
import styles from './account-dock.module.css'
import type { PositionTpslLimitBlockProps } from './position-tpsl.types'

export function PositionTpslLimitBlock({
  enabled,
  onEnabledChange,
  value,
  onChange,
}: PositionTpslLimitBlockProps) {
  return (
    <div className={styles.tpslOptionBlock}>
      <PixelCheckbox checked={enabled} onChange={onEnabledChange} label="Limit Price" />
      {enabled ? (
        <input
          type="text"
          inputMode="decimal"
          className={styles.dialogInput}
          value={value}
          aria-label="Limit price"
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}
    </div>
  )
}
