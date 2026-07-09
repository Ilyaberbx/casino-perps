import styles from './account-dock.module.css'
import { TwapHistoryRow } from './TwapHistoryRow'
import { PlaceholderMessage } from '@/modules/shared/components/placeholder-message'
import { Pagination } from '@/modules/shared/components/pagination'
import { TableSkeleton } from '@/modules/shared/components/table-skeleton'
import { LoadingReveal } from '@/modules/shared/components/loading-reveal'
import { DOCK_SKELETON_ROWS, DOCK_TABLE_COLUMNS } from './account-dock.constants'
import { FitCell } from '@/modules/shared/components/fit-cell'
import type { TwapHistoryPanelProps } from './twap-panel.types'

const HEADERS = [
  'Time',
  'Asset',
  'Side',
  'Total Size',
  'Executed Size',
  'Average Price',
  'TWAP Duration',
  'Reduce Only',
  'Randomize',
  'Status',
] as const

export function TwapHistoryPanel({
  pagination,
  totalCount,
  isLoading,
  historyError,
}: TwapHistoryPanelProps) {
  const isEmpty = totalCount === 0
  const isInitialLoad = isEmpty && isLoading
  const isEmptyAfterLoad = isEmpty && !isLoading
  const hasError = historyError !== null
  const showPagination = pagination.pageCount > 1 || pagination.canNext

  return (
    <>
      <div className={styles.tableScroll}>
        <div className={`${styles.tableHeader} ${styles.twapHistoryHeader}`}>
          {HEADERS.map((label, index) => {
            // Asset is explicitly left-packed; the first column (Time) is
            // left-aligned by `.headerCell:first-child`. Both anchor left.
            const isAssetColumn = label === 'Asset'
            const isLeft = isAssetColumn || index === 0
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
              gridTemplate="var(--twap-history-grid)"
              columns={DOCK_TABLE_COLUMNS.twapHistory}
              rows={DOCK_SKELETON_ROWS}
              ariaLabel="Loading TWAP history"
            />
          }
        >
          {isEmptyAfterLoad ? (
            <PlaceholderMessage message="No TWAP history" />
          ) : (
            <div className={styles.list}>
              {pagination.pageRows.map((entry) => (
                <TwapHistoryRow key={entry.identifier} entry={entry} />
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
          ariaLabel="TWAP history pages"
        />
      ) : null}
    </>
  )
}
