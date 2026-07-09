import { PixelButton } from '@/modules/shared/components/pixel-button'
import { PixelCheckbox } from '@/modules/shared/components/pixel-checkbox'
import { PixelSlider } from '@/modules/shared/components/pixel-slider'
import styles from './account-dock.module.css'
import type { PositionTpslAmountBlockProps } from './position-tpsl.types'

const SLIDER_TICKS = [
  { value: 0, label: '0%' },
  { value: 0.25 },
  { value: 0.5, label: '50%' },
  { value: 0.75 },
  { value: 1, label: '100%' },
] as const

export function PositionTpslAmountBlock({
  enabled,
  onEnabledChange,
  baseAsset,
  amountInput,
  onAmountChange,
  fraction,
  onFractionChange,
  onMax,
}: PositionTpslAmountBlockProps) {
  return (
    <div className={styles.tpslOptionBlock}>
      <PixelCheckbox checked={enabled} onChange={onEnabledChange} label="Configure Amount" />
      {enabled ? (
        <div className={styles.tpslAmountBody}>
          <div className={styles.dialogSizeRow}>
            <input
              type="text"
              inputMode="decimal"
              className={styles.dialogInput}
              value={amountInput}
              aria-label={`Amount in ${baseAsset}`}
              onChange={(event) => onAmountChange(event.target.value)}
            />
            <PixelButton variant="default" size="sm" aria-label="Use max amount" onClick={onMax}>
              MAX
            </PixelButton>
          </div>
          <PixelSlider
            value={fraction}
            min={0}
            max={1}
            step={0.01}
            ticks={SLIDER_TICKS}
            ariaLabel="Amount as percent of position size"
            onChange={onFractionChange}
          />
        </div>
      ) : null}
    </div>
  )
}
