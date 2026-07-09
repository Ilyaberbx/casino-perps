import styles from './account-dock.module.css'
import { AccountActivityRow } from './AccountActivityRow'
import { formatGmtOffsetLabel } from './account-dock.utils'
import { PlaceholderMessage } from '@/modules/shared/components/placeholder-message'
import { Pagination } from '@/modules/shared/components/pagination'
import { TableSkeleton } from '@/modules/shared/components/table-skeleton'
import { LoadingReveal } from '@/modules/shared/components/loading-reveal'
import { DOCK_SKELETON_ROWS, DOCK_TABLE_COLUMNS } from './account-dock.constants'
import { FitCell } from '@/modules/shared/components/fit-cell'
import type { AccountActivityPanelProps } from './account-dock.types'

// Resolved once at module load — the viewer's UTC offset does not change within
// a session. Mirrors app.hyperliquid.xyz's "Time (GMT+3)" header.
const TIME_HEADER = `Time (${formatGmtOffsetLabel(new Date().getTimezoneOffset())})`

const HEADERS = [
  { label: TIME_HEADER, align: 'left' },
  { label: 'Status', align: 'left' },
  { label: 'Asset', align: 'left' },
  { label: 'Action', align: 'left' },
  { label: 'From', align: 'left' },
  { label: 'To', align: 'left' },
  { label: 'Destination', align: 'left' },
  { label: 'Account Change', align: 'right' },
  { label: 'USD Value', align: 'right' },
  { label: 'Fee', align: 'right' },
] as const

export function AccountActivityPanel({
  pagination,
  totalCount,
  isLoading,
  historyError,
  explorerTxUrl,
}: AccountActivityPanelProps) {
  const isEmpty = totalCount === 0
  const isInitialLoad = isEmpty && isLoading
  const isEmptyAfterLoad = isEmpty && !isLoading
  const hasError = historyError !== null
  const showPagination = pagination.pageCount > 1 || pagination.canNext

  return (
    <>
      <div className={styles.tableScroll}>
      <div className={`${styles.tableHeader} ${styles.activityHeader}`}>
        {HEADERS.map(({ label, align }) => (
          <span
            key={label}
            className={align === 'left' ? styles.headerCellLeft : styles.headerCell}
          >
            <FitCell align={align} className={styles.headerFit}>
              {label}
            </FitCell>
          </span>
        ))}
      </div>
      {hasError ? <div className={styles.errorBanner}>{historyError}</div> : null}
      <LoadingReveal
        isLoading={isInitialLoad}
        skeleton={
          <TableSkeleton
            gridTemplate="var(--activity-grid)"
            columns={DOCK_TABLE_COLUMNS.accountActivity}
            rows={DOCK_SKELETON_ROWS}
            ariaLabel="Loading account activity"
          />
        }
      >
        {isEmptyAfterLoad ? (
          <PlaceholderMessage message="No account activity" />
        ) : (
          <div className={styles.list}>
            {pagination.pageRows.map((entry, index) => (
              <AccountActivityRow
                key={`${entry.time}-${entry.hash}-${index}`}
                entry={entry}
                explorerTxUrl={explorerTxUrl}
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
          ariaLabel="Account activity pages"
        />
      ) : null}
    </>
  )
}
