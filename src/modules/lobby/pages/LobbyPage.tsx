import styles from './lobby-page.module.css'

/**
 * Lobby stub (PRD 0008 D15, build order step 5).
 *
 * The `/` route. The real lobby — LIVE WINS ticker, hero banner, and poster-card
 * carousels (`Hot Markets` / `New Listings` / `All Markets`) — is built by the
 * lobby phase on top of the existing `market-card` component and gradient
 * generator. This placeholder keeps the route mountable and the app shell
 * demoable until then. The shell owns the LIVE WINS ticker above this outlet, so
 * this page renders only the carousel region.
 */
export function LobbyPage() {
  return (
    <div className={styles.page} data-testid="lobby-page">
      <section className={styles.hero} aria-label="Welcome">
        <h1 className={styles.heroTitle}>Pick a market. Place a bet.</h1>
        <p className={styles.heroSubtitle}>
          Tap a game, choose your amount, and go UP or DOWN.
        </p>
      </section>
      <p className={styles.placeholder}>Games load here soon.</p>
    </div>
  )
}
