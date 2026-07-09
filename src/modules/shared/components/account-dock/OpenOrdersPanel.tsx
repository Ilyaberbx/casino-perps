import styles from './account-dock.module.css'
import { OrderRow } from './OrderRow'
import { PlaceholderMessage } from '@/modules/shared/components/placeholder-message'
import { TableSkeleton } from '@/modules/shared/components/table-skeleton'
import { LoadingReveal } from '@/modules/shared/components/loading-reveal'
import { DOCK_SKELETON_ROWS, DOCK_TABLE_COLUMNS } from './account-dock.constants'
import { FitCell } from '@/modules/shared/components/fit-cell'
import type { OpenOrdersPanelProps } from './account-dock.types'

export function OpenOrdersPanel({
  orders,
  isLoading,
  onCancelOrder,
  onModifyOrder,
  cancelError,
  hasTrader,
  hasModifyOrder,
  showActionsColumn,
}: OpenOrdersPanelProps) {
  const isEmpty = orders.length === 0
  const hasError = cancelError !== null
  // Spectating drops the Actions column entirely — header cell, body cells, and
  // its grid track — so the header and rows stay aligned with one fewer column.
  const headerGridClass = showActionsColumn ? styles.ordersHeader : styles.ordersHeaderSpectate
  const skeletonGrid = showActionsColumn ? 'var(--orders-grid)' : 'var(--orders-grid-spectate)'
  const skeletonColumns = showActionsColumn
    ? DOCK_TABLE_COLUMNS.openOrders
    : DOCK_TABLE_COLUMNS.openOrders - 1

  return (
    <>
      <div className={styles.tableScroll}>
      <div className={`${styles.tableHeader} ${headerGridClass}`}>
        <span className={styles.headerCell}>
          <FitCell className={styles.headerFit}>Time</FitCell>
        </span>
        <span className={styles.headerCell}>
          <FitCell className={styles.headerFit}>Type</FitCell>
        </span>
        <span className={styles.headerCellLeft}>
          <FitCell align="left" className={styles.headerFit}>Asset</FitCell>
        </span>
        <span className={styles.headerCell}>
          <FitCell className={styles.headerFit}>Direction</FitCell>
        </span>
        <span className={styles.headerCell}>
          <FitCell className={styles.headerFit}>Size</FitCell>
        </span>
        <span className={styles.headerCell}>
          <FitCell className={styles.headerFit}>Original Size</FitCell>
        </span>
        <span className={styles.headerCell}>
          <FitCell className={styles.headerFit}>Order Value</FitCell>
        </span>
        <span className={styles.headerCell}>
          <FitCell className={styles.headerFit}>Price</FitCell>
        </span>
        <span className={styles.headerCell}>
          <FitCell className={styles.headerFit}>Reduce Only</FitCell>
        </span>
        <span className={styles.headerCell}>
          <FitCell className={styles.headerFit}>Trigger Conditions</FitCell>
        </span>
        {showActionsColumn ? (
          <span className={styles.headerCell}>
            <FitCell className={styles.headerFit}>Actions</FitCell>
          </span>
        ) : null}
      </div>
      {hasError ? <div className={styles.errorBanner}>{cancelError}</div> : null}
      <LoadingReveal
        isLoading={isLoading}
        skeleton={
          <TableSkeleton
            gridTemplate={skeletonGrid}
            columns={skeletonColumns}
            rows={DOCK_SKELETON_ROWS}
            ariaLabel="Loading open orders"
          />
        }
      >
        {isEmpty ? (
          <PlaceholderMessage message="No open orders" />
        ) : (
          <div className={styles.list}>
            {orders.map((order) => (
              <OrderRow
                key={order.identifier}
                order={order}
                onCancel={() => onCancelOrder(order.identifier)}
                onModify={() => onModifyOrder(order)}
                hasTrader={hasTrader}
                hasModifyOrder={hasModifyOrder}
                showActionsColumn={showActionsColumn}
              />
            ))}
          </div>
        )}
      </LoadingReveal>
      </div>
    </>
  )
}
