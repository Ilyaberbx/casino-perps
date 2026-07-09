import type { ReactNode } from 'react'
import { useOutletContext } from 'react-router-dom'
import styles from './portfolio-page.module.css'
import { usePortfolioPage } from './use-portfolio-page'
import { PortfolioTileColumn } from '../components/portfolio-tile-column'
import { PortfolioSummaryCard } from '../components/portfolio-summary-card'
import { PortfolioChartCard } from '../components/portfolio-chart-card'
import { useIsWalletConnected } from '@/modules/account'
import { useIsMobile } from '@/modules/shared/hooks/use-is-mobile'
import { MobileTradeDock, TradeDockProviders } from '@/modules/trading'
import { ScrollArea } from '@/modules/shared/components/scroll-area'
import { IdleScrambleText } from '@/modules/shared/components/scramble-text'
import { AccountDock } from '@/modules/shared/components/account-dock'
import { ConnectionStatusBar } from '@/modules/shared/components/connection-status-bar'
import { ManageFundsPills } from '@/modules/shared/components/manage-funds-pills'

export function PortfolioPage() {
  const isConnected = useIsWalletConnected()
  const isMobile = useIsMobile()
  // Mobile-only app controls (venue switcher + spectate) handed down by AppShell
  // via Outlet context — rendered alongside Transfer/Deposit so the page keeps a
  // single header row instead of a second stacked bar. Null on desktop / tests.
  const outlet = useOutletContext<{ mobileHeaderControls?: ReactNode } | null>()
  const mobileHeaderControls = outlet?.mobileHeaderControls ?? null
  const {
    snapshot,
    isSnapshotLoading,
    window,
    setWindow,
    scope,
    setScope,
    chartMetric,
    setChartMetric,
    charts,
    hasPortfolio,
    spectatedAddress,
    isSegregated,
  } = usePortfolioPage()

  // No `ambient-cyan` here on purpose: the portfolio shell is the inner content
  // box inside the ScrollArea (not its own scroller like the trading shell), so
  // the glow spans the full content height and its bottom-right blob bands over
  // the empty region above the ConnectionStatusBar. It read poorly, so the
  // portfolio route stays on the plain grid background.
  const shellClassName = isMobile
    ? `${styles.shell} ${styles.shellMobile}`
    : styles.shell

  return (
    <>
    <ScrollArea ariaLabel="Portfolio page" viewportClassName={styles.scrollViewport}>
      <div className={shellClassName}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            <IdleScrambleText intervalMs={15000}>Portfolio</IdleScrambleText>
            <span className={styles.titleCursor} aria-hidden="true">_</span>
          </h1>
          {mobileHeaderControls ? (
            <div className={styles.mobileControls}>{mobileHeaderControls}</div>
          ) : null}
          <div className={styles.headerActions}>
            <ManageFundsPills />
          </div>
        </div>

        <div className={styles.topRegion}>
          <div className={styles.tileSlot}>
            <PortfolioTileColumn />
          </div>

          <div className={styles.summarySlot}>
            <PortfolioSummaryCard
              snapshot={snapshot}
              window={window}
              onWindowChange={setWindow}
              scope={scope}
              onScopeChange={setScope}
              isConnected={isConnected}
              isLoading={isSnapshotLoading}
              isSegregated={isSegregated}
            />
          </div>

          <div className={styles.chartSlot}>
            <PortfolioChartCard
              chartMetric={chartMetric}
              onChartMetricChange={setChartMetric}
              charts={charts}
              window={window}
              hasPortfolio={hasPortfolio}
            />
          </div>
        </div>

        <div className={styles.bottomRegion}>
          <div className={styles.dockCard}>
            <AccountDock reloadKey={spectatedAddress} />
          </div>
        </div>

        <div className={styles.footer}>
          <ConnectionStatusBar />
        </div>
      </div>
    </ScrollArea>
    {isMobile ? (
      <TradeDockProviders>
        <MobileTradeDock />
      </TradeDockProviders>
    ) : null}
    </>
  )
}
