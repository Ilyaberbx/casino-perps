import styles from './account-dock.module.css'
import { InterestHistoryRow } from './InterestHistoryRow'
import { PlaceholderMessage } from '@/modules/shared/components/placeholder-message'
import { Pagination } from '@/modules/shared/components/pagination'
import { TableSkeleton } from '@/modules/shared/components/table-skeleton'
import { LoadingReveal } from '@/modules/shared/components/loading-reveal'
import { DOCK_SKELETON_ROWS, DOCK_TABLE_COLUMNS } from './account-dock.constants'
import { FitCell } from '@/modules/shared/components/fit-cell'
import type { InterestHistoryPanelProps } from './account-dock.types'

const HEADERS = ['Time', 'Asset', 'Net Interest'] as const

export function InterestHistoryPanel({
  pagination,
  totalCount,
  isLoading,
  historyError,
}: InterestHistoryPanelProps) {
  const isEmpty = totalCount === 0
  const isInitialLoad = isEmpty && isLoading
  const isEmptyAfterLoad = isEmpty && !isLoading
  const hasError = historyError !== null
  const showPagination = pagination.pageCount > 1 || pagination.canNext

  return (
    <>
      <div className={styles.tableScroll}>
      <div className={`${styles.tableHeader} ${styles.interestHeader}`}>
        {HEADERS.map((label, index) => {
          // The first header (Time) is left-aligned by `.headerCell:first-child`
          // to match the left-aligned body Time cell; the rest stay right.
          const isLeft = index === 0
          return (
            <span key={label} className={styles.headerCell}>
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
            gridTemplate="var(--interest-grid)"
            columns={DOCK_TABLE_COLUMNS.interest}
            rows={DOCK_SKELETON_ROWS}
            ariaLabel="Loading interest history"
          />
        }
      >
        {isEmptyAfterLoad ? (
          <PlaceholderMessage message="No interest history" />
        ) : (
          <div className={styles.list}>
            {pagination.pageRows.map((entry, index) => (
              <InterestHistoryRow key={`${entry.timestamp}-${entry.asset}-${index}`} entry={entry} />
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
          ariaLabel="Interest history pages"
        />
      ) : null}
    </>
  )
}
