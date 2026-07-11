import { useWinBragCard } from './use-win-brag-card'
import styles from './chat-panel.module.css'
import type { WinBragCardProps } from './chat-panel.types'

export function WinBragCard({ message }: WinBragCardProps) {
  const { gradient, iconSrc, monogram, multiplierLabel, onIconError } = useWinBragCard({
    message,
  })

  return (
    <div className={styles.winBrag} data-testid="chat-win-brag">
      <span className={styles.winThumb} style={{ background: gradient }} aria-hidden="true">
        {iconSrc ? (
          <img
            className={styles.winThumbIcon}
            src={iconSrc}
            alt=""
            decoding="async"
            loading="lazy"
            onError={onIconError}
          />
        ) : (
          monogram
        )}
      </span>
      <span className={styles.winCopy}>
        <span className={styles.winName} style={{ color: message.user.color }}>
          @{message.user.name}
        </span>{' '}
        <span className={styles.winMeta}>just hit on {message.market}</span>
      </span>
      <span className={styles.winMultiplier}>{multiplierLabel}</span>
    </div>
  )
}
