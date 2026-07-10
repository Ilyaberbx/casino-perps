import styles from './my-bets-page.module.css'
import { useMyBetsPage } from './use-my-bets-page'
import { CashHeader } from '../components/cash-header/CashHeader'
import { LiveBetsSection } from '../components/live-bets/LiveBetsSection'
import { SettledBetsSection } from '../components/settled-bets/SettledBetsSection'

/**
 * My Bets (PRD 0008 D11) — the casino re-skin of the old portfolio page. Cash
 * balance on top, then the live bets the user can Cash Out, then the settled
 * history. All numbers, vocabulary, and money-movement flow through
 * `useMyBetsPage`; this page is pure composition.
 */
export function MyBetsPage() {
  const { cashLabel, isConnected, onAddCash, onWithdraw, liveBets, onCashOut, settledBets } =
    useMyBetsPage()

  return (
    <div className={styles.page} data-testid="my-bets-page">
      <CashHeader
        cashLabel={cashLabel}
        isConnected={isConnected}
        onAddCash={onAddCash}
        onWithdraw={onWithdraw}
      />
      <LiveBetsSection bets={liveBets} onCashOut={onCashOut} />
      <SettledBetsSection bets={settledBets} />
    </div>
  )
}
