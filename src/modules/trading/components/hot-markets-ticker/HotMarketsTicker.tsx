import type { CSSProperties } from 'react'
import { useHotMarketsTicker } from './use-hot-markets-ticker'
import { HotMarketItem } from './HotMarketItem'
import { HotMarketsTickerSkeleton } from './HotMarketsTickerSkeleton'
import styles from './hot-markets-ticker.module.css'

/**
 * The global-header "hot markets" running row: a seamless, looping marquee of
 * the selected DEX's top markets by 24h volume. The track holds two identical
 * groups and translates by -50% so the loop wraps without a seam; the second
 * group is `aria-hidden` (decorative duplicate). Edge fade + reduced-motion
 * fallback live in the stylesheet. Dumb — all state in `useHotMarketsTicker`.
 */
export function HotMarketsTicker() {
  const { isLoading, hotMarkets, activeSymbol, marqueeDurationSec, onSelect } =
    useHotMarketsTicker()

  if (isLoading) {
    return (
      <div className={styles.band} aria-label="Hot markets">
        <HotMarketsTickerSkeleton />
      </div>
    )
  }

  if (hotMarkets.length === 0) return null

  const scrollerStyle = { '--hot-duration': `${marqueeDurationSec}s` } as CSSProperties

  const items = hotMarkets.map((market) => (
    <HotMarketItem
      key={market.symbol}
      market={market}
      isActive={market.symbol === activeSymbol}
      onSelect={onSelect}
    />
  ))
  const duplicateItems = hotMarkets.map((market) => (
    <HotMarketItem
      key={`dup-${market.symbol}`}
      market={market}
      isActive={false}
      onSelect={onSelect}
    />
  ))

  return (
    <div className={styles.band} aria-label="Hot markets">
      <div className={styles.viewport}>
        <div className={styles.scroller} style={scrollerStyle}>
          <ul className={styles.group}>{items}</ul>
          <ul className={styles.group} aria-hidden="true">
            {duplicateItems}
          </ul>
        </div>
      </div>
    </div>
  )
}
