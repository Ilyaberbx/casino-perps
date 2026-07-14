import styles from './closed-trades.module.css'
import { ClosedTradeRow } from './ClosedTradeRow'
import type { ClosedTradesSectionProps } from '../../my-bets.types'

/**
 * The trade-history section: a labelled list of closed trades, or an empty state
 * when there are none yet. Dumb — trades come from the page hook.
 */
export function ClosedTradesSection({ trades }: ClosedTradesSectionProps) {
  return (
    <section className={styles.section} aria-label="Trade history">
      <h2 className={styles.heading}>Trade History</h2>
      {trades.length === 0 ? (
        <p className={styles.empty}>No closed trades yet.</p>
      ) : (
        <ul className={styles.list}>
          {trades.map((trade) => (
            <ClosedTradeRow key={trade.id} trade={trade} />
          ))}
        </ul>
      )}
    </section>
  )
}
