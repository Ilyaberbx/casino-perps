import styles from './market-card.module.css'
import { useMarketCard } from './use-market-card'
import type { MarketCardProps } from './market-card.types'

/**
 * Poster card for a lobby market (PRD 0008 D9). Dumb component — all state and
 * derived values come from `useMarketCard`. 3:4 poster with a deterministic neon
 * gradient, the token logo centered at ~40% of the card width (falling back to
 * the display-face initials), the ticker bottom-left, and a win/loss 24h chip
 * bottom-right.
 */
export function MarketCard(props: MarketCardProps) {
  const { gradient, logoSrc, initials, ticker, isUp, changeLabel, onLogoError } =
    useMarketCard(props)

  const changeClass = isUp
    ? `${styles.change} ${styles.changeUp}`
    : `${styles.change} ${styles.changeLoss}`

  return (
    <article className={styles.card} style={{ background: gradient }} aria-label={ticker}>
      <div className={styles.logoWrap}>
        {logoSrc ? (
          <img
            className={styles.logo}
            src={logoSrc}
            alt={ticker}
            decoding="async"
            onError={onLogoError}
          />
        ) : (
          <span className={styles.initials} aria-hidden="true">
            {initials}
          </span>
        )}
      </div>

      <div className={styles.scrim} aria-hidden="true" />

      <footer className={styles.footer}>
        <span className={styles.ticker}>{ticker}</span>
        <span className={changeClass} data-direction={isUp ? 'up' : 'down'}>
          {changeLabel}
        </span>
      </footer>
    </article>
  )
}
