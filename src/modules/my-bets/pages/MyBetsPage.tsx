import styles from './my-bets-page.module.css'
import { useMyBetsPage } from './use-my-bets-page'
import { AccountHeader } from '../components/account-header/AccountHeader'
import { OpenPositionsSection } from '../components/open-positions/OpenPositionsSection'
import { ClosedTradesSection } from '../components/closed-trades/ClosedTradesSection'

/**
 * The positions page: account equity on top, then the open positions the user
 * can close, then the closed-trade history. All numbers and money-movement flow
 * through `useMyBetsPage`; this page is pure composition.
 */
export function MyBetsPage() {
  const {
    equityLabel,
    isConnected,
    onDeposit,
    onWithdraw,
    openPositions,
    onClose,
    closedTrades,
  } = useMyBetsPage()

  return (
    <div className={styles.page} data-testid="my-bets-page">
      <AccountHeader
        equityLabel={equityLabel}
        isConnected={isConnected}
        onDeposit={onDeposit}
        onWithdraw={onWithdraw}
      />
      <OpenPositionsSection positions={openPositions} onClose={onClose} />
      <ClosedTradesSection trades={closedTrades} />
    </div>
  )
}
