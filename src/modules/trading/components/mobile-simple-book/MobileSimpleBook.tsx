import { useMobileSimpleBook } from './use-mobile-simple-book'
import { Orderbook } from '../orderbook'
import { TradesTape } from '../trades-tape'
import { SIMPLE_BOOK_DEPTH } from './mobile-simple-book.constants'
import styles from './mobile-simple-book.module.css'

/**
 * Simple-mode combined book + trades. Stacks a shallow `Orderbook` (depth bars +
 * spread retained) above a compact `TradesTape` (Time/Price/Size only) in one
 * card — no Chart/Book/Trades tabs and no tick/size pickers, so a casual trader
 * still sees live depth and prints without the pro terminal's controls.
 */
export function MobileSimpleBook() {
  const { tick, sizeAsset, baseSymbol, quoteSymbol } = useMobileSimpleBook()

  return (
    <div className={styles.root}>
      <div className={styles.section}>
        <span className={styles.sectionLabel}>Order Book</span>
        <div className={styles.book}>
          <Orderbook
            tick={tick}
            sizeAsset={sizeAsset}
            bookSide="both"
            baseSymbol={baseSymbol}
            quoteSymbol={quoteSymbol}
            visibleDepth={SIMPLE_BOOK_DEPTH}
          />
        </div>
      </div>
      <div className={styles.section}>
        <span className={styles.sectionLabel}>Recent Trades</span>
        <div className={styles.trades}>
          <TradesTape sizeAsset={sizeAsset} baseSymbol={baseSymbol} quoteSymbol={quoteSymbol} compact />
        </div>
      </div>
    </div>
  )
}
