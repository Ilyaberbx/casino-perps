import styles from './settled-bets.module.css'
import { SettledBetRow } from './SettledBetRow'
import type { SettledBetsSectionProps } from '../../my-bets.types'

/**
 * The SETTLED section: a labelled history list of closed bets, or an empty
 * state when there are none yet. Dumb — bets come from the page hook.
 */
export function SettledBetsSection({ bets }: SettledBetsSectionProps) {
  return (
    <section className={styles.section} aria-label="Settled bets">
      <h2 className={styles.heading}>Settled</h2>
      {bets.length === 0 ? (
        <p className={styles.empty}>No settled bets yet.</p>
      ) : (
        <ul className={styles.list}>
          {bets.map((bet) => (
            <SettledBetRow key={bet.id} bet={bet} />
          ))}
        </ul>
      )}
    </section>
  )
}
