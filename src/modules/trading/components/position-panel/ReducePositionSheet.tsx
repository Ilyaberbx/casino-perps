import { Sheet } from '@/modules/shared/components/Sheet'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import { PixelSlider } from '@/modules/shared/components/pixel-slider'
import { SegmentedControl } from '@/modules/shared/components/segmented-control'
import { formatTokenAmount, formatUsd } from '@/modules/shared/utils/format-number'
import { useReducePosition } from './use-reduce-position'
import styles from './position-panel.module.css'
import { REDUCE_MODES, REDUCE_PRESETS, REDUCE_TITLE } from './position-panel.constants'
import type { ReducePositionSheetProps } from './position-panel.types'

/**
 * Close part of the position. The percent slider is the whole point: "take half
 * off" is a normal move, and making a trader compute the coin size for it is how
 * they fat-finger a full close instead.
 */
export function ReducePositionSheet({
  isOpen,
  onClose,
  position,
  baseAsset,
}: ReducePositionSheetProps) {
  const reduce = useReducePosition(position, onClose)
  const percent = Math.round(reduce.fraction * 100)

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      side="bottom"
      ariaLabel={REDUCE_TITLE}
      title={REDUCE_TITLE}
    >
      <div className={styles.sheet} data-testid="reduce-sheet">
        <SegmentedControl
          options={REDUCE_MODES}
          value={reduce.mode}
          onChange={reduce.setMode}
          ariaLabel="Reduce order type"
        />

        <div className={styles.legHead}>
          <span className={styles.legLabel}>Amount</span>
          <span className={styles.reduceSize} data-testid="reduce-size">
            {formatTokenAmount(reduce.size)} {baseAsset} · {percent}%
          </span>
        </div>

        <PixelSlider
          value={percent}
          min={1}
          max={100}
          step={1}
          ariaLabel="Portion of position to close"
          testId="reduce-slider"
          onChange={(next) => reduce.setFraction(next / 100)}
        />

        <div className={styles.presets}>
          {REDUCE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={styles.presetButton}
              onClick={() => reduce.setFraction(preset.fraction)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {reduce.mode === 'limit' ? (
          <div className={styles.legRow}>
            <div className={styles.legHead}>
              <label className={styles.legLabel} htmlFor="reduce-limit-price">
                Limit price
              </label>
              <button type="button" className={styles.midChip} onClick={reduce.useMarkPrice}>
                Mark
              </button>
            </div>
            <input
              id="reduce-limit-price"
              className={
                reduce.isPriceValid
                  ? styles.legInput
                  : `${styles.legInput} ${styles.legInputError}`
              }
              type="text"
              inputMode="decimal"
              value={reduce.limitPriceInput}
              placeholder={formatUsd(position.markPrice)}
              onChange={(event) => reduce.setLimitPriceInput(event.target.value)}
              aria-invalid={!reduce.isPriceValid}
            />
          </div>
        ) : null}

        <PixelButton
          variant={position.side === 'long' ? 'directionDown' : 'directionUp'}
          size="md"
          fullWidth
          elevated
          disabled={!reduce.canSubmit}
          onClick={reduce.submit}
          data-testid="submit-reduce"
        >
          {reduce.isSubmitting ? 'Submitting…' : `Close ${percent}%`}
        </PixelButton>
      </div>
    </Sheet>
  )
}
