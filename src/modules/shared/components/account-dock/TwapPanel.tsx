import { TabBar } from '@/modules/shared/components/tab-bar'
import styles from './account-dock.module.css'
import { useTwapPanel } from './use-twap-panel'
import { TwapActivePanel } from './TwapActivePanel'
import { TwapHistoryPanel } from './TwapHistoryPanel'
import { TwapFillHistoryPanel } from './TwapFillHistoryPanel'
import { TwapBulkCancelConfirm } from './TwapBulkCancelConfirm'
import { TWAP_SUB_TABS } from './twap-panel.constants'
import type { TwapPanelProps, TwapSubTab } from './twap-panel.types'

/**
 * The TWAP tab body. Owns its smart hook (`useTwapPanel`) — the 1s tick,
 * selection set, cancel handlers, and the History / Fill History paginated
 * readers — so `use-account-dock` stays lean. A sub-tab bar switches Active /
 * History / Fill History; only the active sub-panel mounts.
 */
export function TwapPanel({ reloadKey }: TwapPanelProps) {
  const twap = useTwapPanel(reloadKey)
  const isActiveEmpty = twap.activeTwaps.length === 0
  const showBulkCancel =
    twap.subTab === 'active' &&
    twap.hasTwapController &&
    !twap.areTwapsLoading &&
    !isActiveEmpty &&
    twap.selectedCount > 0

  return (
    <div className={styles.twapPanel}>
      <div className={styles.twapSubTabsWrap}>
        <div className={styles.twapSubTabsScroll}>
          <TabBar<TwapSubTab>
            tabs={TWAP_SUB_TABS}
            value={twap.subTab}
            onChange={twap.setSubTab}
            size="sm"
            ariaLabel="TWAP sub-tabs"
            className={styles.twapSubTabs}
          />
        </div>
        {showBulkCancel ? (
          <div className={styles.twapSubTabsToolbar}>
            <button
              type="button"
              className={styles.bulkActionButton}
              aria-label={`Cancel ${twap.selectedCount} selected TWAP orders`}
              onClick={twap.requestBulkCancel}
            >
              {`Cancel (${twap.selectedCount})`}
            </button>
          </div>
        ) : null}
      </div>
      {twap.subTab === 'active' ? (
        <TwapActivePanel
          twaps={twap.activeTwaps}
          isLoading={twap.areTwapsLoading}
          now={twap.now}
          hasTwapController={twap.hasTwapController}
          selectedIds={twap.selectedIds}
          onToggleSelected={twap.toggleSelected}
          onCancel={twap.cancelTwap}
        />
      ) : null}
      {twap.subTab === 'history' ? (
        <TwapHistoryPanel
          pagination={twap.historyPagination}
          totalCount={twap.historyCount}
          isLoading={twap.isHistoryLoading}
          historyError={twap.historyError}
        />
      ) : null}
      {twap.subTab === 'fillHistory' ? (
        <TwapFillHistoryPanel
          pagination={twap.fillHistoryPagination}
          totalCount={twap.fillHistoryCount}
          isLoading={twap.isFillHistoryLoading}
          historyError={twap.fillHistoryError}
        />
      ) : null}
      <TwapBulkCancelConfirm
        isOpen={twap.isBulkConfirmOpen}
        isMobile={twap.isMobile}
        count={twap.selectedCount}
        onConfirm={twap.confirmBulkCancel}
        onCancel={twap.dismissBulkCancel}
      />
    </div>
  )
}
