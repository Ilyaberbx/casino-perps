import styles from './account-dock.module.css'
import { TradeHistoryRow } from './TradeHistoryRow'
import { PlaceholderMessage } from '@/modules/shared/components/placeholder-message'
import { Pagination } from '@/modules/shared/components/pagination'
import { TableSkeleton } from '@/modules/shared/components/table-skeleton'
import { LoadingReveal } from '@/modules/shared/components/loading-reveal'
import { DOCK_SKELETON_ROWS, DOCK_TABLE_COLUMNS } from './account-dock.constants'
import { FitCell } from '@/modules/shared/components/fit-cell'
import type { TradeHistoryPanelProps } from './account-dock.types'

export function TradeHistoryPanel({
  pagination,
  totalCount,
  isLoading,
  historyError,
  onShareFill,
  canShare,
}: TradeHistoryPanelProps) {
  const isEmpty = totalCount === 0
  const isInitialLoad = isEmpty && isLoading
  const isEmptyAfterLoad = isEmpty && !isLoading
  const hasError = historyError !== null
  const showPagination = pagination.pageCount > 1 || pagination.canNext

  return (
    <>
      <div className={styles.tableScroll}>
      <div className={`${styles.tableHeader} ${styles.fillsHeader}`}>
        <span className={styles.headerCell}>
          <FitCell align="left" className={styles.headerFit}>Time</FitCell>
        </span>
        <span className={styles.headerCellLeft}>
          <FitCell align="left" className={styles.headerFit}>Asset</FitCell>
        </span>
        <span className={styles.headerCell}>
          <FitCell className={styles.headerFit}>Side</FitCell>
        </span>
        <span className={styles.headerCell}>
          <FitCell className={styles.headerFit}>Price</FitCell>
        </span>
        <span className={styles.headerCell}>
          <FitCell className={styles.headerFit}>Size</FitCell>
        </span>
        <span className={styles.headerCell}>
          <FitCell className={styles.headerFit}>Value</FitCell>
        </span>
        <span className={styles.headerCell}>
          <FitCell className={styles.headerFit}>Fee</FitCell>
        </span>
        <span className={styles.headerCell}>
          <FitCell className={styles.headerFit}>Closed PNL</FitCell>
        </span>
        <span className={styles.headerCell}>
          <FitCell className={styles.headerFit}>Type</FitCell>
        </span>
      </div>
      {hasError ? <div className={styles.errorBanner}>{historyError}</div> : null}
      <LoadingReveal
        isLoading={isInitialLoad}
        skeleton={
          <TableSkeleton
            gridTemplate="var(--fills-grid)"
            columns={DOCK_TABLE_COLUMNS.tradeHistory}
            rows={DOCK_SKELETON_ROWS}
            ariaLabel="Loading trade history"
          />
        }
      >
        {isEmptyAfterLoad ? (
          <PlaceholderMessage message="No trade history" />
        ) : (
          <div className={styles.list}>
            {pagination.pageRows.map((fill) => (
              <TradeHistoryRow
                key={fill.identifier}
                fill={fill}
                onShare={
                  canShare && fill.closedPnl !== undefined ? () => onShareFill(fill) : undefined
                }
              />
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
          ariaLabel="Trade history pages"
        />
      ) : null}
    </>
  )
}
