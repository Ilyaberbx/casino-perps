import styles from './account-dock.module.css'
import { Badge } from '@/modules/shared/components/badge'
import { MarketKindTag } from '@/modules/shared/components/market-kind-tag'
import { directionLabel, formatHistoryTime, formatTwapDuration } from './account-dock.utils'
import { twapAveragePrice, twapHistoryStatusLabel, yesNoDash } from './twap-panel.utils'
import { formatUsd, formatTokenAmount } from '@/modules/shared/utils/format-number'
import { parseHip3Symbol } from '@/modules/shared/utils/hip3-symbol'
import { buildIconMarketFromSymbol } from '@/modules/shared/utils/resolve-market-icon-url'
import type { TwapHistoryRowProps } from './twap-panel.types'
import { AssetIcon } from '@/modules/shared/components/asset-icon'
import { FitCell } from '@/modules/shared/components/fit-cell'

export function TwapHistoryRow({ entry }: TwapHistoryRowProps) {
  const isLong = entry.side === 'buy'
  const averagePrice = twapAveragePrice(entry.executedNotionalUsd, entry.executedSize)
  const averagePriceLabel = averagePrice === null ? '--' : formatUsd(averagePrice)
  const durationLabel = entry.durationMinutes === undefined ? '--' : formatTwapDuration(entry.durationMinutes)

  return (
    <div className={`${styles.row} ${styles.twapHistoryRow}`}>
      <span className={styles.cell}>
        <FitCell align="left">{formatHistoryTime(entry.createdAt)}</FitCell>
      </span>
      <span className={styles.cell}>
        <span className={styles.symbolCell}>
          <AssetIcon market={buildIconMarketFromSymbol(entry.symbol)} size={18} />
          <FitCell align="left">{parseHip3Symbol(entry.symbol).displaySymbol}</FitCell>
          <MarketKindTag symbol={entry.symbol} />
        </span>
      </span>
      <span className={styles.cell}>
        <Badge tone={isLong ? 'directionUp' : 'directionDown'}>{directionLabel(entry.side)}</Badge>
      </span>
      <span className={styles.cell}>
        <FitCell>{formatTokenAmount(entry.size)}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{formatTokenAmount(entry.executedSize)}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{averagePriceLabel}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{durationLabel}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{yesNoDash(entry.reduceOnly)}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{yesNoDash(entry.randomize)}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{twapHistoryStatusLabel(entry.status)}</FitCell>
      </span>
    </div>
  )
}
