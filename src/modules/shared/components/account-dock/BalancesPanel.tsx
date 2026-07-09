import styles from './balances-panel.module.css'
import { useVenue } from '@/modules/shared/providers/venue-provider'
import { BalanceActionsCell } from './BalanceActionsCell'
import { useBalancesPanel } from './use-balances-panel'
import { balanceSourceLabel } from './balances-panel.utils'
import { formatTokenWithUnit } from './account-dock.utils'
import { formatPnlPct, pnlPctSign } from '@/modules/shared/utils/format-pnl'
import { BALANCES_COLUMN_COUNT, BALANCES_SKELETON_GRID } from './balances-panel.constants'
import { DOCK_SKELETON_ROWS } from './account-dock.constants'
import { formatUsd } from '@/modules/shared/utils/format-number'
import { PlaceholderMessage } from '@/modules/shared/components/placeholder-message'
import { TableSkeleton } from '@/modules/shared/components/table-skeleton'
import { LoadingReveal } from '@/modules/shared/components/loading-reveal'
import { AssetIcon } from '@/modules/shared/components/asset-icon'
import { Badge } from '@/modules/shared/components/badge'
import { buildIconMarketFromSymbol } from '@/modules/shared/utils/resolve-market-icon-url'
import type { BadgeTone } from '@/modules/shared/components/badge'
import type { BalanceSource } from '@/modules/shared/domain'

const UNSUPPORTED_MESSAGE = 'Balances not supported by this venue'

const PNL_CLASS: Record<'positive' | 'negative' | 'neutral', string | undefined> = {
  positive: styles.pnlPositive,
  negative: styles.pnlNegative,
  neutral: undefined,
}

const SOURCE_TONE: Record<BalanceSource, BadgeTone> = {
  spot: 'accent',
  perps: 'directionUp',
  aggregated: 'neutral',
  unified: 'accent',
}

function BalancesContent() {
  const {
    displayedBalances,
    isUnified,
    aggregateBalances,
    hideSmallBalances,
    toggleAggregateBalances,
    toggleHideSmallBalances,
    isLoading,
    isEmpty,
    canTransfer,
    onTransfer,
  } = useBalancesPanel()

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        {!isUnified && (
          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={aggregateBalances}
              onChange={toggleAggregateBalances}
              aria-label="Aggregate Balances"
            />
            Aggregate Balances
          </label>
        )}
        <label className={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={hideSmallBalances}
            onChange={toggleHideSmallBalances}
            aria-label="Hide Small Balances"
          />
          Hide Small Balances
        </label>
      </div>
      <LoadingReveal
        isLoading={isLoading}
        skeleton={
          <TableSkeleton
            gridTemplate={BALANCES_SKELETON_GRID}
            columns={BALANCES_COLUMN_COUNT}
            rows={DOCK_SKELETON_ROWS}
            ariaLabel="Loading balances"
          />
        }
      >
        {isEmpty ? (
          <PlaceholderMessage message="No balances" />
        ) : (
      <div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Asset</th>
              <th>Total Balance</th>
              <th>Available Balance</th>
              <th>Value (USD)</th>
              <th>PNL (ROE %)</th>
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {displayedBalances.map((balance) => (
              <tr key={`${balance.asset}-${balance.source}`}>
                <td>
                  <span className={styles.assetCell}>
                    <AssetIcon market={buildIconMarketFromSymbol(balance.asset)} size={18} />
                    {balance.asset}
                    <Badge
                      tone={SOURCE_TONE[balance.source]}
                      aria-label={`${balanceSourceLabel(balance.source)} wallet`}
                    >
                      {balanceSourceLabel(balance.source)}
                    </Badge>
                  </span>
                </td>
                <td>{formatTokenWithUnit(balance.amount, balance.asset)}</td>
                <td>{formatTokenWithUnit(balance.available, balance.asset)}</td>
                <td>{formatUsd(balance.amountUsd)}</td>
                <td className={PNL_CLASS[pnlPctSign(balance.pnlPct)]}>
                  {formatPnlPct(balance.pnlPct)}
                </td>
                <BalanceActionsCell
                  balance={balance}
                  canTransfer={canTransfer}
                  onTransfer={onTransfer}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        )}
      </LoadingReveal>
    </div>
  )
}

export function BalancesPanel() {
  const venue = useVenue()
  const hasBalancesCap = venue.capabilities.balances !== undefined

  if (!hasBalancesCap) {
    return <div className={styles.placeholder}>{UNSUPPORTED_MESSAGE}</div>
  }

  return <BalancesContent />
}
