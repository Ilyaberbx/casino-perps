import { Link } from 'react-router-dom'
import { MarketCard, MarketCardSkeleton } from '../market-card'
import { tradeHref } from '../../utils/trade-href'
import { toChangePct } from '../../utils/to-change-pct'
import { GRID_SKELETON_KEYS } from './market-grid.constants'
import styles from './market-grid.module.css'
import type { MarketGridProps } from './market-grid.types'

/**
 * A focused lobby view (`/?view=hot|new|favorites|recent`): an icon + title over
 * a wrapping grid of poster cards. The grid counterpart to `MarketCarousel` —
 * same cards, same `/trade/:symbol` links, but no horizontal scroll, no arrows,
 * and no "See all" (a focused view *is* the see-all).
 *
 * Fully dumb: zero local state, so no hook. Data and copy come from `useLobby`
 * via the page.
 */
export function MarketGrid({ title, icon: Icon, markets, isLoading, emptyMessage }: MarketGridProps) {
  const isEmpty = !isLoading && markets.length === 0

  return (
    <section className={styles.section} aria-label={title}>
      <header className={styles.header}>
        <Icon className={styles.icon} size={18} aria-hidden="true" />
        <h2 className={styles.title}>{title}</h2>
      </header>

      {isEmpty ? (
        <p className={styles.empty}>{emptyMessage}</p>
      ) : (
        <div className={styles.grid}>
          {isLoading
            ? GRID_SKELETON_KEYS.map((key) => (
                <div key={key} className={styles.cell}>
                  <MarketCardSkeleton />
                </div>
              ))
            : markets.map((market) => (
                <Link
                  key={market.symbol}
                  className={styles.cell}
                  to={tradeHref(market.symbol)}
                  aria-label={market.symbol}
                >
                  <MarketCard symbol={market.symbol} changePct={toChangePct(market.change24hPct)} />
                </Link>
              ))}
        </div>
      )}
    </section>
  )
}
