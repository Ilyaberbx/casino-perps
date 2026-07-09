import { useMemo } from 'react'
import { PixelSlider } from '@/modules/shared/components/pixel-slider'
import { useLeverageSlider } from './use-leverage-slider'
import { MarginModeDropdown } from './MarginModeDropdown'
import { buildLeverageTicks } from './leverage-margin.utils'
import { formatMarketDisplaySymbol } from '@/modules/shared/utils/format-market-display-symbol'
import styles from './leverage-margin.module.css'
import type { LeverageSectionProps } from './leverage-margin.types'

/**
 * Inline leverage section inside the order ticket (the slot LeverageMargin
 * occupies). Header row pairs the 'Leverage' label, an editable numeric value
 * chip (blur/Enter commit — LOCKED DECISION a), and the Cross/Isolated dropdown;
 * the PixelSlider + tick scale sit beneath, visually paired with the Amount
 * slider below. Leverage commits on slider release (commit-on-release — LOCKED
 * DECISION d); the `isApplying` disable is scoped to these controls only.
 */
export function LeverageSection({
  symbol,
  leverage,
  maxLeverage,
  isApplying,
  marginMode,
  canEditLeverage,
  canEditMarginMode,
  onApplyLeverage,
  onApplyMarginMode,
}: LeverageSectionProps) {
  const { draftInput, draftLeverage, minLeverage, setDraftInput, setSliderLeverage, commitLeverage } =
    useLeverageSlider({ leverage, maxLeverage, onApplyLeverage })

  const ticks = useMemo(() => buildLeverageTicks(maxLeverage), [maxLeverage])
  const displaySymbol = formatMarketDisplaySymbol(symbol)

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.labelGroup}>
          <span className={styles.fieldLabel}>Leverage</span>
          <span className={styles.marketLabel}>{displaySymbol}</span>
        </div>
        {canEditMarginMode ? (
          <MarginModeDropdown marginMode={marginMode} onChange={onApplyMarginMode} />
        ) : null}
      </div>

      {canEditLeverage ? (
        <fieldset className={styles.fieldset} disabled={isApplying}>
          <div className={styles.sliderRow}>
            <PixelSlider
              value={draftLeverage}
              min={minLeverage}
              max={maxLeverage}
              ticks={ticks}
              tone="danger-ramp"
              ariaLabel="Leverage slider"
              onChange={setSliderLeverage}
              onCommit={commitLeverage}
            />
            <div className={styles.valueChip}>
              <input
                type="number"
                inputMode="numeric"
                min={minLeverage}
                max={maxLeverage}
                step={1}
                className={styles.valueChipInput}
                value={draftInput}
                aria-label="Leverage multiplier"
                onChange={(event) => setDraftInput(event.target.value)}
                onBlur={commitLeverage}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitLeverage()
                }}
              />
              <span className={styles.valueChipSuffix}>×</span>
            </div>
          </div>
        </fieldset>
      ) : null}
    </div>
  )
}
