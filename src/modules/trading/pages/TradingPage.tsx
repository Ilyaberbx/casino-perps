import { useTradingPage } from './use-trading-page'
import styles from './trading-page.module.css'
import { TopBar } from '../components/top-bar'
import { LazyChart } from '../components/chart'
import { OrderEntry } from '../components/order-entry'
import { TradeEquityCard } from '../components/trade-equity-card'
import { AccountDock } from '@/modules/shared/components/account-dock'
import { ConnectionStatusBar } from '@/modules/shared/components/connection-status-bar'
import { MobileTradeDock } from '../components/mobile-trade-dock'
import { FavoritesProvider } from '../providers/favorites-provider'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import { Sheet } from '@/modules/shared/components/Sheet'

export function TradingPage() {
  const {
    isMobile,
    spectatedAddress,
    setSelectedMarket,
    mobileHeaderControls,
    isOrderSheetOpen,
    openOrderSheet,
    closeOrderSheet,
  } = useTradingPage()

  if (isMobile) {
    return (
      <FavoritesProvider>
        <div className={styles.mobileShell} data-testid="trading-shell-mobile" data-mode="simple">
          <header className={styles.mobileHeader} data-testid="trading-mobile-header">
            {/* The app controls (spectate / wallet / venue) ride in TopBar's
                identity row via `mobileAction`, beside the Place Order button — so
                the TopBar spans the full width. */}
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
            <div className={`${styles.pane} ${styles.mobileChartCard} ${styles.mobileSimpleChartCard}`}>
              <div className={styles.mobileSimpleChart} data-testid="trading-mobile-simple-chart">
                <LazyChart />
              </div>
            </div>
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
            <div className={`${styles.pane} ${styles.chartCard}`} data-testid="trading-chart-card">
              <div className={styles.chartColumn}>
                <div className={styles.marketStrip}>
                  <TopBar />
                </div>
                <div className={styles.chartArea}>
                  <LazyChart />
                </div>
              </div>
            </div>
            <div className={`${styles.pane} ${styles.positionsCard}`} data-testid="trading-positions-card">
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
      </div>
    </FavoritesProvider>
  )
}
