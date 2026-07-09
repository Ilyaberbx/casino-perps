import styles from './amount-input.module.css'
import { useAmountInput } from './use-amount-input'
import type { AmountInputProps } from './amount-input.types'

export function AmountInput({
  value,
  onChange,
  label,
  isValid,
  disabled = false,
  invalidReason,
  unit,
  onMax,
}: AmountInputProps) {
  const { reasonId, showInvalid, handleChange } = useAmountInput({ value, isValid, onChange })

  const wrapClass = showInvalid ? `${styles.inputWrap} ${styles.invalid}` : styles.inputWrap
  const describedBy = showInvalid && invalidReason !== undefined ? reasonId : undefined

  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <div className={styles.inputRow}>
        <div className={wrapClass}>
          <input
            className={styles.input}
            type="text"
            inputMode="decimal"
            value={value}
            placeholder="0.00"
            disabled={disabled}
            aria-label={label}
            aria-invalid={showInvalid}
            aria-describedby={describedBy}
            onChange={handleChange}
          />
          {unit !== undefined && <span className={styles.unit}>{unit}</span>}
        </div>
        {onMax !== undefined && (
          <button type="button" className={styles.maxButton} disabled={disabled} onClick={onMax}>
            Max
          </button>
        )}
      </div>
      {showInvalid && invalidReason !== undefined && (
        <span id={reasonId} className={styles.reason}>
          {invalidReason}
        </span>
      )}
    </div>
  )
}
