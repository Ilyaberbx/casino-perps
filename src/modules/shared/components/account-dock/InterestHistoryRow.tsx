import styles from './account-dock.module.css'
import { formatHistoryTime, pnlSign } from './account-dock.utils'
import { formatUsd } from '@/modules/shared/utils/format-number'
import { buildIconMarketFromSymbol } from '@/modules/shared/utils/resolve-market-icon-url'
import type { InterestHistoryRowProps } from './account-dock.types'
import { AssetIcon } from '@/modules/shared/components/asset-icon'
import { FitCell } from '@/modules/shared/components/fit-cell'

export function InterestHistoryRow({ entry }: InterestHistoryRowProps) {
  return (
    <div className={`${styles.row} ${styles.interestRow}`}>
      <span className={styles.cell}>
        <FitCell align="left">{formatHistoryTime(entry.timestamp)}</FitCell>
      </span>
      <span className={styles.cell}>
        <span className={styles.symbolCell}>
          <AssetIcon market={buildIconMarketFromSymbol(entry.asset)} size={18} />
          <FitCell>{entry.asset}</FitCell>
        </span>
      </span>
      <span className={styles.pnlCell} data-pnl-sign={pnlSign(entry.amountUsd)}>
        <FitCell>{formatUsd(entry.amountUsd, { signed: true })}</FitCell>
      </span>
    </div>
  )
}
