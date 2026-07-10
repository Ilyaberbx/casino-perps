import styles from './live-bets.module.css'
import { LiveBetRow } from './LiveBetRow'
import type { LiveBetsSectionProps } from '../../my-bets.types'

/**
 * The LIVE BETS section: a labelled list of every open bet, or an empty state
 * when there are none. Dumb — bets and the Cash Out handler come from the page
 * hook.
 */
export function LiveBetsSection({ bets, onCashOut }: LiveBetsSectionProps) {
  return (
    <section className={styles.section} aria-label="Live bets">
      <h2 className={styles.heading}>Live Bets</h2>
      {bets.length === 0 ? (
        <p className={styles.empty}>No live bets. Pick a game to place one.</p>
      ) : (
        <ul className={styles.list}>
          {bets.map((bet) => (
            <LiveBetRow key={bet.symbol} bet={bet} onCashOut={onCashOut} />
          ))}
        </ul>
      )}
    </section>
  )
}
