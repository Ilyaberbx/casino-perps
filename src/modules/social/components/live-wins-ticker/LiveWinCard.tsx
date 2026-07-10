import { formatUsd, symbolGradient, symbolMonogram } from '../../social.utils'
import styles from './live-wins-ticker.module.css'
import type { LiveWinCardProps } from './live-wins-ticker.types'

export function LiveWinCard({ win, ariaHidden = false }: LiveWinCardProps) {
  return (
    <li className={styles.card} aria-hidden={ariaHidden || undefined}>
      <span
        className={styles.cardThumb}
        style={{ background: symbolGradient(win.market) }}
        aria-hidden="true"
      >
        {symbolMonogram(win.market)}
      </span>
      <span className={styles.cardMeta}>
        <span className={styles.cardUser}>{win.username}</span>
        <span className={styles.cardAmount}>{formatUsd(win.amountUsd)}</span>
      </span>
    </li>
  )
}
