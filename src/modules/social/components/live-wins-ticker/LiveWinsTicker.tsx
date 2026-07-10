import { LiveWinCard } from './LiveWinCard'
import { useLiveWins } from './use-live-wins'
import styles from './live-wins-ticker.module.css'

export function LiveWinsTicker() {
  const { wins, isAnimated } = useLiveWins()
  const trackClass = isAnimated ? `${styles.track} ${styles.animated}` : styles.track

  return (
    <section className={styles.ticker} aria-label="Live wins">
      <span className={styles.badge}>
        <span className={styles.badgeDot} aria-hidden="true" />
        Live Wins
      </span>
      <div className={styles.viewport}>
        <ul className={trackClass} data-testid="live-wins-track">
          {wins.map((win) => (
            <LiveWinCard key={win.id} win={win} />
          ))}
          {isAnimated &&
            wins.map((win) => <LiveWinCard key={`dup-${win.id}`} win={win} ariaHidden />)}
        </ul>
      </div>
    </section>
  )
}
