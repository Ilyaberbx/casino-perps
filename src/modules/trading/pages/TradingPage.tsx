import { LazyChart } from '../components/chart'
import { TopBar } from '../components/top-bar'
import { SimpleOrderTicket } from '../components/order-entry'
import { FavoritesProvider } from '../providers/favorites-provider'
import styles from './trading-page.module.css'

/**
 * The trade screen. Market strip, price chart, and a real order ticket: market
 * by default, limit via the price-target toggle, with leverage, margin mode,
 * USD⇄coin sizing off buying power, and the venue's own liquidation + fee
 * estimates before you commit.
 *
 * This replaced the casino bet ticket (bet-amount chips, a "multiplier" slider,
 * UP/DOWN). The order ticket is the long-standing `order-entry` tree, which was
 * always here — it had simply been left unmounted.
 *
 * `FavoritesProvider` is here because `TopBar`'s favourite star reads it.
 */
export function TradingPage() {
  return (
    <FavoritesProvider>
      <div className={`${styles.shell} ambient-cyan`} data-testid="trading-shell">
        <div className={styles.marketStrip}>
          <TopBar />
        </div>

        <div className={styles.chartCard}>
          <LazyChart />
        </div>

        <div className={styles.ticketCard}>
          <SimpleOrderTicket />
        </div>
      </div>
    </FavoritesProvider>
  )
}
