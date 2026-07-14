import { LazyChart } from '../components/chart'
import { TopBar } from '../components/top-bar'
import { SimpleOrderTicket } from '../components/order-entry'
import { PositionPanel } from '../components/position-panel'
import { FavoritesProvider } from '../providers/favorites-provider'
import styles from './trading-page.module.css'

/**
 * The trade screen. Market strip, price chart, your open position in this market
 * (when there is one), and a real order ticket: market by default, limit via the
 * price-target toggle, with leverage, margin mode, USD⇄coin sizing off buying
 * power, and the venue's own liquidation + fee estimates before you commit.
 *
 * This replaced the casino bet ticket (bet-amount chips, a "multiplier" slider,
 * UP/DOWN). The order ticket is the long-standing `order-entry` tree, which was
 * always here — it had simply been left unmounted.
 *
 * The position panel sits ABOVE the ticket rather than replacing it: on a screen
 * you can both open and manage a position from, hiding the ticket behind an
 * extra tap the moment you are in a trade is the wrong trade-off — adding to or
 * hedging a position is a normal thing to want.
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

        {/* Renders nothing when flat — it carries its own card chrome so no
            empty bordered box is left behind. */}
        <PositionPanel />

        <div className={styles.ticketCard}>
          <SimpleOrderTicket />
        </div>
      </div>
    </FavoritesProvider>
  )
}
