import type { CSSProperties, FocusEvent, MouseEvent } from 'react'
import { useCallback, useState } from 'react'
import styles from './orderbook.module.css'
import { formatPrice, formatSize, formatTotal } from './orderbook.utils'
import { OrderbookLevelTooltip } from './OrderbookLevelTooltip'
import type { OrderbookLevelProps, OrderbookTooltipAnchor } from './orderbook.types'

export function OrderbookLevelRow({
  price,
  size,
  total,
  maxTotal,
  isAsk,
  priceDecimals,
  avgPrice,
  totalBase,
  totalQuote,
  baseSymbol,
  quoteSymbol,
  changeSeq,
  changeDir,
}: OrderbookLevelProps) {
  const depthScale = maxTotal > 0 ? total / maxTotal : 0
  const priceClass = isAsk ? styles.priceDown : styles.priceUp
  const depthBarClass = isAsk ? styles.depthBarAsk : styles.depthBarBid
  // Depth is driven as a 0–1 scaleX on the bar (GPU-composited, smoothly
  // transitioned in CSS) so liquidity shifts glide instead of snapping — the
  // book "breathes" (ADR-0043 / ADR-0070).
  const depthStyle = { '--depth-scale': depthScale } as CSSProperties
  const tooltipId = `orderbook-tt-${isAsk ? 'ask' : 'bid'}-${price}`
  // Value-change flash (#291): an intentional reintroduction of a subtle per-level
  // tint that ADR-0043 removed as a global per-cell key-remount. This stays cheap
  // — the flash lives on a SINGLE absolutely-positioned overlay, keyed by
  // `changeSeq`, so only a genuinely-changed row remounts one empty span (never
  // the value text, and only ~5 rows/tick) to replay the opacity keyframe. The
  // gliding depth bars remain the primary live-feedback channel and coexist.
  //
  // Colour is by SIDE, not by change direction: a buy (bid) level always flashes
  // green and a sell (ask) level always flashes red, so the book's two sides stay
  // colour-consistent (`changeDir` still gates WHETHER a row flashed at all).
  const hasFlashed = changeDir !== null
  const flashClass = isAsk ? styles.flashDown : styles.flashUp

  // Tooltip anchor: on hover/focus we capture the row's viewport rect so the
  // portalled tooltip (rendered to document.body) can float to the row's LEFT,
  // outside the book. Capturing from the event target keeps the row otherwise
  // dumb — no layout reads on the tick path, only when a row is actually hovered.
  const [anchor, setAnchor] = useState<OrderbookTooltipAnchor | null>(null)
  const showTooltip = useCallback((event: MouseEvent<HTMLDivElement> | FocusEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setAnchor({ left: rect.left, top: rect.top + rect.height / 2 })
  }, [])
  const hideTooltip = useCallback(() => setAnchor(null), [])

  return (
    <div
      className={styles.level}
      data-side={isAsk ? 'ask' : 'bid'}
      tabIndex={0}
      aria-describedby={tooltipId}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      <div className={`${styles.depthBar} ${depthBarClass}`} style={depthStyle} />
      {hasFlashed && <span key={changeSeq} className={flashClass} aria-hidden="true" />}
      <span className={`${styles.price} ${priceClass}`}>{formatPrice(price, priceDecimals)}</span>
      <span className={styles.size}>{formatSize(size)}</span>
      <span className={styles.total}>{formatTotal(total)}</span>
      {anchor && (
        <OrderbookLevelTooltip
          id={tooltipId}
          avgPrice={avgPrice}
          totalBase={totalBase}
          totalQuote={totalQuote}
          baseSymbol={baseSymbol}
          quoteSymbol={quoteSymbol}
          priceDecimals={priceDecimals}
          anchor={anchor}
        />
      )}
    </div>
  )
}
