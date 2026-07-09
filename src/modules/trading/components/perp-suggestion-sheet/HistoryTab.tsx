import { Callout } from '@/modules/shared/components/callout'
import { EmptyState } from '@/modules/shared/components/empty-state'
import { RowsSkeleton } from '../rows-skeleton/RowsSkeleton'
import { HistoryRow } from './HistoryRow'
import {
  HISTORY_EMPTY_COPY,
  HISTORY_SKELETON_ROWS,
} from './perp-suggestion-sheet.constants'
import { isExpired } from './perp-suggestion-sheet.utils'
import styles from './perp-suggestion-sheet.module.css'
import type { HistoryTabProps } from './perp-suggestion-sheet.types'

/**
 * The History tab (slice 11): every agent's suggestions newest-first, agent-
 * badged, served from the cached read so it opens instantly. Still-valid rows
 * re-open in the preview; expired rows are marked + open read-only. Empty state
 * teaches a first-time view. Dumb.
 */
export function HistoryTab({ history, onReopen }: HistoryTabProps) {
  if (history.phase === 'loading') {
    return (
      <div className={styles.historySkeleton} data-testid="history-loading">
        <RowsSkeleton rows={HISTORY_SKELETON_ROWS} />
      </div>
    )
  }
  if (history.phase === 'error') {
    return (
      <Callout variant="error" label="History unavailable">
        {history.message}
      </Callout>
    )
  }
  if (history.rows.length === 0) {
    return <EmptyState message={HISTORY_EMPTY_COPY} />
  }

  return (
    <ul className={styles.historyList} data-testid="history-list">
      {history.rows.map((row) => (
        <HistoryRow
          key={row.id}
          row={row}
          expired={isExpired(row.expiresAt, history.nowMs)}
          onReopen={onReopen}
        />
      ))}
    </ul>
  )
}
