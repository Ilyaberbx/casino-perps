import { formatMultiplier, symbolGradient, symbolMonogram } from '../../social.utils'
import styles from './chat-panel.module.css'
import type { WinBragCardProps } from './chat-panel.types'

export function WinBragCard({ message }: WinBragCardProps) {
  return (
    <div className={styles.winBrag} data-testid="chat-win-brag">
      <span
        className={styles.winThumb}
        style={{ background: symbolGradient(message.market) }}
        aria-hidden="true"
      >
        {symbolMonogram(message.market)}
      </span>
      <span className={styles.winCopy}>
        <span className={styles.winName} style={{ color: message.user.color }}>
          @{message.user.name}
        </span>{' '}
        <span className={styles.winMeta}>just hit on {message.market}</span>
      </span>
      <span className={styles.winMultiplier}>{formatMultiplier(message.multiplier)}</span>
    </div>
  )
}
