import { useTradingPage } from './use-trading-page'
import styles from './trading-page.module.css'
import { TopBar } from '../components/top-bar'
import { LazyChart } from '../components/chart'
import { BookTradesPanel } from '../components/book-trades-panel'
import { MobileTabPanel } from '../components/mobile-tab-panel'
import { MobileSimpleBook } from '../components/mobile-simple-book'
import { OrderEntry } from '../components/order-entry'
import { TradeEquityCard } from '../components/trade-equity-card'
import { AccountDock } from '@/modules/shared/components/account-dock'
import { ConnectionStatusBar } from '@/modules/shared/components/connection-status-bar'
import { MobileTradeDock } from '../components/mobile-trade-dock'
import { PerpSuggestionSheet, PerpSuggestionToggle } from '../components/perp-suggestion-sheet'
import { SuggestionPreviewSheet } from '../components/suggestion-preview'
import { FavoritesProvider } from '../providers/favorites-provider'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import { Sheet } from '@/modules/shared/components/Sheet'

export function TradingPage() {
  const {
    isMobile,
    isSimpleMode,
    spectatedAddress,
    setSelectedMarket,
    mobileHeaderControls,
    isOrderSheetOpen,
    openOrderSheet,
    closeOrderSheet,
    dockRef,
    isAiToggleHidden,
  } = useTradingPage()

  if (isMobile) {
    return (
      <FavoritesProvider>
        <div
          className={styles.mobileShell}
          data-testid="trading-shell-mobile"
          data-mode={isSimpleMode ? 'simple' : 'pro'}
        >
          <header className={styles.mobileHeader} data-testid="trading-mobile-header">
            {/* The app controls (spectate / wallet / venue) ride in TopBar's
                identity row via `mobileAction`, beside the Place Order button — so
                the TopBar spans the full width and the price + ticker-stat rows
                below are no longer squeezed by a right-hand controls column. */}
            <TopBar
              mobileAction={
                <>
                  <PixelButton
                    variant="accentFilled"
                    size="sm"
                    elevated
                    onClick={openOrderSheet}
                    aria-label="Place order"
                    data-testid="mobile-place-order-button"
                  >
                    Order
                  </PixelButton>
                  {mobileHeaderControls}
                </>
              }
            />
          </header>
          <div className={styles.mobileScrollBody} data-testid="trading-mobile-scroll-body">
            {/* Simple mode drops the Chart/Order Book/Trades tab terminal (and its
                depth-aggregation + size-denomination controls) for a compact chart
                plus one combined book+trades card — keeping live depth and prints
                without the pro terminal's switching and pickers. */}
            {isSimpleMode ? (
              <>
                <div className={`${styles.pane} ${styles.mobileChartCard} ${styles.mobileSimpleChartCard}`}>
                  <div className={styles.mobileSimpleChart} data-testid="trading-mobile-simple-chart">
                    <LazyChart />
                  </div>
                </div>
                <div
                  className={`${styles.pane} ${styles.mobileSimpleBookCard}`}
                  data-testid="trading-mobile-simple-book"
                >
                  <MobileSimpleBook />
                </div>
              </>
            ) : (
              <div className={`${styles.pane} ${styles.mobileChartCard}`}>
                <MobileTabPanel />
              </div>
            )}
            <div className={`${styles.pane} ${styles.mobileEquityCard}`}>
              <TradeEquityCard />
            </div>
            <div className={`${styles.pane} ${styles.mobileAccountDockCard}`}>
              <AccountDock reloadKey={spectatedAddress} onSelectMarket={setSelectedMarket} />
            </div>
          </div>
          <Sheet
            isOpen={isOrderSheetOpen}
            onClose={closeOrderSheet}
            side="bottom"
            ariaLabel="Place order"
            title="Place Order"
          >
            <OrderEntry />
          </Sheet>
          <MobileTradeDock />
        </div>
      </FavoritesProvider>
    )
  }

  return (
    <FavoritesProvider>
      <div className={`${styles.shell} ambient-cyan`} data-testid="trading-shell-desktop">
        <div className={styles.body}>
          <div className={styles.leftColumn} data-testid="trading-left-column">
            <div
              className={`${styles.pane} ${styles.chartCard}`}
              data-testid="trading-chart-card"
            >
              <div className={styles.chartColumn}>
                <div className={styles.marketStrip}>
                  <TopBar />
                </div>
                <div className={styles.chartArea}>
                  <LazyChart />
                </div>
              </div>
              <div className={styles.orderbookRail}>
                <BookTradesPanel />
              </div>
            </div>
            <div
              ref={dockRef}
              className={`${styles.pane} ${styles.positionsCard}`}
              data-testid="trading-positions-card"
            >
              <AccountDock reloadKey={spectatedAddress} onSelectMarket={setSelectedMarket} />
            </div>
          </div>
          <div className={styles.rightColumn} data-testid="trading-right-column">
            <div className={`${styles.pane} ${styles.orderEntryCard}`}>
              <OrderEntry />
            </div>
            <div className={`${styles.pane} ${styles.equityCard}`} data-testid="trading-equity-card">
              <TradeEquityCard />
            </div>
          </div>
        </div>
        <div className={styles.footer}>
          <ConnectionStatusBar />
        </div>
        {/* Viewport-fixed AI toggle, flush to the page's left edge, floating over
            the chart's left edge. It slides off the edge (`isAiToggleHidden`,
            from the dock IntersectionObserver in use-trading-page) while the
            AccountDock is scrolled into its row, so it never covers the dock. */}
        <PerpSuggestionToggle hidden={isAiToggleHidden} />
        <PerpSuggestionSheet />
        <SuggestionPreviewSheet />
      </div>
    </FavoritesProvider>
  )
}
