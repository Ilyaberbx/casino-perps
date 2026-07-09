import { DockPanel } from './DockPanel'
import { PositionsPanel } from './PositionsPanel'
import { ClosePositionDialog } from './ClosePositionDialog'
import { PositionTpslDialog } from './PositionTpslDialog'
import { OpenOrdersPanel } from './OpenOrdersPanel'
import { ModifyOrderDialog } from './ModifyOrderDialog'
import { TwapPanel } from './TwapPanel'
import { TradeHistoryPanel } from './TradeHistoryPanel'
import { FundingHistoryPanel } from './FundingHistoryPanel'
import { OrderHistoryPanel } from './OrderHistoryPanel'
import { InterestHistoryPanel } from './InterestHistoryPanel'
import { AccountActivityPanel } from './AccountActivityPanel'
import { BalancesPanel } from './BalancesPanel'
import type { AccountDockTabPanelsProps } from './account-dock.types'

// The nine tab panels of the dock, plus the per-tab dialogs that belong inside
// a panel (close-position + tp/sl on Positions, modify-order on Open Orders).
// Dumb: every value comes from the parent's `useAccountDock` state via `dock`.
export function AccountDockTabPanels({
  dock,
  reloadKey,
  onSelectMarket,
}: AccountDockTabPanelsProps) {
  const { activeTab, orders, isMobile } = dock
  return (
    <>
      <DockPanel
        isActive={activeTab === 'balances'}
        ariaLabel="Balances"
        hasCapability
        connectMessage="Connect wallet to view balances"
      >
        <BalancesPanel />
      </DockPanel>
      <DockPanel
        isActive={activeTab === 'positions'}
        ariaLabel="Positions"
        hasCapability={dock.hasPositions}
        connectMessage="Connect wallet to view positions"
      >
        <PositionsPanel
          positionRows={dock.positionRows}
          isLoading={dock.arePositionsLoading}
          onClosePosition={dock.closePosition}
          onManagePosition={dock.openManage}
          onEditTpsl={dock.openProtection}
          onSharePosition={dock.onSharePosition}
          canShare={dock.canShare}
          onSelectPosition={onSelectMarket}
          hasTrader={dock.hasTrader}
          hasPositionProtection={dock.hasPositionProtection}
          showActionsColumn={!dock.isSpectating}
        />
        <ClosePositionDialog
          position={dock.managedPosition}
          isMobile={isMobile}
          onClose={dock.closeManage}
          onSubmit={dock.submitClose}
        />
        <PositionTpslDialog
          position={dock.protectionPosition}
          restingOrders={orders}
          isMobile={isMobile}
          onClose={dock.closeProtection}
          onSubmit={dock.submitProtection}
          onCancelOrder={dock.cancelOrder}
        />
      </DockPanel>
      <DockPanel
        isActive={activeTab === 'openOrders'}
        ariaLabel="Open Orders"
        hasCapability={dock.hasOpenOrders}
        connectMessage="Connect wallet to view open orders"
      >
        <OpenOrdersPanel
          orders={orders}
          isLoading={dock.areOpenOrdersLoading}
          onCancelOrder={dock.cancelOrder}
          onModifyOrder={dock.openModify}
          cancelError={dock.cancelError}
          hasTrader={dock.hasTrader}
          hasModifyOrder={dock.hasModifyOrder}
          showActionsColumn={!dock.isSpectating}
        />
        <ModifyOrderDialog
          order={dock.modifiedOrder}
          isMobile={isMobile}
          onClose={dock.closeModify}
          onSubmit={dock.submitModify}
        />
      </DockPanel>
      <DockPanel
        isActive={activeTab === 'twap'}
        ariaLabel="TWAP"
        hasCapability={dock.hasTwap}
        connectMessage="Connect wallet to view TWAP orders"
      >
        <TwapPanel reloadKey={reloadKey} />
      </DockPanel>
      <DockPanel
        isActive={activeTab === 'tradeHistory'}
        ariaLabel="Trade History"
        hasCapability={dock.hasTradeHistory}
        connectMessage="Connect wallet to view trade history"
      >
        <TradeHistoryPanel
          pagination={dock.fillsPagination}
          totalCount={dock.fillsCount}
          isLoading={dock.isLoadingOlderFills}
          historyError={dock.fillsHistoryError}
          onShareFill={dock.onShareFill}
          canShare={dock.canShare}
        />
      </DockPanel>
      <DockPanel
        isActive={activeTab === 'fundingHistory'}
        ariaLabel="Funding History"
        hasCapability={dock.hasFundingHistory}
        connectMessage="Connect wallet to view funding history"
      >
        <FundingHistoryPanel
          pagination={dock.fundingPagination}
          totalCount={dock.fundingCount}
          isLoading={dock.isLoadingFunding}
          historyError={dock.fundingError}
        />
      </DockPanel>
      <DockPanel
        isActive={activeTab === 'orderHistory'}
        ariaLabel="Order History"
        hasCapability={dock.hasOrderHistory}
        connectMessage="Connect wallet to view order history"
      >
        <OrderHistoryPanel
          pagination={dock.ordersPagination}
          totalCount={dock.ordersCount}
          isLoading={dock.isLoadingOrderHistory}
          historyError={dock.orderHistoryError}
        />
      </DockPanel>
      <DockPanel
        isActive={activeTab === 'interestHistory'}
        ariaLabel="Interest History"
        hasCapability={dock.hasInterestHistory}
        connectMessage="Connect wallet to view interest history"
      >
        <InterestHistoryPanel
          pagination={dock.interestPagination}
          totalCount={dock.interestCount}
          isLoading={dock.isLoadingInterest}
          historyError={dock.interestError}
        />
      </DockPanel>
      <DockPanel
        isActive={activeTab === 'accountActivity'}
        ariaLabel="Account Activity"
        hasCapability={dock.hasAccountActivity}
        connectMessage="Connect wallet to view account activity"
      >
        <AccountActivityPanel
          pagination={dock.activityPagination}
          totalCount={dock.activityCount}
          isLoading={dock.isLoadingActivity}
          historyError={dock.activityError}
          explorerTxUrl={dock.explorerTxUrl}
        />
      </DockPanel>
    </>
  )
}
