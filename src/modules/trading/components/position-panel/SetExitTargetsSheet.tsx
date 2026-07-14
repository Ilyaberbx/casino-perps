import { Sheet } from '@/modules/shared/components/Sheet'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import { useExitTargets } from './use-exit-targets'
import { ExitLegRow } from './ExitLegRow'
import { formatUsd } from '@/modules/shared/utils/format-number'
import styles from './position-panel.module.css'
import { EXIT_TARGETS_TITLE } from './position-panel.constants'
import type { SetExitTargetsSheetProps } from './position-panel.types'

/**
 * Set the two prices that end the trade for you, instead of the market ending
 * it. Each leg previews its own ROE, and a stop past the liquidation price is
 * rejected outright — that is not a stop, it is a story you tell yourself.
 */
export function SetExitTargetsSheet({
  isOpen,
  onClose,
  position,
  liquidationPriceText,
}: SetExitTargetsSheetProps) {
  const exit = useExitTargets(position, onClose)

  const issueFor = (leg: 'takeProfit' | 'stopLoss') =>
    exit.issues.find((issue) => issue.leg === leg)?.message ?? null

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      side="bottom"
      ariaLabel={EXIT_TARGETS_TITLE}
      title={EXIT_TARGETS_TITLE}
    >
      <div className={styles.sheet} data-testid="exit-targets-sheet">
        <dl className={styles.sheetContext}>
          <div className={styles.stat}>
            <dt>Entry</dt>
            <dd>{formatUsd(position.entryPrice)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Mark</dt>
            <dd>{formatUsd(position.markPrice)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Liq. price</dt>
            <dd className={styles.liq}>
              {liquidationPriceText === null ? '--' : `$${liquidationPriceText}`}
            </dd>
          </div>
        </dl>

        <ExitLegRow
          label="Take profit"
          hint="Trigger price"
          value={exit.takeProfitInput}
          roiPct={exit.takeProfitRoiPct}
          issue={issueFor('takeProfit')}
          onChange={exit.setTakeProfitInput}
        />
        <ExitLegRow
          label="Stop loss"
          hint="Trigger price"
          value={exit.stopLossInput}
          roiPct={exit.stopLossRoiPct}
          issue={issueFor('stopLoss')}
          onChange={exit.setStopLossInput}
        />

        <PixelButton
          variant="accentFilled"
          size="md"
          fullWidth
          elevated
          disabled={!exit.canSubmit}
          onClick={exit.submit}
          data-testid="submit-exit-targets"
        >
          {exit.isSubmitting ? 'Setting…' : 'Set exit targets'}
        </PixelButton>

        <button
          type="button"
          className={styles.clearButton}
          onClick={exit.clear}
          disabled={exit.isClearing}
          data-testid="clear-exit-targets"
        >
          {exit.isClearing ? 'Removing…' : 'Remove existing exit targets'}
        </button>
      </div>
    </Sheet>
  )
}
