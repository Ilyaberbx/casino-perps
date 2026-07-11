import { useLiveWinCard } from './use-live-win-card'
import styles from './live-wins-ticker.module.css'
import type { LiveWinCardProps } from './live-wins-ticker.types'

/**
 * One LIVE WINS tile — a mini poster: the market's deterministic gradient with
 * the real token icon over it (monogram fallback), username + green amount
 * below, mirroring yeet's game-art win thumbs.
 */
export function LiveWinCard({ win, ariaHidden = false }: LiveWinCardProps) {
  const { gradient, iconSrc, monogram, username, amountLabel, onIconError } =
    useLiveWinCard({ win })

  return (
    <li className={styles.card} aria-hidden={ariaHidden || undefined}>
      <span className={styles.cardThumb} style={{ background: gradient }} aria-hidden="true">
        {iconSrc ? (
          <img
            className={styles.cardThumbIcon}
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
      <span className={styles.cardMeta}>
        <span className={styles.cardUser}>{username}</span>
        <span className={styles.cardAmount}>{amountLabel}</span>
      </span>
    </li>
  )
}
