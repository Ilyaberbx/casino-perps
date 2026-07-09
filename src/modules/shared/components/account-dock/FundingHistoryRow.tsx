import styles from './account-dock.module.css'
import { MarketKindTag } from '@/modules/shared/components/market-kind-tag'
import { formatFundingRate, formatHistoryTime, pnlSign } from './account-dock.utils'
import { formatUsd, formatTokenAmount } from '@/modules/shared/utils/format-number'
import type { FundingHistoryRowProps } from './account-dock.types'
import { buildIconMarketFromSymbol } from '@/modules/shared/utils/resolve-market-icon-url'
import { AssetIcon } from '@/modules/shared/components/asset-icon'
import { FitCell } from '@/modules/shared/components/fit-cell'

export function FundingHistoryRow({ entry }: FundingHistoryRowProps) {
  return (
    <div className={`${styles.row} ${styles.fundingRow}`}>
      <span className={styles.cell}>
        <FitCell align="left">{formatHistoryTime(entry.timestamp)}</FitCell>
      </span>
      <span className={styles.cell}>
        <span className={styles.symbolCell}>
          <AssetIcon market={buildIconMarketFromSymbol(entry.symbol)} size={18} />
          <FitCell align="left">{entry.symbol}</FitCell>
          <MarketKindTag symbol={entry.symbol} />
        </span>
      </span>
      <span className={styles.pnlCell} data-pnl-sign={pnlSign(entry.amountUsd)}>
        <FitCell>{formatUsd(entry.amountUsd, { signed: true })}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{formatFundingRate(entry.fundingRate)}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{formatTokenAmount(entry.positionSize)}</FitCell>
      </span>
    </div>
  )
}
