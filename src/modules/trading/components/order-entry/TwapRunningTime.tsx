import styles from './order-entry.module.css'
import type { TwapRunningTimeProps } from './order-entry.types'

const RUNNING_TIME_LABEL = 'Running Time'
const HOURS_LABEL = 'Running time hours'
const MINUTES_LABEL = 'Running time minutes'

/** The TWAP running-time field pair — Hour(s) + Minute(s). The combined value is
 *  clamped to [5m, 24h] by the hook's validation; an out-of-range total flags
 *  both inputs invalid. Reuses the price-field pixel skin. */
export function TwapRunningTime({
  hoursInput,
  minutesInput,
  isValid,
  onHoursChange,
  onMinutesChange,
}: TwapRunningTimeProps) {
  const hasInput = hoursInput.length > 0 || minutesInput.length > 0
  const showInvalidStyle = hasInput && !isValid
  const inputClasses = [
    styles.input,
    styles.twapUnitInput,
    showInvalidStyle ? styles.inputInvalid : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <fieldset className={styles.field}>
      <legend className={styles.fieldLabel}>{RUNNING_TIME_LABEL}</legend>
      <div className={styles.twapRunningTimeFields}>
        <div className={styles.twapUnitField}>
          <input
            type="text"
            inputMode="decimal"
            className={inputClasses}
            value={hoursInput}
            placeholder="0"
            aria-label={HOURS_LABEL}
            aria-invalid={showInvalidStyle}
            onChange={(event) => onHoursChange(event.target.value)}
          />
          <span className={styles.twapUnitSuffix} aria-hidden="true">
            Hr
          </span>
        </div>
        <div className={styles.twapUnitField}>
          <input
            type="text"
            inputMode="decimal"
            className={inputClasses}
            value={minutesInput}
            placeholder="0"
            aria-label={MINUTES_LABEL}
            aria-invalid={showInvalidStyle}
            onChange={(event) => onMinutesChange(event.target.value)}
          />
          <span className={styles.twapUnitSuffix} aria-hidden="true">
            Min
          </span>
        </div>
      </div>
    </fieldset>
  )
}
