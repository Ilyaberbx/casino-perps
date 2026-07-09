import styles from './account-dock.module.css'
import { TwapFillHistoryRow } from './TwapFillHistoryRow'
import { PlaceholderMessage } from '@/modules/shared/components/placeholder-message'
import { Pagination } from '@/modules/shared/components/pagination'
import { TableSkeleton } from '@/modules/shared/components/table-skeleton'
import { LoadingReveal } from '@/modules/shared/components/loading-reveal'
import { DOCK_SKELETON_ROWS, DOCK_TABLE_COLUMNS } from './account-dock.constants'
import { FitCell } from '@/modules/shared/components/fit-cell'
import type { TwapFillHistoryPanelProps } from './twap-panel.types'

const HEADERS = [
  'Time',
  'Asset',
  'Side',
  'Price',
  'Size',
  'Trade Value',
  'Fee',
  'Closed PNL',
] as const

export function TwapFillHistoryPanel({
  pagination,
  totalCount,
  isLoading,
  historyError,
}: TwapFillHistoryPanelProps) {
  const isEmpty = totalCount === 0
  const isInitialLoad = isEmpty && isLoading
  const isEmptyAfterLoad = isEmpty && !isLoading
  const hasError = historyError !== null
  const showPagination = pagination.pageCount > 1 || pagination.canNext

  return (
    <>
      <div className={styles.tableScroll}>
        <div className={`${styles.tableHeader} ${styles.twapFillHeader}`}>
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
              gridTemplate="var(--twap-fill-grid)"
              columns={DOCK_TABLE_COLUMNS.twapFill}
              rows={DOCK_SKELETON_ROWS}
              ariaLabel="Loading TWAP fill history"
            />
          }
        >
          {isEmptyAfterLoad ? (
            <PlaceholderMessage message="No TWAP fill history" />
          ) : (
            <div className={styles.list}>
              {pagination.pageRows.map((fill) => (
                <TwapFillHistoryRow key={fill.identifier} fill={fill} />
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
          ariaLabel="TWAP fill history pages"
        />
      ) : null}
    </>
  )
}
