import { IconSelect } from '@/modules/shared/components/icon-select'
import { PixelCheckbox } from '@/modules/shared/components/pixel-checkbox'
import styles from './order-entry.module.css'
import { TIF_OPTIONS } from './order-entry.constants'
import { isOrderTimeInForce } from './order-entry.utils'
import type { OrderOptionsProps } from './order-entry.types'

/** Reduce-only toggle plus the limit-only Time-in-Force selector — the row that
 *  sits between the size field and the TP/SL section (mirrors trade.xyz). */
export function OrderOptions({
  showReduceOnly,
  reduceOnly,
  onReduceOnlyChange,
  isLimit,
  timeInForce,
  onTimeInForceChange,
  isTwap,
  randomize,
  onRandomizeChange,
}: OrderOptionsProps) {
  return (
    <div className={styles.optionsRow}>
      {showReduceOnly ? (
        <PixelCheckbox checked={reduceOnly} onChange={onReduceOnlyChange} label="Reduce Only" />
      ) : null}
      {isTwap ? (
        <PixelCheckbox checked={randomize} onChange={onRandomizeChange} label="Randomize" />
      ) : null}
      {isLimit ? (
        <div className={styles.tifControl}>
          <span className={styles.fieldLabel}>TIF</span>
          <IconSelect
            options={TIF_OPTIONS}
            value={timeInForce}
            ariaLabel="Time in force"
            onChange={(value) => {
              if (isOrderTimeInForce(value)) onTimeInForceChange(value)
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
