import styles from './account-dock.module.css'
import { OrderHistoryRow } from './OrderHistoryRow'
import { PlaceholderMessage } from '@/modules/shared/components/placeholder-message'
import { Pagination } from '@/modules/shared/components/pagination'
import { TableSkeleton } from '@/modules/shared/components/table-skeleton'
import { LoadingReveal } from '@/modules/shared/components/loading-reveal'
import { DOCK_SKELETON_ROWS, DOCK_TABLE_COLUMNS } from './account-dock.constants'
import { FitCell } from '@/modules/shared/components/fit-cell'
import type { OrderHistoryPanelProps } from './account-dock.types'

const HEADERS = [
  'Time',
  'Type',
  'Asset',
  'Direction',
  'Size',
  'Filled Size',
  'Order Value',
  'Price',
  'Reduce Only',
  'Trigger Conditions',
  'Status',
  'Order ID',
] as const

export function OrderHistoryPanel({
  pagination,
  totalCount,
  isLoading,
  historyError,
}: OrderHistoryPanelProps) {
  const isEmpty = totalCount === 0
  const isInitialLoad = isEmpty && isLoading
  const isEmptyAfterLoad = isEmpty && !isLoading
  const hasError = historyError !== null
  const showPagination = pagination.pageCount > 1 || pagination.canNext

  return (
    <>
      <div className={styles.tableScroll}>
      <div className={`${styles.tableHeader} ${styles.orderHistoryHeader}`}>
        {HEADERS.map((label, index) => {
          // Asset is an explicitly left-packed column; the first column (Time) is
          // left-aligned by `.headerCell:first-child`. Both anchor their FitCell
          // compression to the left edge to match the body cell alignment.
          const isAssetColumn = label === 'Asset'
          const isFirstColumn = index === 0
          const isLeft = isAssetColumn || isFirstColumn
          return (
            <span key={label} className={isAssetColumn ? styles.headerCellLeft : styles.headerCell}>
              <FitCell align={isLeft ? 'left' : 'right'} className={styles.headerFit}>
                {label}
              </FitCell>
            </span>
          )
        })}
      </div>
      {hasError ? <div className={styles.errorBanner}>{historyError}</div> : null}
      <LoadingReveal
        isLoading={isInitialLoad}
        skeleton={
          <TableSkeleton
            gridTemplate="var(--order-history-grid)"
            columns={DOCK_TABLE_COLUMNS.orderHistory}
            rows={DOCK_SKELETON_ROWS}
            ariaLabel="Loading order history"
          />
        }
      >
        {isEmptyAfterLoad ? (
          <PlaceholderMessage message="No order history" />
        ) : (
          <div className={styles.list}>
            {pagination.pageRows.map((order) => (
              <OrderHistoryRow key={order.identifier} order={order} />
            ))}
          </div>
        )}
      </LoadingReveal>
      </div>
      {showPagination ? (
        <Pagination
          page={pagination.page}
          pageCount={pagination.pageCount}
          canPrev={pagination.canPrev}
          canNext={pagination.canNext}
          onPrev={pagination.goPrev}
          onNext={pagination.goNext}
          onSelect={pagination.goToPage}
          isFetchingMore={pagination.isFetchingMore}
          ariaLabel="Order history pages"
        />
      ) : null}
    </>
  )
}
