import styles from './account-dock.module.css'
import { formatActivityTime, pnlSign } from './account-dock.utils'
import { ExternalLinkIcon } from '@/modules/shared/components/ExternalLinkIcon'
import { formatTokenAmount, formatUsd } from '@/modules/shared/utils/format-number'
import { renderAccountActivityDelta } from '@/modules/shared/utils/account-activity-delta'
import { buildIconMarketFromSymbol } from '@/modules/shared/utils/resolve-market-icon-url'
import type { AccountActivityRowProps } from './account-dock.types'
import { AssetIcon } from '@/modules/shared/components/asset-icon'
import { FitCell } from '@/modules/shared/components/fit-cell'

export function AccountActivityRow({ entry, explorerTxUrl }: AccountActivityRowProps) {
  const row = renderAccountActivityDelta(entry.delta)
  const hasChange = row.changeAmount !== null
  const hasUsdValue = row.usdValue !== null
  const hasExplorerLink = explorerTxUrl !== undefined && entry.hash !== ''

  return (
    <div className={`${styles.row} ${styles.activityRow}`}>
      <span className={`${styles.cell} ${styles.activityTimeCell}`}>
        <FitCell align="left" className={styles.fitCellFlex}>
          {formatActivityTime(entry.time)}
        </FitCell>
        {hasExplorerLink ? (
          <a
            className={styles.activityTimeLink}
            href={explorerTxUrl(entry.hash)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View transaction ${entry.hash} on the explorer`}
            title={entry.hash}
          >
            <ExternalLinkIcon />
          </a>
        ) : null}
      </span>
      <span className={`${styles.activityText} ${styles.activityStatus}`}>
        <FitCell align="left">Completed</FitCell>
      </span>
      <span className={styles.activityText}>
        <span className={styles.symbolCell}>
          {row.asset ? (
            <AssetIcon market={buildIconMarketFromSymbol(row.asset)} size={18} />
          ) : null}
          <FitCell align="left">{row.asset}</FitCell>
        </span>
      </span>
      <span className={styles.activityText}>
        <FitCell align="left">{row.action}</FitCell>
      </span>
      <span className={styles.activityText}>
        <FitCell align="left">{row.from ?? '--'}</FitCell>
      </span>
      <span className={styles.activityText}>
        <FitCell align="left">{row.to ?? '--'}</FitCell>
      </span>
      <span className={styles.activityText}>
        <FitCell align="left">{row.destination ?? '--'}</FitCell>
      </span>
      <span className={styles.pnlCell} data-pnl-sign={hasChange ? pnlSign(row.changeAmount ?? 0) : 'zero'}>
        <FitCell>
          {hasChange ? `${formatTokenAmount(row.changeAmount ?? 0)} ${row.changeAsset}` : '--'}
        </FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{hasUsdValue ? formatUsd(row.usdValue ?? 0) : '--'}</FitCell>
      </span>
      <span className={styles.cell}>
        <FitCell>{row.fee ?? '--'}</FitCell>
      </span>
    </div>
  )
}
