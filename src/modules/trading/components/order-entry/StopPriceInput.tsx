import styles from './order-entry.module.css'
import type { StopPriceInputProps } from './order-entry.types'

const STOP_PRICE_LABEL = 'Stop Price'

export function StopPriceInput({ value, isValid, midPrice, onChange, onUseMid }: StopPriceInputProps) {
  const showInvalidStyle = value.length > 0 && !isValid
  const isMidAvailable = midPrice > 0
  const inputClasses = [
    styles.input,
    styles.inputWithChip,
    showInvalidStyle ? styles.inputInvalid : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{STOP_PRICE_LABEL}</span>
      <div className={styles.inputWithChipWrapper}>
        <input
          type="text"
          inputMode="decimal"
          className={inputClasses}
          value={value}
          placeholder="0.0"
          aria-label={STOP_PRICE_LABEL}
          aria-invalid={showInvalidStyle}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className={styles.midButton}
          disabled={!isMidAvailable}
          onClick={onUseMid}
        >
          MID
        </button>
      </div>
    </label>
  )
}
