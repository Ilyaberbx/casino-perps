import { useMobileTabPanel } from './use-mobile-tab-panel'
import { TabBar } from '@/modules/shared/components/tab-bar'
import { IconSelect } from '@/modules/shared/components/icon-select'
import { SegmentedControl } from '@/modules/shared/components/segmented-control'
import { BookSidePicker } from '../book-trades-panel/BookSidePicker'
import { TAB_OPTIONS } from './mobile-tab-panel.constants'
import type { MobileTab } from './mobile-tab-panel.types'
import type { SizeAsset } from '../book-trades-panel/book-trades-panel.types'
import styles from './mobile-tab-panel.module.css'
import { LazyChart } from '../chart'
import { Orderbook } from '../orderbook'
import { TradesTape } from '../trades-tape'

export function MobileTabPanel() {
  const {
    activeTab,
    setActiveTab,
    tick,
    setTick,
    tickOptions,
    sizeAsset,
    setSizeAsset,
    sizeOptions,
    bookSide,
    setBookSide,
    baseSymbol,
    quoteSymbol,
    isChartVisible,
    isOrderbookVisible,
    isTradesVisible,
  } = useMobileTabPanel()

  return (
    <div className={styles.container}>
      <div className={styles.tabStripWrap}>
        <TabBar<MobileTab>
          tabs={TAB_OPTIONS}
          value={activeTab}
          onChange={setActiveTab}
          fitted
          size="sm"
          ariaLabel="Mobile trading tabs"
        />
      </div>
      {/* Tick aggregation + size denomination only apply to the book/trades tabs;
          the chart tab fills the panel without a controls band. */}
      {!isChartVisible && (
        <div className={styles.controlsRow}>
          <div className={styles.controlsLeft}>
            {isOrderbookVisible && <BookSidePicker value={bookSide} onChange={setBookSide} />}
            {isOrderbookVisible ? (
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
      )}
      {/* Chart stays mounted-but-hidden: lightweight-charts init is expensive,
          updates are cheap, so we pay the hidden DOM cost to keep it warm. */}
      <div
        className={isChartVisible ? styles.panel : `${styles.panel} ${styles.panelHidden}`}
        role="tabpanel"
        aria-label="Chart"
      >
        <LazyChart />
      </div>
      {/* Orderbook + trades are conditionally mounted so their venue stream
          subscriptions are released the moment their tab is hidden. */}
      {isOrderbookVisible && (
        <div className={styles.panel} role="tabpanel" aria-label="Order Book">
          {/* Full-height tab panel: render the full scrollable depth (hidden
              scrollbar) so mobile matches the desktop book — the picker switches
              both/bids/asks, deeper levels scroll within the panel. */}
          <Orderbook
            tick={tick}
            sizeAsset={sizeAsset}
            bookSide={bookSide}
            baseSymbol={baseSymbol}
            quoteSymbol={quoteSymbol}
          />
        </div>
      )}
      {isTradesVisible && (
        <div className={styles.panel} role="tabpanel" aria-label="Trades">
          <TradesTape sizeAsset={sizeAsset} baseSymbol={baseSymbol} quoteSymbol={quoteSymbol} />
        </div>
      )}
    </div>
  )
}
