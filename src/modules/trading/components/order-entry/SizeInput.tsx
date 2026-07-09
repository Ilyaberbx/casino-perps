import { PixelSlider } from '@/modules/shared/components/pixel-slider'
import { AMOUNT_SLIDER_TICKS } from './order-entry.constants'
import styles from './order-entry.module.css'
import type { SizeInputProps } from './order-entry.types'

const FULL_FRACTION = 1
const PERCENT_MAX = 100

export function SizeInput({
  value,
  unit,
  isValid,
  baseAsset,
  quoteLabel,
  fraction,
  onChange,
  onUnitChange,
  onFractionChange,
}: SizeInputProps) {
  const showInvalidStyle = value.length > 0 && !isValid
  const inputClass = showInvalidStyle ? `${styles.input} ${styles.inputInvalid}` : styles.input
  const isCoinUnit = unit === 'coin'
  const percent = Math.round(fraction * PERCENT_MAX)

  return (
    <div className={styles.field}>
      <div className={styles.fieldHeader}>
        <div className={styles.amountLabelGroup}>
          <span className={styles.fieldLabel}>Amount</span>
          <button
            type="button"
            className={styles.maxButton}
            onClick={() => onFractionChange(FULL_FRACTION)}
          >
            MAX
          </button>
        </div>
        <div className={styles.unitToggle} role="group" aria-label="Size unit">
          <button
            type="button"
            className={isCoinUnit ? `${styles.unitOption} ${styles.unitOptionActive}` : styles.unitOption}
            aria-pressed={isCoinUnit}
            onClick={() => onUnitChange('coin')}
          >
            {baseAsset}
          </button>
          <button
            type="button"
            className={!isCoinUnit ? `${styles.unitOption} ${styles.unitOptionActive}` : styles.unitOption}
            aria-pressed={!isCoinUnit}
            onClick={() => onUnitChange('usd')}
          >
            {quoteLabel}
          </button>
        </div>
      </div>
      <input
        type="text"
        inputMode="decimal"
        className={inputClass}
        value={value}
        placeholder="0.0"
        aria-label="Order size"
        aria-invalid={showInvalidStyle}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className={styles.sliderRow}>
        <PixelSlider
          value={percent}
          min={0}
          max={PERCENT_MAX}
          ticks={AMOUNT_SLIDER_TICKS}
          ariaLabel="Percent of buying power"
          onChange={(next) => onFractionChange(next / PERCENT_MAX)}
        />
        <span className={styles.sliderValue}>{percent}%</span>
      </div>
    </div>
  )
}
