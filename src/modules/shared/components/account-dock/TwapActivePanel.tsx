import styles from './account-dock.module.css'
import { TwapActiveRow } from './TwapActiveRow'
import { PlaceholderMessage } from '@/modules/shared/components/placeholder-message'
import { TableSkeleton } from '@/modules/shared/components/table-skeleton'
import { LoadingReveal } from '@/modules/shared/components/loading-reveal'
import { DOCK_SKELETON_ROWS, DOCK_TABLE_COLUMNS } from './account-dock.constants'
import { FitCell } from '@/modules/shared/components/fit-cell'
import type { TwapActivePanelProps } from './twap-panel.types'

const HEADERS = [
  '',
  'Asset',
  'Side',
  'Size',
  'Executed',
  'Average Price',
  'Started At',
  'TWAP Duration',
  'Time Remaining',
  'Progress',
  'Cancel',
] as const

export function TwapActivePanel({
  twaps,
  isLoading,
  now,
  hasTwapController,
  selectedIds,
  onToggleSelected,
  onCancel,
}: TwapActivePanelProps) {
  const isEmpty = twaps.length === 0

  return (
    <>
      <div className={styles.tableScroll}>
        <div className={`${styles.tableHeader} ${styles.twapActiveHeader}`}>
          {HEADERS.map((label, index) => {
            // The first column is the empty select/checkbox header — no label, so
            // it gets no FitCell. Asset is left-packed; all others right.
            const isSelectColumn = label === ''
            const isLeft = label === 'Asset'
            return (
              <span
                key={isSelectColumn ? `select-${index}` : label}
                className={isLeft ? styles.headerCellLeft : styles.headerCell}
              >
                {isSelectColumn ? null : (
                  <FitCell align={isLeft ? 'left' : 'right'} className={styles.headerFit}>
                    {label}
                  </FitCell>
                )}
              </span>
            )
          })}
        </div>
        <LoadingReveal
          isLoading={isLoading}
          skeleton={
            <TableSkeleton
              gridTemplate="var(--twap-active-grid)"
              columns={DOCK_TABLE_COLUMNS.twapActive}
              rows={DOCK_SKELETON_ROWS}
              ariaLabel="Loading TWAP orders"
            />
          }
        >
          {isEmpty ? (
            <PlaceholderMessage message="No active TWAP orders" />
          ) : (
            <div className={styles.list}>
              {twaps.map((twap) => (
                <TwapActiveRow
                  key={twap.identifier}
                  twap={twap}
                  now={now}
                  hasTwapController={hasTwapController}
                  isSelected={selectedIds.has(twap.identifier)}
                  onToggleSelected={() => onToggleSelected(twap.identifier)}
                  onCancel={() => onCancel(twap)}
                />
              ))}
            </div>
          )}
        </LoadingReveal>
      </div>
    </>
  )
}
