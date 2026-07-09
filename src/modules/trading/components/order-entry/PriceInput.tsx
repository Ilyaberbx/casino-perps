import styles from './order-entry.module.css'
import type { PriceInputProps } from './order-entry.types'

export function PriceInput({
  label,
  value,
  isValid,
  isDisabled,
  midPrice,
  onChange,
  onUseMid,
}: PriceInputProps) {
  const showInvalidStyle = !isDisabled && value.length > 0 && !isValid
  const isMidAvailable = midPrice > 0
  const isMidDisabled = isDisabled || !isMidAvailable
  const inputClasses = [
    styles.input,
    styles.inputWithChip,
    showInvalidStyle ? styles.inputInvalid : '',
    isDisabled ? styles.inputDisabled : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.inputWithChipWrapper}>
        <input
          type="text"
          inputMode="decimal"
          className={inputClasses}
          value={value}
          placeholder={isDisabled ? 'Market' : '0.0'}
          aria-label={label}
          aria-invalid={showInvalidStyle}
          disabled={isDisabled}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className={styles.midButton}
          disabled={isMidDisabled}
          onClick={onUseMid}
        >
          MID
        </button>
      </div>
    </label>
  )
}
