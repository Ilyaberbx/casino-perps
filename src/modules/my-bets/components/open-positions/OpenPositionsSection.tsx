import styles from './open-positions.module.css'
import { OpenPositionRow } from './OpenPositionRow'
import type { OpenPositionsSectionProps } from '../../my-bets.types'

/**
 * The open-positions section: a labelled list of every open position, or an
 * empty state when there are none. Dumb — positions and the close handler come
 * from the page hook.
 */
export function OpenPositionsSection({ positions, onClose }: OpenPositionsSectionProps) {
  return (
    <section className={styles.section} aria-label="Open positions">
      <h2 className={styles.heading}>Open Positions</h2>
      {positions.length === 0 ? (
        <p className={styles.empty}>No open positions.</p>
      ) : (
        <ul className={styles.list}>
          {positions.map((position) => (
            <OpenPositionRow key={position.symbol} position={position} onClose={onClose} />
          ))}
        </ul>
      )}
    </section>
  )
}
