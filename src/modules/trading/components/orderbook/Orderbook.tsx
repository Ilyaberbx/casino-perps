import { useOrderbook } from './use-orderbook'
import { OrderbookLevelRow } from './OrderbookLevel'
import { RowsSkeleton } from '../rows-skeleton/RowsSkeleton'
import styles from './orderbook.module.css'
import { useSelectedMarketContext } from '../../providers/selected-market-provider'
import { SUBSCRIPTION_KEY_NONE } from '../../trading.constants'
import { SKELETON_ROWS } from './orderbook.constants'
import { formatPrice, resolveOrderbookLayout } from './orderbook.utils'
import type { MidDirection, OrderbookProps, OrderbookSideProps, SpreadRowProps } from './orderbook.types'

const MID_ARROW_CLASS: Record<MidDirection, string> = {
  up: styles.midArrowUp,
  down: styles.midArrowDown,
  flat: styles.midArrowFlat,
}

/** One scrollable price ladder (asks or bids). Best-priced level is index 0. */
function OrderbookSide({
  rows,
  maxTotal,
  isAsk,
  priceDecimals,
  baseSymbol,
  quoteSymbol,
  className,
}: OrderbookSideProps) {
  return (
    <div className={className}>
      {rows.map((row) => (
        <OrderbookLevelRow
          key={row.price}
          price={row.price}
          size={row.size}
          total={row.total}
          maxTotal={maxTotal}
          isAsk={isAsk}
          priceDecimals={priceDecimals}
          avgPrice={row.avgPrice}
          totalBase={row.totalBase}
          totalQuote={row.totalQuote}
          baseSymbol={baseSymbol}
          quoteSymbol={quoteSymbol}
          changeSeq={row.changeSeq}
          changeDir={row.changeDir}
        />
      ))}
    </div>
  )
}

/** nado-style spread row: mid + directional arrow on the left, `Spread : %` right. */
function SpreadRow({ mid, midDirection, spreadPercent, priceDecimals }: SpreadRowProps) {
  const isDown = midDirection === 'down'
  const arrowGlyph = isDown ? '▼' : '▲'
  const hasMid = mid > 0
  const midText = hasMid ? formatPrice(mid, priceDecimals) : '--'
  return (
    <div className={styles.spread}>
      <span className={styles.midGroup}>
        <span className={MID_ARROW_CLASS[midDirection]} aria-hidden="true">
          {arrowGlyph}
        </span>
        <span className={styles.midValue}>{midText}</span>
      </span>
      <span className={styles.spreadInfo}>{`Spread : ${spreadPercent}%`}</span>
    </div>
  )
}

export function Orderbook({ tick, sizeAsset, bookSide, baseSymbol, quoteSymbol, visibleDepth, isActive = true }: OrderbookProps) {
  const { market } = useSelectedMarketContext()
  const {
    isLoading,
    bidsWithTotals,
    asksWithTotals,
    maxBidTotal,
    maxAskTotal,
    spreadPercent,
    mid,
    midDirection,
    priceDecimals,
  } = useOrderbook({
    symbol: market.hlCoin ?? SUBSCRIPTION_KEY_NONE,
    tick,
    sizeAsset,
    visibleDepth,
  })

  // Inactive tab: keep the hook above mounted+subscribed (its stream stays warm)
  // but render no row subtree, so nothing reconciles per animation frame while
  // the book is hidden. Must sit AFTER the hook so the subscription survives.
  if (!isActive) return null

  const skeletonRows = visibleDepth === undefined ? SKELETON_ROWS : visibleDepth * 2 + 1

  if (isLoading) {
    return <RowsSkeleton rows={skeletonRows} />
  }

  const sizeUnit = sizeAsset === 'quote' ? quoteSymbol : baseSymbol
  const { showAsks, showBids, spreadPosition } = resolveOrderbookLayout(bookSide)
  const spreadRow = (
    <SpreadRow
      mid={mid}
      midDirection={midDirection}
      spreadPercent={spreadPercent}
      priceDecimals={priceDecimals}
    />
  )

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerCell}>Price</span>
        <span className={styles.headerCell}>{`Size (${sizeUnit})`}</span>
        <span className={styles.headerCell}>{`Total (${sizeUnit})`}</span>
      </div>
      {spreadPosition === 'top' && spreadRow}
      {showAsks && (
        <OrderbookSide
          rows={asksWithTotals}
          maxTotal={maxAskTotal}
          isAsk={true}
          priceDecimals={priceDecimals}
          baseSymbol={baseSymbol}
          quoteSymbol={quoteSymbol}
          className={`${styles.side} ${styles.asksSide}`}
        />
      )}
      {spreadPosition === 'middle' && spreadRow}
      {showBids && (
        <OrderbookSide
          rows={bidsWithTotals}
          maxTotal={maxBidTotal}
          isAsk={false}
          priceDecimals={priceDecimals}
          baseSymbol={baseSymbol}
          quoteSymbol={quoteSymbol}
          className={styles.side}
        />
      )}
      {spreadPosition === 'bottom' && spreadRow}
    </div>
  )
}
