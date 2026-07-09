import { useBookTradesPanel } from './use-book-trades-panel'
import { BookSidePicker } from './BookSidePicker'
import { Orderbook } from '../orderbook'
import { TradesTape } from '../trades-tape'
import { TabBar } from '@/modules/shared/components/tab-bar'
import { IconSelect } from '@/modules/shared/components/icon-select'
import { SegmentedControl } from '@/modules/shared/components/segmented-control'
import { useIsMobile } from '@/modules/shared/hooks/use-is-mobile'
import { MOBILE_VISIBLE_DEPTH } from '../orderbook/orderbook.constants'
import { BOOK_TRADES_TABS } from './book-trades-panel.constants'
import type { BookTradesTab, SizeAsset } from './book-trades-panel.types'
import { formatTick } from '../orderbook/orderbook.utils'
import styles from './book-trades-panel.module.css'

const TAB_OPTIONS = BOOK_TRADES_TABS.map((tab) => ({ value: tab.value, label: tab.label }))

export function BookTradesPanel() {
  const {
    activeTab,
    setActiveTab,
    tick,
    setTick,
    tickLadder,
    sizeAsset,
    setSizeAsset,
    bookSide,
    setBookSide,
    baseSymbol,
    quoteSymbol,
  } = useBookTradesPanel()
  const isMobile = useIsMobile()

  // Mobile stacks the book in a short rail under the chart; the full 11-deep
  // ladder would crush each row to a few unreadable pixels, so render a shallower
  // book there. Desktop keeps the default depth (passing undefined).
  const visibleDepth = isMobile ? MOBILE_VISIBLE_DEPTH : undefined

  const isOrderBookVisible = activeTab === 'order-book'
  const isTradesVisible = activeTab === 'trades'

  const tickOptions = tickLadder.map((option) => ({
    value: String(option),
    label: formatTick(option),
  }))

  const sizeOptions: ReadonlyArray<{ value: SizeAsset; label: string }> = [
    { value: 'base', label: baseSymbol },
    { value: 'quote', label: quoteSymbol },
  ]

  return (
    <div className={styles.container}>
      <TabBar<BookTradesTab>
        tabs={TAB_OPTIONS}
        value={activeTab}
        onChange={setActiveTab}
        fitted
        size="sm"
        ariaLabel="Book/Trades tabs"
      />
      <div className={styles.controlsRow}>
        <div className={styles.controlsLeft}>
          {isOrderBookVisible && <BookSidePicker value={bookSide} onChange={setBookSide} />}
          {isOrderBookVisible ? (
            <IconSelect
              options={tickOptions}
              value={String(tick)}
              onChange={(value) => setTick(Number(value))}
              ariaLabel="Price aggregation"
              className={styles.tickSelect}
            />
          ) : (
            <span className={styles.controlsSpacer} />
          )}
        </div>
        <SegmentedControl<SizeAsset>
          options={sizeOptions}
          value={sizeAsset}
          onChange={setSizeAsset}
          ariaLabel="Size denomination"
        />
      </div>
      {/* Both panels stay mounted so their venue-stream subscriptions stay warm
          (the socket is reader-multiplexed; unmounting would flash a skeleton on
          return via resetOnSubscribe). The inactive one renders a null body via
          `isActive={false}`, so only the visible panel reconciles its row subtree
          per animation frame. The wrapper keeps `panelHidden` (display:none) on
          the inactive tab: it removes the empty wrapper from the column layout and
          its display:none→flex toggle replays the panelIn enter animation on switch. */}
      <div
        className={isOrderBookVisible ? styles.panel : `${styles.panel} ${styles.panelHidden}`}
        role="tabpanel"
        aria-label="Order Book"
      >
        <Orderbook
          tick={tick}
          sizeAsset={sizeAsset}
          bookSide={bookSide}
          baseSymbol={baseSymbol}
          quoteSymbol={quoteSymbol}
          visibleDepth={visibleDepth}
          isActive={isOrderBookVisible}
        />
      </div>
      <div
        className={isTradesVisible ? styles.panel : `${styles.panel} ${styles.panelHidden}`}
        role="tabpanel"
        aria-label="Trades"
      >
        <TradesTape
          sizeAsset={sizeAsset}
          baseSymbol={baseSymbol}
          quoteSymbol={quoteSymbol}
          isActive={isTradesVisible}
        />
      </div>
    </div>
  )
}
