import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import styles from './orderbook.module.css'
import { formatPrice, formatSize, formatTotal } from './orderbook.utils'
import type { OrderbookLevelTooltipProps } from './orderbook.types'

/**
 * Hover/focus popover for a single ladder level: the three cumulative figures
 * down to this price (VWAP, base size, quote value). Rendered through a PORTAL to
 * `document.body` and fixed-positioned to the LEFT of the hovered row, so it
 * floats OUTSIDE the order book — escaping the `.side` scroll clip and the panel
 * `overflow: hidden` that otherwise trapped it inside the book. The parent row
 * owns hover/focus and hands us the row's viewport anchor; this stays presentational.
 */
export function OrderbookLevelTooltip({
  avgPrice,
  totalBase,
  totalQuote,
  baseSymbol,
  quoteSymbol,
  priceDecimals,
  id,
  anchor,
}: OrderbookLevelTooltipProps) {
  // Fixed to the viewport: right edge just left of the row, vertically centred on it.
  const style: CSSProperties = { top: anchor.top, left: anchor.left - 8 }
  return createPortal(
    <span className={styles.tooltip} role="tooltip" id={id} style={style}>
      <span className={styles.tooltipRow}>
        <span className={styles.tooltipLabel}>Avg Price</span>
        <span className={styles.tooltipValue}>{formatPrice(avgPrice, priceDecimals)}</span>
      </span>
      <span className={styles.tooltipRow}>
        <span className={styles.tooltipLabel}>{`Total (${baseSymbol})`}</span>
        <span className={styles.tooltipValue}>{formatSize(totalBase)}</span>
      </span>
      <span className={styles.tooltipRow}>
        <span className={styles.tooltipLabel}>{`Total (${quoteSymbol})`}</span>
        <span className={styles.tooltipValue}>{formatTotal(totalQuote)}</span>
      </span>
    </span>,
    document.body,
  )
}
