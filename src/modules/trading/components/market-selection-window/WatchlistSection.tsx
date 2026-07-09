import styles from './market-selection-window.module.css'
import { MarketRow } from './MarketRow'
import type { WatchlistSectionProps } from './market-selection-window.types'

/**
 * Dumb section component for the watchlist (favorited markets).
 * Returns null when rows is empty — entirely hidden per UI-SPEC §6.
 * Zero hooks. All rows are known favorites so isFavorite(symbol) always true
 * for watchlist rows, but we pass the hook-derived isFavorite callback
 * for consistency (star state reflects live favorites store).
 */
export function WatchlistSection({
  rows,
  selectedMarket,
  isFavorite,
  onSelectMarket,
  onToggleFavorite,
}: WatchlistSectionProps) {
  const isEmpty = rows.length === 0
  if (isEmpty) return null

  return (
    <div className={styles.watchlistSection}>
      <div className={styles.watchlistHeading}>WATCHLIST</div>
      {rows.map((market) => (
        <MarketRow
          key={market.symbol}
          market={market}
          isFavorite={isFavorite(market.symbol)}
          isSelected={market.symbol === selectedMarket}
          onSelect={onSelectMarket}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
      <div className={styles.watchlistDivider} />
    </div>
  )
}
