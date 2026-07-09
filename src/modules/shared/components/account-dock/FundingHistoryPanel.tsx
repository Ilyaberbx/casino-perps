import styles from './account-dock.module.css'
import { FundingHistoryRow } from './FundingHistoryRow'
import { PlaceholderMessage } from '@/modules/shared/components/placeholder-message'
import { Pagination } from '@/modules/shared/components/pagination'
import { TableSkeleton } from '@/modules/shared/components/table-skeleton'
import { LoadingReveal } from '@/modules/shared/components/loading-reveal'
import { DOCK_SKELETON_ROWS, DOCK_TABLE_COLUMNS } from './account-dock.constants'
import { FitCell } from '@/modules/shared/components/fit-cell'
import type { FundingHistoryPanelProps } from './account-dock.types'

const HEADERS = ['Time', 'Asset', 'Payment', 'Rate', 'Position Size'] as const

export function FundingHistoryPanel({
  pagination,
  totalCount,
  isLoading,
  historyError,
}: FundingHistoryPanelProps) {
  const isEmpty = totalCount === 0
  const isInitialLoad = isEmpty && isLoading
  const isEmptyAfterLoad = isEmpty && !isLoading
  const hasError = historyError !== null
  const showPagination = pagination.pageCount > 1 || pagination.canNext

  return (
    <>
      <div className={styles.tableScroll}>
      <div className={`${styles.tableHeader} ${styles.fundingHeader}`}>
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
            gridTemplate="var(--funding-grid)"
            columns={DOCK_TABLE_COLUMNS.funding}
            rows={DOCK_SKELETON_ROWS}
            ariaLabel="Loading funding history"
          />
        }
      >
        {isEmptyAfterLoad ? (
          <PlaceholderMessage message="No funding history" />
        ) : (
          <div className={styles.list}>
            {pagination.pageRows.map((entry, index) => (
              <FundingHistoryRow key={`${entry.timestamp}-${entry.symbol}-${index}`} entry={entry} />
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
          ariaLabel="Funding history pages"
        />
      ) : null}
    </>
  )
}
