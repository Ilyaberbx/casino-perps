import { useAccountDock } from './use-account-dock'
import { AccountDockTabPanels } from './AccountDockTabPanels'
import { AccountDockDialogs } from './AccountDockDialogs'
import { TabBar } from '@/modules/shared/components/tab-bar'
import styles from './account-dock.module.css'
import { DOCK_TABS } from './account-dock.constants'
import { dockTabLabel } from './account-dock.utils'
import type { AccountDockProps, DockTab } from './account-dock.types'

export function AccountDock({ reloadKey, onSelectMarket }: AccountDockProps) {
  const dock = useAccountDock(reloadKey)

  // Live counts on the bounded current-state tabs (trade.xyz parity). History
  // tabs are unbounded/paginated, so they stay count-less.
  const tabCounts: Partial<Record<DockTab, number>> = {
    positions: dock.positionRows.length,
    openOrders: dock.orders.length,
    twap: dock.activeTwaps.length,
  }
  const tabs = DOCK_TABS.map((tab) => ({
    value: tab.value,
    label: dockTabLabel(tab.label, tabCounts[tab.value]),
  }))

  return (
    <div className={styles.container}>
      {/* Desktop + mobile: the 9 tabs live in a single horizontal-scroll row —
          never wrap, never scroll vertically. `grow` lets them stretch to fill a
          wide dock edge-to-edge while still scrolling when the container is too
          narrow. The base `.list` (overflow-x:auto, overflow-y:hidden) owns the
          scroll; the `.tabsWrap` right-edge fade signals more tabs lie off-screen. */}
      <div className={styles.tabsWrap}>
        <div className={styles.dockTabsScroll}>
          <TabBar<DockTab>
            tabs={tabs}
            value={dock.activeTab}
            onChange={dock.setActiveTab}
            size="sm"
            wrap={false}
            grow
            ariaLabel="Account dock tabs"
            className={styles.dockTabs}
          />
        </div>
        {dock.toolbarAction ? (
          <div className={styles.tabsToolbar}>
            <button
              type="button"
              className={styles.bulkActionButton}
              aria-label={dock.toolbarAction.ariaLabel}
              onClick={dock.toolbarAction.onClick}
            >
              {dock.toolbarAction.label}
            </button>
          </div>
        ) : null}
      </div>
      <AccountDockTabPanels
        dock={dock}
        reloadKey={reloadKey}
        onSelectMarket={onSelectMarket}
      />
      <AccountDockDialogs
        pendingBulkAction={dock.pendingBulkAction}
        bulkActionCount={dock.bulkActionCount}
        isMobile={dock.isMobile}
        shareView={dock.shareView}
        onConfirmBulkAction={dock.confirmBulkAction}
        onDismissBulkAction={dock.dismissBulkAction}
        onCloseShare={dock.closeShare}
      />
    </div>
  )
}
