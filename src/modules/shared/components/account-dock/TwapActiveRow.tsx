import { X } from 'lucide-react'
import styles from './account-dock.module.css'
import { Badge } from '@/modules/shared/components/badge'
import { MarketKindTag } from '@/modules/shared/components/market-kind-tag'
import { PixelCheckbox } from '@/modules/shared/components/pixel-checkbox'
import { GatedActionButton } from './GatedActionButton'
import { TwapProgressBar } from './TwapProgressBar'
import { directionLabel, formatHistoryTime, formatTwapDuration } from './account-dock.utils'
import {
  formatTwapTimeRemaining,
  twapAveragePrice,
  twapProgressFraction,
  twapTimeRemainingMs,
} from './twap-panel.utils'
import { formatUsd, formatTokenAmount } from '@/modules/shared/utils/format-number'
import { parseHip3Symbol } from '@/modules/shared/utils/hip3-symbol'
import { buildIconMarketFromSymbol } from '@/modules/shared/utils/resolve-market-icon-url'
import type { TwapActiveRowProps } from './twap-panel.types'
import { AssetIcon } from '@/modules/shared/components/asset-icon'
import { FitCell } from '@/modules/shared/components/fit-cell'

const CANCEL_DISABLED_TOOLTIP = 'Complete Hyperliquid setup to cancel TWAP orders'

export function TwapActiveRow({
  twap,
  now,
  hasTwapController,
  isSelected,
  onToggleSelected,
  onCancel,
}: TwapActiveRowProps) {
  const isLong = twap.side === 'buy'
  const averagePrice = twapAveragePrice(twap.executedNotionalUsd, twap.executedSize)
  const averagePriceLabel = averagePrice === null ? '--' : formatUsd(averagePrice)
  const remainingMs = twapTimeRemainingMs(twap.createdAt, twap.durationMinutes, now)
  const fraction = twapProgressFraction(twap.executedSize, twap.size)
  const progressLabel = `${Math.round(fraction * 100)}%`

  return (
    <div className={`${styles.row} ${styles.twapActiveRow}`}>
      <span className={styles.cell}>
        {hasTwapController ? (
          <PixelCheckbox
            checked={isSelected}
            onChange={onToggleSelected}
            ariaLabel={`Select TWAP ${parseHip3Symbol(twap.symbol).displaySymbol}`}
          />
        ) : null}
      </span>
      <span className={styles.cell}>
        <span className={styles.symbolCell}>
          <AssetIcon market={buildIconMarketFromSymbol(twap.symbol)} size={18} />
          <FitCell align="left">{parseHip3Symbol(twap.symbol).displaySymbol}</FitCell>
          <MarketKindTag symbol={twap.symbol} />
        </span>
      </span>
      <span className={styles.cell}>
        <Badge tone={isLong ? 'directionUp' : 'directionDown'}>{directionLabel(twap.side)}</Badge>
      </span>
      <span className={styles.cell}>
        <FitCell>{formatTokenAmount(twap.size)}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{formatTokenAmount(twap.executedSize)}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{averagePriceLabel}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{formatHistoryTime(twap.createdAt)}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{formatTwapDuration(twap.durationMinutes)}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{formatTwapTimeRemaining(remainingMs)}</FitCell>
      </span>
      <span className={styles.cell}>
        <TwapProgressBar fraction={fraction} label={progressLabel} />
      </span>
      <span className={`${styles.cell} ${styles.actionsCell}`}>
        {hasTwapController ? (
          <span className={styles.rowActions}>
            <GatedActionButton
              icon={X}
              onClick={onCancel}
              disabledTooltip={CANCEL_DISABLED_TOOLTIP}
              ariaLabel="Cancel TWAP"
            />
          </span>
        ) : null}
      </span>
    </div>
  )
}
