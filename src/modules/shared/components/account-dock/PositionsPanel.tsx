import styles from './account-dock.module.css'
import { PositionRow } from './PositionRow'
import { PlaceholderMessage } from '@/modules/shared/components/placeholder-message'
import { TableSkeleton } from '@/modules/shared/components/table-skeleton'
import { LoadingReveal } from '@/modules/shared/components/loading-reveal'
import { DOCK_SKELETON_ROWS, DOCK_TABLE_COLUMNS } from './account-dock.constants'
import { FitCell } from '@/modules/shared/components/fit-cell'
import type { PositionsPanelProps } from './account-dock.types'

export function PositionsPanel({
  positionRows,
  isLoading,
  onClosePosition,
  onManagePosition,
  onEditTpsl,
  onSharePosition,
  canShare,
  onSelectPosition,
  hasTrader,
  hasPositionProtection,
  showActionsColumn,
}: PositionsPanelProps) {
  const isEmpty = positionRows.length === 0
  // Spectating drops the Actions column entirely — header cell, body cells, and
  // its grid track — so the header and rows stay aligned with one fewer column.
  const headerGridClass = showActionsColumn
    ? styles.positionsHeader
    : styles.positionsHeaderSpectate
  const skeletonGrid = showActionsColumn ? 'var(--positions-grid)' : 'var(--positions-grid-spectate)'
  const skeletonColumns = showActionsColumn
    ? DOCK_TABLE_COLUMNS.positions
    : DOCK_TABLE_COLUMNS.positions - 1

  return (
    <>
      <div className={styles.tableScroll}>
      <div className={`${styles.tableHeader} ${headerGridClass}`}>
        <span className={styles.headerCell}>
          <FitCell align="left" className={styles.headerFit}>Asset</FitCell>
        </span>
        <span className={styles.headerCell}>
          <FitCell className={styles.headerFit}>Size</FitCell>
        </span>
        <span className={styles.headerCell}>
          <FitCell className={styles.headerFit}>Position Value</FitCell>
        </span>
        <span className={styles.headerCell}>
          <FitCell className={styles.headerFit}>Entry Price</FitCell>
        </span>
        <span className={styles.headerCell}>
          <FitCell className={styles.headerFit}>Mark Price</FitCell>
        </span>
        <span className={styles.headerCell}>
          <FitCell className={styles.headerFit}>Liq. Price</FitCell>
        </span>
        <span className={styles.headerCell}>
          <FitCell className={styles.headerFit}>PNL (ROE %)</FitCell>
        </span>
        <span className={styles.headerCell}>
          <FitCell className={styles.headerFit}>Margin</FitCell>
        </span>
        <span className={styles.headerCell}>
          <FitCell className={styles.headerFit}>Funding</FitCell>
        </span>
        {showActionsColumn ? (
          <span className={styles.headerCell}>
            <FitCell className={styles.headerFit}>Actions</FitCell>
          </span>
        ) : null}
        <span className={styles.headerCell}>
          <FitCell className={styles.headerFit}>TP/SL</FitCell>
        </span>
      </div>
      <LoadingReveal
        isLoading={isLoading}
        skeleton={
          <TableSkeleton
            gridTemplate={skeletonGrid}
            columns={skeletonColumns}
            rows={DOCK_SKELETON_ROWS}
            ariaLabel="Loading positions"
          />
        }
      >
        {isEmpty ? (
          <PlaceholderMessage message="No open positions" />
        ) : (
          <div className={styles.list}>
            {positionRows.map(({ position, displaySymbol, dexTag, isHip3, tpsl }) => (
              <PositionRow
                key={position.symbol}
                position={position}
                displaySymbol={displaySymbol}
                dexTag={dexTag}
                isHip3={isHip3}
                tpsl={tpsl}
                onClose={() => onClosePosition(position.symbol)}
                onOpenManage={() => onManagePosition(position)}
                onEditTpsl={() => onEditTpsl(position)}
                onShare={canShare ? () => onSharePosition(position) : undefined}
                onSelect={onSelectPosition ? () => onSelectPosition(position.symbol) : undefined}
                hasTrader={hasTrader}
                hasPositionProtection={hasPositionProtection}
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
